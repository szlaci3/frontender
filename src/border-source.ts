import { loadImage, type Source } from "../vendor/border/src/images";

// Workspace assets must retain their dimensions and alpha channel. The smaller
// JPEG-capable AI payload is deliberately not used for persisted CSS sources.
export async function embedBorderSource(source: Source): Promise<string> {
  const image = await loadImage(source.url);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d")!.drawImage(image, 0, 0);
  const data = canvas.toDataURL("image/png");
  if (!data.startsWith("data:image/png;base64,") || data.length > 4_000_000)
    throw new Error(
      "This border is too large to embed without losing detail. Crop it or upload a smaller image, then try again. Your design is unchanged.",
    );
  return data;
}
