// Opt-in live comparison. Uses text input and measures the streamed audio output.
import { createVoiceHandler } from "../vendor/formlane/server/voice.ts";
import {
  VOICE_MODEL,
  VOICE_SOCKET,
} from "../vendor/formlane/src/voice-protocol.ts";

const prompts = [
  ["short", "What can you do? Can you tell me?"],
  [
    "detailed",
    "Explain how to create, style, preview, and share a Frontender design. Give eight detailed numbered steps.",
  ],
  [
    "long",
    'Answer very long, in 30 paragraphs. Give 30 numbered paragraphs explaining the Frontender workflow, with one or two full sentences per paragraph. Say each paragraph number aloud and end by saying "end of guide".',
  ],
];
const handler = createVoiceHandler({
  settings: () => ({ enabled: true, apiKey: process.env.GEMINI_API_KEY ?? "" }),
});

async function run([name, prompt]) {
  const origin = "http://localhost";
  const response = await handler(
    new Request(`${origin}/api/voice-token`, {
      method: "POST",
      headers: { Origin: origin },
    }),
  );
  const { token, setup, error } = await response.json();
  if (!response.ok) throw Error(`Token HTTP ${response.status}: ${error}`);
  return new Promise((resolve) => {
    const socket = new WebSocket(
      `${VOICE_SOCKET}?access_token=${encodeURIComponent(token)}`,
    );
    socket.binaryType = "arraybuffer";
    let started = Date.now(),
      firstAudio,
      bytes = 0,
      transcript = "",
      sent = false;
    const boundaries = [];
    let finished = false,
      pendingComplete = false;
    const timer = setTimeout(() => finish("timeout"), 210_000);
    function finish(outcome, code) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket.close();
      resolve({
        name,
        model: VOICE_MODEL,
        outcome,
        code,
        words: transcript.trim().split(/\s+/).filter(Boolean).length,
        audioSeconds: Math.round(bytes / 480) / 100,
        firstAudioMs: firstAudio,
        elapsedMs: Date.now() - started,
        endMarker: /end of (the )?guide/i.test(transcript),
        boundaries,
        transcript,
      });
    }
    socket.onopen = () => socket.send(JSON.stringify({ setup }));
    socket.onerror = () => finish("socket-error");
    socket.onclose = (e) =>
      finish("socket-closed", {
        closeCode: e.code,
        reason: e.reason.slice(0, 240),
        setupComplete: sent,
      });
    socket.onmessage = (e) => {
      const message = JSON.parse(
        typeof e.data === "string" ? e.data : new TextDecoder().decode(e.data),
      );
      if (message.error) return finish("provider-error", message.error.code);
      if (message.setupComplete && !sent) {
        sent = true;
        started = Date.now();
        socket.send(JSON.stringify({ realtimeInput: { text: prompt } }));
      }
      const content = message.serverContent;
      if (!content) return;
      transcript += content.outputTranscription?.text ?? "";
      for (const part of content.modelTurn?.parts ?? []) {
        if (part.inlineData?.mimeType?.startsWith("audio/")) {
          firstAudio ??= Date.now() - started;
          bytes += Buffer.from(part.inlineData.data, "base64").length;
        }
      }
      if (content.turnComplete || content.interactionStatus)
        boundaries.push({
          turnComplete: content.turnComplete,
          status: content.interactionStatus,
        });
      pendingComplete ||= !!content.turnComplete;
      if (pendingComplete && content.interactionStatus !== "IN_PROGRESS")
        finish(content.interrupted ? "interrupted" : "complete");
    };
  });
}

import { mkdir, writeFile } from "node:fs/promises";
await mkdir("test-results", { recursive: true });
const results = await Promise.all(
  prompts
    .filter(([name]) => !process.argv[2] || name === process.argv[2])
    .map(async (prompt) => {
      try {
        const result = await run(prompt);
        const { transcript, ...metrics } = result;
        console.log(JSON.stringify(metrics));
        return result;
      } catch (error) {
        console.log(JSON.stringify({ name: prompt[0], error: error.message }));
        return { name: prompt[0], error: error.message };
      }
    }),
);
await writeFile(
  `test-results/voice-${VOICE_MODEL}${process.argv[2] ? `-${process.argv[2]}` : ""}.json`,
  JSON.stringify(results, null, 2),
);
if (
  results.some(
    (r) =>
      r.outcome !== "complete" ||
      !r.audioSeconds ||
      (r.name === "long" && !r.endMarker),
  )
)
  process.exitCode = 1;
