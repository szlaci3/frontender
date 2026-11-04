import { sanitizeHTML } from "./design";
import { parseWorkspace, type Workspace } from "./workspace";

export const snapshotPrefix = "#snapshot=v1.";
const maxEncodedLength = 24000;
const maxSnapshotBytes = 1_000_000;
const tooLarge =
  "This design is too large for a snapshot link. Use Export website or a PDF handout instead.";

export async function snapshotLink(workspace: Workspace) {
  const design: Workspace = {
    format: workspace.format,
    version: workspace.version,
    name: workspace.name,
    activePage: workspace.activePage,
    pages: workspace.pages.map(({ reference, importedStyle, ...page }) => ({
      ...page,
      html: sanitizeHTML(page.html),
    })),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(design));
  if (bytes.length > maxSnapshotBytes) throw new Error(tooLarge);
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  if (compressed.length > (maxEncodedLength * 3) / 4) throw new Error(tooLarge);
  const payload = btoa(String.fromCharCode(...compressed))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  const url = new URL(location.href);
  url.search = "";
  url.hash = snapshotPrefix + payload;
  return url.href;
}

export async function readSnapshot(hash: string): Promise<Workspace> {
  if (!hash.startsWith(snapshotPrefix))
    throw new Error("Unsupported snapshot version.");
  const payload = hash.slice(snapshotPrefix.length);
  if (payload.length > maxEncodedLength || !/^[A-Za-z0-9_-]+$/.test(payload))
    throw new Error("Invalid snapshot link.");
  const compressed = Uint8Array.from(
    atob(payload.replaceAll("-", "+").replaceAll("_", "/")),
    (c) => c.charCodeAt(0),
  );
  const reader = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
    .getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let json = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxSnapshotBytes) {
        await reader.cancel();
        throw new Error("Snapshot is too large.");
      }
      json += decoder.decode(value, { stream: true });
    }
    return parseWorkspace(json + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}
