import type { Config, Context } from "@netlify/functions";
import { netlifyJobs } from "../../vendor/border/server/netlify-jobs.ts";
export default async (request: Request, context: Context) =>
  netlifyJobs(context).cleanup();
export const config: Config = { schedule: "0 * * * *" };
