// Explicit opt-in: one real request per provider feature; never run by npm test.
import {
  assistantContext,
  proposalSchema,
} from "../vendor/formlane/src/assistant.ts";
import { createProject } from "../vendor/formlane/src/model.ts";
import { initial, parseResult } from "../vendor/border/shared/border.ts";
import { parseStyle } from "../vendor/styler/shared/style.ts";
const base = process.env.FRONTENDER_BASE_URL || "http://127.0.0.1:5180";
async function call(path, input, validate, statusPath) {
  const started = Date.now();
  try {
    let response = await fetch(base + path, {
      method: "POST",
      headers: {
        Origin: base,
        ...(input ? { "Content-Type": "application/json" } : {}),
      },
      ...(input ? { body: JSON.stringify(input) } : {}),
      signal: AbortSignal.timeout(105000),
    });
    let body = await response.json();
    if (response.status === 202) {
      const job = body.jobId;
      if (!statusPath || !/^\d{13}-[a-f0-9]{64}$/.test(job))
        throw Error("Invalid job");
      while (response.status === 202 && Date.now() - started < 190000) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        response = await fetch(`${base}${statusPath}?job=${job}`, {
          signal: AbortSignal.timeout(15000),
        });
        body = await response.json();
      }
    }
    if (response.status !== 200)
      throw Error(`HTTP ${response.status}: ${body.error || "Incomplete"}`);
    validate(body);
    console.log(
      JSON.stringify({
        feature: path,
        ok: true,
        elapsedMs: Date.now() - started,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        feature: path,
        ok: false,
        error: error.message,
        elapsedMs: Date.now() - started,
      }),
    );
    process.exitCode = 1;
  }
}
await call(
  "/api/styler/generate",
  { id: "G900001", snapshot: [], expression: "Professional" },
  (body) => parseStyle(body.style),
  "/api/styler/generation-status",
);
await call(
  "/api/assistant",
  {
    prompt: "Suggest a short new brand name. Change only the brand.",
    context: assistantContext(createProject(), "webshop"),
  },
  (body) => proposalSchema.parse(body),
);
await call(
  "/api/border/generate",
  {
    action: "chat",
    question: "Explain what slice does in one sentence.",
    image:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
    settings: initial,
    history: [],
    view: {
      shape: "wide",
      background: "paper",
      label: "Smoke test",
      sourceWidth: 1,
      sourceHeight: 1,
    },
  },
  (body) => parseResult(body, "chat"),
  "/api/border/generation-status",
);
await call("/api/voice-token", undefined, (body) => {
  if (!body.token?.startsWith("auth_tokens/") || !body.setup?.systemInstruction)
    throw Error("Invalid voice session");
  // Never log the ephemeral credential. This does not test microphone or playback.
});
