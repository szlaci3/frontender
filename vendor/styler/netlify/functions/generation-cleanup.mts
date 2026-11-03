import type { Config, Context } from '@netlify/functions';
import { netlifyJobs } from '../../server/netlify-jobs.ts';

export default async (_request: Request, context: Context) => netlifyJobs(context).cleanup();
export const config: Config = { schedule: '0 * * * *' };
