import type { VoiceMessage } from "../vendor/formlane/src/voice-protocol";

export function updateVoiceMessages(
  messages: VoiceMessage[],
  message: VoiceMessage,
): VoiceMessage[] {
  if (!messages.some((item) => item.id === message.id))
    return [...messages, message];
  return messages.map((item) => (item.id === message.id ? message : item));
}
