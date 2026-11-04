import type { Config } from "@netlify/functions";
import {
  assistantSettings,
  createAssistantHandler,
} from "../../vendor/formlane/server/assistant.ts";

export const config: Config = {
  path: "/api/assistant",
  rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
export default createAssistantHandler({
  settings: () => ({
    ...assistantSettings(),
    enabled: process.env.FORMLANE_ASSISTANT_ENABLED !== "false",
  }),
});
