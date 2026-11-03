import type { Config, Context } from "@netlify/functions";
import { netlifyJobs } from "../../server/netlify-jobs.ts";

export default async (request: Request, context: Context) =>
  netlifyJobs(context).status(request);
export const config: Config = { path: "/api/generation-status" };
