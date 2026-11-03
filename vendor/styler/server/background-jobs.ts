import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { generateStyle, GenerationError, parseGenerationRequest } from './generation.ts';

export const JOB_WAIT_MS = 150_000;
export const JOB_RETENTION_MS = 24 * 60 * 60 * 1000;
export const JOB_ID = /^\d{13}-[a-f0-9]{64}$/;
export interface JobStore {
  read<T>(key: string): Promise<T | null>;
  write(key: string, value: unknown): Promise<void>;
  claim(key: string): Promise<boolean>;
  keys(): AsyncIterable<string>;
  delete(key: string): Promise<void>;
}
type Input = { createdAt: number; request: ReturnType<typeof parseGenerationRequest> };
type Result = { status: number; body: object };
type Dependencies = {
  store: JobStore;
  key: () => string | undefined;
  dispatch: (jobId: string, signature: string) => Promise<void>;
  run?: typeof generateStyle;
  now?: () => number;
};
const json = (body: object, status = 200) => Response.json(body, { status,
  headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
const failure = (error: unknown): Result => error instanceof GenerationError
  ? { status: error.status, body: { error: error.message } }
  : { status: 502, body: { error: 'Provider unavailable.' } };

async function body(request: Request, limit = 98_304): Promise<unknown> {
  if (!request.body) throw new GenerationError('Invalid generation request.', 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > limit) { await reader.cancel(); throw new GenerationError('Request too large.', 413); }
    chunks.push(next.value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new GenerationError('Invalid generation request.', 400); }
}
function check(request: Request, method: string) {
  if (request.method !== method) return json({ error: `${method} required.` }, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, 403);
  if (method === 'POST' && request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    return json({ error: 'JSON required.' }, 415);
  }
}
function sign(jobId: string, key: string) {
  return createHmac('sha256', key).update(`styler-background-v1:${jobId}`).digest('hex');
}

export function createBackgroundApi({ store, key, dispatch, run = generateStyle, now = Date.now }: Dependencies) {
  return {
    async start(request: Request): Promise<Response> {
      const rejected = check(request, 'POST'); if (rejected) return rejected;
      try {
        const input = parseGenerationRequest(await body(request));
        const secret = key();
        if (!secret?.trim()) throw new GenerationError('Missing server API key.', 503);
        const createdAt = now();
        const jobId = `${createdAt}-${randomBytes(32).toString('hex')}`;
        await store.write(`${jobId}/input`, { createdAt, request: input } satisfies Input);
        // Dispatch once. An ambiguous network failure must never trigger a second invocation.
        await dispatch(jobId, sign(jobId, secret));
        return json({ jobId, status: 'pending' }, 202);
      } catch (error) { const result = failure(error); return json(result.body, result.status); }
    },
    async status(request: Request): Promise<Response> {
      const rejected = check(request, 'GET'); if (rejected) return rejected;
      const jobId = new URL(request.url).searchParams.get('job') ?? '';
      if (!JOB_ID.test(jobId)) return json({ error: 'Invalid generation request.' }, 400);
      try {
        const input = await store.read<Input>(`${jobId}/input`);
        if (!input) return json({ error: 'Generation failed. Retry manually.' }, 404);
        if (now() - input.createdAt > JOB_RETENTION_MS) return json({ error: 'Generation timed out.' }, 410);
        const result = await store.read<Result>(`${jobId}/result`);
        if (result) return json(result.body, result.status);
        if (now() - input.createdAt >= JOB_WAIT_MS) return json({ error: 'Generation timed out.' }, 504);
        return json({ status: 'pending' }, 202);
      } catch { return json({ error: 'Provider unavailable.' }, 502); }
    },
    async work(request: Request): Promise<Response> {
      const rejected = check(request, 'POST'); if (rejected) return rejected;
      try {
        const payload = await body(request, 1024);
        const jobId = (payload as { jobId?: unknown } | null)?.jobId;
        const signature = request.headers.get('x-styler-signature') ?? '';
        const secret = key();
        if (typeof jobId !== 'string' || !JOB_ID.test(jobId) || !secret || !/^[a-f0-9]{64}$/.test(signature)
          || !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(jobId, secret), 'hex'))) return json({ error: 'Forbidden.' }, 403);
        const input = await store.read<Input>(`${jobId}/input`);
        if (!input || now() - input.createdAt >= JOB_WAIT_MS) return new Response(null, { status: 204 });
        // Atomic create in shared storage, not a per-instance ref. Never reclaim:
        // platform redelivery after a crash must not repeat a possibly paid call.
        if (!await store.claim(`${jobId}/claim`)) return new Response(null, { status: 204 });
        let result: Result;
        try { result = { status: 200, body: await run(input.request, { key: secret }) }; }
        catch (error) { result = failure(error); }
        await store.write(`${jobId}/result`, result);
      } catch {
        // Leave claimed jobs unreplayed if storage fails; polling has a finite deadline.
        console.error('Background generation could not finish.');
      }
      // Contain failures so platform retries cannot become automatic AI retries.
      return new Response(null, { status: 204 });
    },
    async cleanup(): Promise<Response> {
      const cutoff = now() - JOB_RETENTION_MS;
      for await (const name of store.keys()) {
        const jobId = name.split('/')[0]!;
        if (JOB_ID.test(jobId) && Number(jobId.slice(0, 13)) < cutoff) await store.delete(name);
      }
      return new Response(null, { status: 204 });
    },
  };
}
