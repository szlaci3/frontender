import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { createBackgroundApi, type JobStore } from './background-jobs.ts';

export function netlifyJobs(context?: Pick<Context, 'deploy' | 'site'>) {
  const blobs = getStore({ name: 'styler-generation-jobs', consistency: 'strong' });
  const store: JobStore = {
    read: <T>(name: string) => blobs.get(name, { type: 'json' }) as Promise<T | null>,
    write: async (name, value) => { await blobs.setJSON(name, value); },
    claim: async name => (await blobs.set(name, 'claimed', { onlyIfNew: true })).modified,
    async *keys() { for await (const page of blobs.list({ paginate: true })) for (const blob of page.blobs) yield blob.key; },
    delete: name => blobs.delete(name),
  };
  return createBackgroundApi({ store, key: () => process.env.GEMINI_API_KEY,
    dispatch: async (jobId, signature) => {
      // Use trusted runtime metadata for this exact deploy. DEPLOY_URL is not
      // guaranteed at runtime; client Host/Origin/forwarded headers are untrusted.
      const deploy = context?.deploy.id, site = context?.site.name;
      if (!deploy || !site || !/^[a-zA-Z0-9-]+$/.test(deploy) || !/^[a-zA-Z0-9-]+$/.test(site)) throw new Error('Missing deploy context.');
      const origin = new URL(`https://${deploy}--${site}.netlify.app`);
      const response = await fetch(new URL('/.netlify/functions/styler-background', origin), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-styler-signature': signature },
        body: JSON.stringify({ jobId }), redirect: 'error', signal: AbortSignal.timeout(10_000),
      });
      if (response.status !== 202) throw new Error('Worker dispatch failed.');
    },
  });
}
