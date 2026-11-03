import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { websiteApi } from "./vendor/formlane/server/vite-api.ts";
import { generationApi } from "./vendor/styler/server/generation-api.ts";
import {
  generateStyle,
  GenerationError,
} from "./vendor/border/server/generation.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ["GEMINI_", "FORMLANE_"]);
  for (const [key, value] of Object.entries(env)) process.env[key] ??= value;
  process.env.FORMLANE_ASSISTANT_ENABLED ??= "true";
  process.env.FORMLANE_VOICE_ENABLED ??= "true";
  return {
    plugins: [
      react(),
      websiteApi(),
      {
        name: "frontender-api",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
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
            if (req.url === "/api/styler/generate") {
              await generationApi(req, res);
              return;
            }
            if (req.url !== "/api/border/generate") return next();
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
              for await (const chunk of req) {
                size += chunk.length;
                if (size > 2100000)
                  throw new GenerationError("Image too large.", 413);
                chunks.push(chunk);
              }
              const result = await generateStyle(
                JSON.parse(Buffer.concat(chunks).toString()),
              );
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(result));
            } catch (error) {
              res.writeHead(
                error instanceof GenerationError ? error.status : 400,
                { "Content-Type": "application/json" },
              );
              res.end(
                JSON.stringify({
                  error:
                    error instanceof GenerationError
                      ? error.message
                      : "Invalid border request.",
                }),
              );
            }
          });
        },
      },
    ],
    build: { chunkSizeWarningLimit: 1500 },
  };
});
