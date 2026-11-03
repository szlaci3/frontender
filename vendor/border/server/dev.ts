import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createViteServer } from "vite";
import { generateStyle, GenerationError } from "./generation.ts";
if (existsSync(".env")) process.loadEnvFile(".env");
const server = createServer(async (req, res) => {
  if (req.url === "/api/health") {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        status: "ok",
        aiConfigured: !!process.env.GEMINI_API_KEY,
      }),
    );
    return;
  }
  if (req.url === "/api/generate") {
    try {
      if (req.method !== "POST")
        throw new GenerationError("POST required.", 405);
      if (
        req.headers.origin &&
        req.headers.origin !== `http://${req.headers.host}`
      )
        throw new GenerationError("Invalid origin.", 403);
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw new GenerationError("JSON required.", 415);
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > 2_100_000)
          throw new GenerationError("Image too large.", 413);
        chunks.push(c);
      }
      let input;
      try {
        input = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        throw new GenerationError("Invalid JSON.", 400);
      }
      const result = await generateStyle(input);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(e instanceof GenerationError ? e.status : 400, {
        "Content-Type": "application/json",
      });
      res.end(
        JSON.stringify({
          error: e instanceof GenerationError ? e.message : "Invalid request.",
        }),
      );
    }
    return;
  }
  if (req.url?.startsWith("/api/")) {
    res.writeHead(404);
    res.end();
    return;
  }
  vite.middlewares(req, res);
});
const vite = await createViteServer({
  server: { middlewareMode: true, hmr: { server } },
  appType: "spa",
});
server.listen(Number(process.env.PORT ?? 5173), "127.0.0.1", () =>
  console.log(`Border Image Lab: http://127.0.0.1:${process.env.PORT ?? 5173}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close();
    void vite.close();
  });
