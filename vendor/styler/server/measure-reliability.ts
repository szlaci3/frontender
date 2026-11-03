// Explicit paid experiments only. Never imported by app startup. No retries.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { makeGenerationRequest, generateStyle, parseGeneratedOutput, GENERATION_SYSTEM_INSTRUCTION } from './generation.ts';
import { AGENT, ENDPOINT, extractOutputText, numericUsage, sanitize } from './probe-contract.ts';
import { parseStyle } from '../shared/style.ts';
import { presets } from '../src/styles/presets.ts';
import { ENABLED_EXPRESSIONS } from '../shared/generation.ts';

const [label, mode = 'app', countText = '1', lanesText = '1', gapText = '0', budgetText, context = 'paired', timeoutText = '90000', policy = 'app'] = process.argv.slice(2);
if (!label || !/^[a-z0-9-]+$/.test(label)) throw new Error('Use a lowercase experiment label.');
const count = Number(countText), lanes = Number(lanesText), gap = Number(gapText);
const timeoutMs = Number(timeoutText);
if (![90_000, 120_000, 180_000].includes(timeoutMs)) throw new Error('Use a 90, 120 or 180 second deadline.');
if (!['app', 'input-only', 'system', 'no-environment', 'system-no-environment'].includes(policy)) throw new Error('Invalid instruction policy.');
if (!['app', 'minimal', 'baseline'].includes(mode) || (mode === 'baseline' && (count > 3 || context !== 'paired')) || !['paired', 'varied'].includes(context) || !Number.isInteger(count) || count < 1 || count > 20 || ![1, 2].includes(lanes) || !Number.isFinite(gap) || gap < 0 || gap > 30000 || (budgetText && (!Number.isInteger(Number(budgetText)) || Number(budgetText) < 4000 || Number(budgetText) > 32000))) throw new Error('Invalid experiment settings.');
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error('Missing server key.');
const directory = `verification-results/reliability/${label}`;
await mkdir('verification-results/reliability', { recursive: true });
await mkdir(directory); // Never overwrite an earlier experiment's evidence.
const expressions = ENABLED_EXPRESSIONS;
const reports: object[] = [];
let cursor = 0, halted = false;
async function sample(index: number) {
  const inspiration = context === 'varied' ? presets[index % (presets.length + 1)] : index % 2 === 0 ? presets[0] : presets[3];
  const input = { id: `G${index + 100}`, snapshot: [{ selectorId: 'button', property: 'color', state: 'locked', value: '#abcdef' }, { selectorId: 'card', property: 'padding-top', state: 'unset' }], inspiration, expression: expressions[index % expressions.length] };
  const body: ReturnType<typeof makeGenerationRequest> = mode === 'baseline'
    ? JSON.parse(await readFile(`verification-results/reliability/baseline/${index}-request.json`, 'utf8'))
    : makeGenerationRequest(input);
  if (mode === 'minimal') body.input = body.input.replace(/Create a complete coordinated design[\s\S]*?Card border colors/, 'Use about 30 coordinated declarations, covering all selectors. Card border colors');
  if (budgetText) body.agent_config.max_total_tokens = Number(budgetText);
  if (policy === 'input-only') delete (body as Partial<typeof body>).system_instruction;
  if (policy.includes('system')) body.system_instruction = GENERATION_SYSTEM_INSTRUCTION;
  if (policy.includes('no-environment')) delete (body as Partial<typeof body>).environment;
  await writeFile(`${directory}/${index}-request.json`, JSON.stringify(body, null, 2));
  let observation: Record<string, unknown> = { index, expression: input.expression, inspiration: inspiration?.id, mode, lanes, gap, timeoutMs, policy, promptCharacters: body.input.length, systemInstructionCharacters: body.system_instruction?.length ?? 0, requestBytes: Buffer.byteLength(JSON.stringify(body)), budget: body.agent_config.max_total_tokens, requestedTokenBudget: body.agent_config.max_total_tokens };
  try {
    await generateStyle(input, { key, timeoutMs, fetcher: async (_url, init) => {
      const response = await fetch(ENDPOINT, { ...init, body: JSON.stringify(body) });
      const data = await response.clone().json();
      if (!response.ok && data.error) observation.providerError = {
        status: sanitize(String(data.error.status ?? 'unknown'), key),
        message: sanitize(String(data.error.message ?? 'Provider error.'), key),
        retryDelays: Array.isArray(data.error.details) ? data.error.details
          .map((detail: { retryDelay?: unknown }) => detail.retryDelay)
          .filter((delay: unknown) => typeof delay === 'string' && /^\d+(?:\.\d+)?s$/.test(delay)) : [],
      };
      const output = extractOutputText(data);
      let validJson = false, validRaw = false, validDecoded = false, declarations = 0;
      try { const parsed = JSON.parse(output ?? ''); validJson = true; parseStyle(parsed); validRaw = true; } catch { /* Legacy application-schema shape separately measured. */ }
      try { const style = parseGeneratedOutput(output ?? '', input.id); validDecoded = true; declarations = style.rules.reduce((n, r) => n + r.declarations.length, 0); } catch { /* Measured separately from envelope success. */ }
      observation = { ...observation, status: ['completed', 'incomplete', 'failed', 'cancelled', 'in_progress', 'requires_action'].includes(data.status) ? data.status : 'unknown', usage: numericUsage(data.usage), outputCharacters: output?.length ?? 0, validJson, validRaw, validDecoded, declarations,
        returnedTokenBudget: typeof data.agent_config?.max_total_tokens === 'number' ? data.agent_config.max_total_tokens : undefined,
        stepTypes: Array.isArray(data.steps) ? data.steps.map((s: { type?: string }) => sanitize(String(s.type), key)) : undefined,
        responseKeys: Object.keys(data).map(k => sanitize(k, key)), exactAgent: data.agent === AGENT };
      if (output) await writeFile(`${directory}/${index}-output.txt`, sanitizeOutput(output));
      return response;
    }, log: report => { observation = { ...report, ...observation }; } });
  } catch { /* generateStyle records a sanitized classification. */ }
  reports.push(observation);
  if ([400, 422].includes(Number(observation.httpStatus)) || ['Authentication failed.', 'Quota exceeded.', 'Missing server API key.'].includes(String(observation.outcome))) halted = true;
  await writeFile(`${directory}/measurements.json`, JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(observation));
}
function sanitizeOutput(value: string) { return value.split(key!).join('[REDACTED]').replace(/AIza[\w-]+/g, '[REDACTED]'); }
await Promise.all(Array.from({ length: lanes }, async () => {
  while (cursor < count && !halted) { const index = cursor++; await sample(index); if (gap && cursor < count && !halted) await new Promise(resolve => setTimeout(resolve, gap)); }
}));
process.exitCode = reports.some(report => !(report as { valid?: boolean }).valid) ? 1 : 0;
