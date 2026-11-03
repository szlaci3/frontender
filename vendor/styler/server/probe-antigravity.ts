import { AGENT, ENDPOINT, TOKEN_BUDGET, TIMEOUT_MS, makeProbeRequest, isRecord,
  extractOutputText, validateProbeStyle, sanitize, numericUsage } from './probe-contract.ts';

// Explicit manual command only. One request, no retries, no model substitution.
const args = process.argv.slice(2);
const inspectId = args[0] === '--inspect' && args.length === 2 && /^[A-Za-z0-9_-]{1,250}$/.test(args[1] ?? '')
  ? args[1] : undefined;
if (!inspectId && !(args.length === 0 || (args.length === 1 && args[0] === '--plain'))) {
  console.error('Usage: npm run probe:antigravity -- [--plain | --inspect INTERACTION_ID]');
  process.exit(1);
}
const key = process.env.GEMINI_API_KEY;
if (!key?.trim()) {
  console.error('Missing server-side GEMINI_API_KEY. No request sent.');
  process.exit(1);
}

const schemaEnforced = !args.includes('--plain');
const started = performance.now();
const report: Record<string, unknown> = {
  timestampUtc: new Date().toISOString(), requestedAgent: AGENT,
  mode: inspectId ? 'inspect-existing' : schemaEnforced ? 'json-schema' : 'prompt-json',
  requestedTokenBudget: inspectId ? undefined : TOKEN_BUDGET, timeoutMs: TIMEOUT_MS,
  approximateCost: 'unavailable',
};

try {
  const response = await fetch(inspectId ? `${ENDPOINT}/${inspectId}` : ENDPOINT, {
    method: inspectId ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: inspectId ? undefined : JSON.stringify(makeProbeRequest(schemaEnforced)),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'error',
  });
  report.httpStatus = response.status;
  report.contentType = response.headers.get('content-type');
  // Response is bounded independently of the provider's token budget.
  const reader = response.body?.getReader();
  let body = '';
  if (reader) {
    const decoder = new TextDecoder();
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) { body += decoder.decode(); break; }
      bytes += chunk.value.byteLength;
      if (bytes > 1_048_576) { await reader.cancel(); throw new Error('Response exceeded 1 MiB probe limit.'); }
      body += decoder.decode(chunk.value, { stream: true });
    }
  }
  let data: unknown;
  try { data = JSON.parse(body); } catch { throw new Error('Provider returned a non-JSON response; body withheld.'); }
  if (!isRecord(data)) throw new Error('Provider returned an unexpected response envelope.');
  report.responseKeys = Object.keys(data).map(name => sanitize(name, key));
  if (isRecord(data.usage)) report.usage = numericUsage(data.usage);
  if (!response.ok) {
    const error = isRecord(data.error) ? data.error : {};
    report.outcome = 'http-error';
    report.error = {
      code: typeof error.code === 'number' ? error.code : undefined,
      status: typeof error.status === 'string' ? sanitize(error.status, key) : undefined,
      message: typeof error.message === 'string' ? sanitize(error.message, key) : 'Provider error; body withheld.',
    };
    process.exitCode = 1;
  } else {
    report.interactionId = typeof data.id === 'string' ? sanitize(data.id, key) : undefined;
    report.returnedAgent = typeof data.agent === 'string' ? sanitize(data.agent, key) : undefined;
    report.status = typeof data.status === 'string' ? sanitize(data.status, key) : undefined;
    report.outputTypes = Array.isArray(data.outputs)
      ? data.outputs.filter(isRecord).map(part => typeof part.type === 'string' ? sanitize(part.type, key) : 'unknown')
      : undefined;
    report.stepTypes = Array.isArray(data.steps)
      ? data.steps.filter(isRecord).map(step => typeof step.type === 'string' ? sanitize(step.type, key) : 'unknown')
      : undefined;
    report.returnedTokenBudget = isRecord(data.agent_config) ? data.agent_config.max_total_tokens : undefined;
    report.returnedResponseFormat = isRecord(data.response_format) ? {
      type: data.response_format.type, mimeType: data.response_format.mime_type,
      schemaPresent: isRecord(data.response_format.schema),
    } : undefined;
    const text = extractOutputText(data);
    let style: unknown;
    try { style = text === undefined ? undefined : JSON.parse(text); } catch { /* Invalid output stays invalid. */ }
    report.validStyle = validateProbeStyle(style);
    report.agentConfirmed = data.agent === AGENT;
    report.outcome = data.status === 'completed' && report.validStyle && report.agentConfirmed
      ? 'success' : 'invalid-or-incomplete';
    // Intentionally withhold raw output, tool content, and full provider envelope.
    if (report.outcome !== 'success') process.exitCode = 1;
  }
} catch (error) {
  report.outcome = 'transport-or-response-error';
  report.error = error instanceof Error ? sanitize(error.message, key) : 'Unknown failure; details withheld.';
  if (error instanceof Error && isRecord(error.cause) && typeof error.cause.code === 'string') {
    report.transportCode = sanitize(error.cause.code, key);
  }
  process.exitCode = 1;
} finally {
  report.elapsedMs = Math.round(performance.now() - started);
  console.log(JSON.stringify(report, null, 2));
}
