import type { IncomingMessage, ServerResponse } from 'node:http';
import { generateStyle, GenerationError } from './generation.ts';
import { AI_CONCURRENCY } from '../shared/generation.ts';

export function createGenerationApi(run: typeof generateStyle = generateStyle) {
  let active = 0;
  return async function generationApi(request: IncomingMessage, response: ServerResponse) {
    const send = (status: number, body: object) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(body));
    };
    if (request.method !== 'POST') { send(405, { error: 'POST required.' }); return; }
    if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) { send(403, { error: 'Invalid request origin.' }); return; }
    if (request.headers['content-type'] !== 'application/json') { send(415, { error: 'JSON required.' }); return; }
    if (active >= AI_CONCURRENCY) { send(409, { error: 'Generation capacity reached.' }); return; }
    active++;
    try {
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of request) {
        size += Buffer.byteLength(chunk);
        if (size > 98_304) { send(413, { error: 'Request too large.' }); return; }
        chunks.push(Buffer.from(chunk));
      }
      let input: unknown;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new GenerationError('Invalid generation request.', 400); }
      const result = await run(input);
      send(200, result);
    } catch (error) {
      send(error instanceof GenerationError ? error.status : 502, { error: error instanceof GenerationError ? error.message : 'Provider unavailable.' });
    } finally { active--; }
  };
}
export const generationApi = createGenerationApi();
