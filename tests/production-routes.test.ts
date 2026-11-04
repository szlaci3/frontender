import { afterEach, expect, it, vi } from "vitest";
import assistant, {
  config as assistantConfig,
} from "../netlify/functions/assistant.mts";
import voice, {
  config as voiceConfig,
} from "../netlify/functions/voice-token.mts";
import health from "../netlify/functions/health.mts";

afterEach(() => vi.unstubAllEnvs());
it("production availability requires a server key and respects explicit disable flags", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("FORMLANE_ASSISTANT_ENABLED", "");
  vi.stubEnv("FORMLANE_VOICE_ENABLED", "");
  for (const handler of [assistant, voice]) {
    expect(
      (await (await handler(new Request("https://example.com/api"))).json())
        .enabled,
    ).toBe(false);
  }
  vi.stubEnv("GEMINI_API_KEY", "test-server-key");
  for (const handler of [assistant, voice]) {
    const response = await handler(new Request("https://example.com/api"));
    const body = await response.text();
    expect(JSON.parse(body).enabled).toBe(true);
    expect(body).not.toContain("test-server-key");
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
  vi.stubEnv("FORMLANE_ASSISTANT_ENABLED", "false");
  vi.stubEnv("FORMLANE_VOICE_ENABLED", "false");
  for (const handler of [assistant, voice]) {
    expect(
      (await (await handler(new Request("https://example.com/api"))).json())
        .enabled,
    ).toBe(false);
  }
  expect(assistantConfig.path).toBe("/api/assistant");
  expect(voiceConfig.path).toBe("/api/voice-token");
  expect(voiceConfig.rateLimit).toEqual(assistantConfig.rateLimit);
});
it("health is read-only and never exposes credentials", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-server-key");
  const response = await health(new Request("https://example.com/api/health"));
  expect(await response.json()).toEqual({
    status: "ok",
    service: "frontender",
    generation: "background",
    aiConfigured: true,
  });
  expect(
    (
      await health(
        new Request("https://example.com/api/health", { method: "POST" }),
      )
    ).status,
  ).toBe(405);
});
