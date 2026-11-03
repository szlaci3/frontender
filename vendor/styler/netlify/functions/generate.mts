import type { Config, Context } from '@netlify/functions';
import { netlifyJobs } from '../../server/netlify-jobs.ts';

export default async (request: Request, context?: Context) => {
  if (new URL(request.url).pathname === '/api/health') return Response.json(
    request.method === 'GET' ? { status: 'ok', service: 'styler-netlify', generation: 'background' } : { error: 'GET required.' },
    { status: request.method === 'GET' ? 200 : 405, headers: { 'Cache-Control': 'no-store' } });
  return netlifyJobs(context).start(request);
};
export const config: Config = { path: ['/api/generate', '/api/health'] };
