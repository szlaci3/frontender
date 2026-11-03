import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const line = readFileSync(".env", "utf8")
  .split(/\r?\n/)
  .find((s) => s.startsWith("GEMINI_API_KEY="));
const key = line
  ?.slice("GEMINI_API_KEY=".length)
  .trim()
  .replace(/^['"]|['"]$/g, "");
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
}
const assets = files("dist");
if (key && assets.some((path) => readFileSync(path).includes(Buffer.from(key))))
  throw new Error("Server credential found in frontend build.");
console.log(
  `Verified ${assets.length} production files: no server credential found.`,
);
