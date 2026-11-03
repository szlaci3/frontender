const jobPattern = /^\d{13}-[a-f0-9]{64}$/;

async function dataFrom(response: Response) {
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Invalid generated style.');
  if (!response.ok) throw new Error(typeof (data as { error?: unknown }).error === 'string'
    ? (data as { error: string }).error : 'Generation failed. Retry manually.');
  return data as Record<string, unknown>;
}
function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new Error('Generation timed out.')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 2000);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

// The local API returns a result directly. Netlify acknowledges one job and the
// client polls only its status; polling never resubmits generation.
export async function requestStyle(input: object): Promise<unknown> {
  const response = await fetch('/api/styler/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input), signal: AbortSignal.timeout(100_000) });
  let data = await dataFrom(response);
  if (response.status !== 202) return data.style;
  const jobId = data.jobId;
  if (typeof jobId !== 'string' || !jobPattern.test(jobId)) throw new Error('Invalid generated style.');
  const deadline = AbortSignal.timeout(150_000);
  try {
    for (;;) {
      await pause(deadline);
      const poll = await fetch(`/api/generation-status?job=${encodeURIComponent(jobId)}`, {
        cache: 'no-store', signal: AbortSignal.any([deadline, AbortSignal.timeout(15_000)]),
      });
      data = await dataFrom(poll);
      if (poll.status !== 202) return data.style;
      if (data.status !== 'pending') throw new Error('Invalid generated style.');
    }
  } catch (error) {
    if (deadline.aborted || (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))) throw new Error('Generation timed out.');
    throw error;
  }
}

