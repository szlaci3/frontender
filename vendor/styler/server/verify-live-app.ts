// Explicit paid verification only: one batch of currently enabled AI expressions.
// Never imported by startup/offline tests. No retries, including partial failures.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Request } from '@playwright/test';
import { parseStyle } from '../shared/style.ts';
import { AI_CONCURRENCY, AI_RESULTS_PER_BATCH, RESULTS_PER_BATCH } from '../shared/generation.ts';
import { parseGenerationRequest } from './generation.ts';
import { AGENT, isRecord, numericUsage } from './probe-contract.ts';

const args = process.argv.slice(2);
if (args.length && !(args.length === 1 && args[0] === '--inspiration')) throw new Error('Usage: node server/verify-live-app.ts [--inspiration]');
const inspirationMode = args[0] === '--inspiration';
const server = spawn(process.execPath, ['server/dev.ts'], { env: { ...process.env, STYLER_PORT: '5175' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
server.stdout.on('data', chunk => { logs += chunk.toString(); });
server.stderr.on('data', () => {}); // Raw provider/server text is never printed.
let browser;
let deadline: ReturnType<typeof setTimeout> | undefined;
const evidence: Record<string, unknown> = { timestampUtc: new Date().toISOString(), agent: AGENT, mode: inspirationMode ? 'inspiration' : 'standard',
  expectedAICalls: AI_RESULTS_PER_BATCH, configuredConcurrency: AI_CONCURRENCY, cost: 'unavailable', hosting: 'local only' };
const samples: Record<string, unknown>[] = [];
try {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { clearInterval(poll); reject(new Error('Verification server startup timed out.')); }, 30_000);
    const poll = setInterval(() => { if (logs.includes('Styler local:')) { clearTimeout(timeout); clearInterval(poll); resolve(); } }, 100);
    server.once('exit', () => { clearTimeout(timeout); clearInterval(poll); reject(new Error('Verification server could not start; no request sent.')); });
  });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const requests = new Map<Request, { captured: ReturnType<typeof parseGenerationRequest>; start: number }>();
  const active = new Set<Request>();
  let peak = 0, started = 0;
  let complete!: () => void;
  const allResponses = new Promise<void>(resolve => { complete = resolve; });
  page.on('request', request => {
    if (!request.url().endsWith('/api/generate')) return;
    requests.set(request, { captured: parseGenerationRequest(request.postDataJSON()), start: performance.now() });
    active.add(request); peak = Math.max(peak, active.size);
  });
  page.on('requestfailed', request => {
    const entry = requests.get(request);
    if (!entry || !active.delete(request)) return;
    samples.push({ slot: entry.captured.id, valid: false, error: 'Network request failed.', elapsedMs: Math.round(performance.now() - entry.start) });
    if (samples.length === AI_RESULTS_PER_BATCH) complete();
  });
  page.on('response', response => {
    const entry = requests.get(response.request());
    if (!entry) return;
    active.delete(response.request());
    void (async () => {
      const sample: Record<string, unknown> = { slot: entry.captured.id, expression: entry.captured.expression, httpStatus: response.status(), valid: false,
        startOffsetMs: Math.round(entry.start - started), completionOffsetMs: Math.round(performance.now() - started) };
      try {
        const data: unknown = await response.json();
        if (!response.ok() || !isRecord(data)) throw new Error();
        const style = parseStyle(data.style);
        const constraintsValid = entry.captured.snapshot.every(c => {
          const value = style.rules.find(r => r.selectorId === c.selectorId)?.declarations.find(d => d.property === c.property)?.value;
          return c.state === 'locked' ? value === c.value : value === undefined;
        });
        sample.valid = style.id === entry.captured.id && style.provenance === 'antigravity' && constraintsValid;
        sample.constraintsValid = constraintsValid;
        sample.inspirationSnapshotValid = !inspirationMode || entry.captured.inspiration?.id === 'S4';
        if (isRecord(data.metrics)) {
          sample.usage = numericUsage(data.metrics.usage);
          if (typeof data.metrics.elapsedMs === 'number') sample.providerElapsedMs = data.metrics.elapsedMs;
        }
      } catch { sample.error = 'Generation failed or invalid result.'; }
      finally {
        sample.elapsedMs = Math.round(performance.now() - entry.start);
        samples.push(sample);
        if (samples.length === AI_RESULTS_PER_BATCH) complete();
      }
    })();
  });
  await page.goto('http://127.0.0.1:5175');
  await page.getByRole('button', { name: 'Lock button background-color', exact: true }).click();
  await page.getByRole('button', { name: 'Unset card padding-top', exact: true }).click();
  if (inspirationMode) await page.getByRole('button', { name: 'Use S4 as inspiration', exact: true }).click();
  if (requests.size) throw new Error('Unexpected request before Generate.');
  started = performance.now();
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.locator('[data-slot="G2"] .style-card').waitFor({ state: 'attached' });
  evidence.jokerReadyMs = Math.round(performance.now() - started);
  await page.locator('[data-slot="G3"] .style-card').waitFor({ state: 'attached' });
  evidence.harlequinReadyMs = Math.round(performance.now() - started);
  if (inspirationMode) await page.getByRole('button', { name: 'Use S2 as inspiration', exact: true }).click();
  await Promise.race([allResponses, new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('Live batch verification timed out.')), 310_000); })]);
  clearTimeout(deadline);
  await page.getByRole('button', { name: 'Generate', exact: true }).waitFor();
  const readyCards = await page.locator('[data-slot] .style-card').count();
  const generatedSlots = await page.locator('[data-slot]').count();
  const contexts = [...requests.values()].map(({ captured }) => JSON.stringify({ constraints: captured.snapshot, inspiration: captured.inspiration }));
  evidence.requestCount = requests.size;
  evidence.generatedSlots = generatedSlots;
  evidence.readyCards = readyCards;
  evidence.peakConcurrentRequests = peak;
  evidence.sharedSnapshotValid = contexts.length === AI_RESULTS_PER_BATCH && new Set(contexts).size === 1;
  evidence.firstAIReadyMs = Math.min(...samples.map(sample => Number(sample.completionOffsetMs)));
  evidence.fullBatchMs = Math.round(performance.now() - started);
  evidence.completionOrder = samples.map(sample => sample.slot);
  evidence.samples = samples;
  const firstValid = samples.find(sample => sample.valid);
  if (firstValid) await page.locator(`[data-slot="${firstValid.slot}"] .style-card`).click();
  await mkdir('verification-results', { recursive: true });
  await page.screenshot({ path: 'verification-results/m15-live-batch.png' });
  if (requests.size !== AI_RESULTS_PER_BATCH || generatedSlots !== RESULTS_PER_BATCH + 1 || readyCards !== RESULTS_PER_BATCH + 1 || peak > AI_CONCURRENCY || !evidence.sharedSnapshotValid
    || samples.some(sample => !sample.valid || !sample.inspirationSnapshotValid)) throw new Error('Live batch had failed slots or violated acceptance checks; evidence retained.');
} catch (error) {
  evidence.error = error instanceof Error ? error.message : 'Live batch verification failed.';
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  const serverReports = logs.split(/\r?\n/).flatMap(line => {
    try { const value = JSON.parse(line); return typeof value.requestId === 'string' && value.agent === AGENT ? [value] : []; }
    catch { return []; }
  });
  evidence.samples = samples;
  evidence.serverReports = serverReports;
  evidence.totalTokens = serverReports.reduce((sum, report) => sum + (numericUsage(report.usage)?.total_tokens ?? 0), 0);
  await mkdir('verification-results', { recursive: true });
  await writeFile('verification-results/m15-live-measurements.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  await browser?.close();
  server.kill();
}
