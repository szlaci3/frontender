import type { Config, Context } from "@netlify/functions";
import { netlifyJobs } from "../../vendor/border/server/netlify-jobs.ts";
export default async (request: Request, context: Context) =>
  netlifyJobs(context).start(request);
export const config: Config = {
  path: "/api/border/generate",
  rateLimit: { windowSize: 60, windowLimit: 10, aggregateBy: ["ip", "domain"] },
};
