import { expect, test } from "vitest";
import { VoiceTranscript } from "../vendor/formlane/src/voice-transcript";
import type { VoiceMessage } from "../vendor/formlane/src/voice-protocol";
import { updateVoiceMessages } from "../src/voice-messages";

test("streaming and final transcript updates keep one bubble per speaker per turn", () => {
  let messages: VoiceMessage[] = [];
  const transcript = new VoiceTranscript((message) => {
    messages = updateVoiceMessages(messages, message);
  });

  transcript.receive({ inputTranscription: { text: "What can you do?" } });
  transcript.receive({ outputTranscription: { text: "I'm your guide" } });
  const ids = messages.map((message) => message.id);
  transcript.receive({ outputTranscription: { text: " for Frontender." } });
  expect(messages.map(({ text }) => text)).toEqual([
    "What can you do?",
    "I'm your guide for Frontender.",
  ]);
  transcript.receive({ turnComplete: true });
  expect(messages.map(({ id, status }) => [id, status])).toEqual([
    [ids[0], "complete"],
    [ids[1], "complete"],
  ]);

  transcript.receive({ inputTranscription: { text: "What can you do?" } });
  expect(messages.filter(({ role }) => role === "user")).toHaveLength(2);
  expect(messages[2].id).not.toBe(ids[0]);
});

test("background thinking can continue the same reply after turnComplete", () => {
  let messages: VoiceMessage[] = [];
  const transcript = new VoiceTranscript((message) => {
    messages = updateVoiceMessages(messages, message);
  });
  transcript.receive({
    outputTranscription: { text: "Let me think. " },
    turnComplete: true,
    interactionStatus: "IN_PROGRESS",
  });
  expect(messages[1].status).toBe("streaming");
  transcript.receive({ outputTranscription: { text: "Here are the steps." } });
  transcript.receive({ interactionStatus: "IDLE" });
  expect(messages).toHaveLength(2);
  expect(messages[1]).toMatchObject({
    text: "Let me think. Here are the steps.",
    status: "complete",
  });
});
