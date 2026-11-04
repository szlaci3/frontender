import type { Config } from "@netlify/functions";
import {
  createVoiceHandler,
  voiceSettings,
} from "../../vendor/formlane/server/voice.ts";

export const config: Config = {
  path: "/api/voice-token",
  rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
export default createVoiceHandler({
  settings: () => ({
    ...voiceSettings(),
    enabled: process.env.FORMLANE_VOICE_ENABLED !== "false",
  }),
});
