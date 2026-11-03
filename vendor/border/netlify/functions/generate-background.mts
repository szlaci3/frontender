import type { Config, Context } from "@netlify/functions";
import { netlifyJobs } from "../../server/netlify-jobs.ts";

export default async (request: Request, context: Context) =>
  netlifyJobs(context).work(request);
export const config: Config = { background: true };
