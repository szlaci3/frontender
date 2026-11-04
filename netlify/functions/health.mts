import type { Config } from "@netlify/functions";

export default async (request: Request) =>
  Response.json(
    request.method === "GET"
      ? {
          status: "ok",
          service: "frontender",
          generation: "background",
          aiConfigured: !!process.env.GEMINI_API_KEY,
        }
      : { error: "GET required." },
    {
      status: request.method === "GET" ? 200 : 405,
      headers: { "Cache-Control": "no-store" },
    },
  );
export const config: Config = { path: "/api/health" };
