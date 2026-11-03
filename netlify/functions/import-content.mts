import type { Config } from "@netlify/functions";
export { default } from "../../vendor/formlane/netlify/functions/import-content.mts";
export const config: Config = {
  path: "/api/import-content",
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
