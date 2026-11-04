import { test } from "vitest";
import assert from "node:assert/strict";
import { initial } from "../vendor/border/shared/border.ts";
import { generateStyle, AGENT } from "../vendor/border/server/generation.ts";
const input = {
  action: "suggest",
  image: "data:image/png;base64,aGVsbG8=",
  question: "",
  settings: initial,
  history: [],
  view: {
    shape: "wide",
    background: "paper",
    label: "Hello",
    sourceWidth: 160,
    sourceHeight: 160,
  },
};
test("unusable sketch output is rejected once with a safe actionable error", async () => {
  let calls = 0;
  // Synthetic invalid payload exercises the same rejection seen in the live probe.
  await assert.rejects(
    generateStyle(
      { ...input, action: "analyze" },
      {
        key: "secret",
        fetcher: async () => {
          calls++;
          return Response.json({
            agent: AGENT,
            status: "completed",
            output_text: JSON.stringify({
              advice: "secret",
              crop: { x: 18, y: 28, width: 64, height: 50 },
            }),
          });
        },
      },
    ),
    (error) =>
      error instanceof Error &&
      error.message ===
        "AI returned an incomplete or invalid result. Retry manually." &&
      !error.message.includes("secret"),
  );
  assert.equal(calls, 1);
});
