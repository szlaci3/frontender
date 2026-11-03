// Deliberately small M1 contract, not the full M3 application style schema.
export const AGENT = 'antigravity-preview-09-2026';
export const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
export const TOKEN_BUDGET = 6000;
export const TIMEOUT_MS = 90_000;

export const probeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    page: {
      type: 'object', additionalProperties: false,
      properties: { color: { type: 'string' }, 'background-color': { type: 'string' } },
      required: ['color', 'background-color'],
    },
    button: {
      type: 'object', additionalProperties: false,
      properties: {
        color: { type: 'string' }, 'background-color': { type: 'string' },
        'border-radius': { type: 'string', enum: ['12px'] },
      },
      required: ['color', 'background-color', 'border-radius'],
    },
  },
  required: ['name', 'page', 'button'],
};

export function makeProbeRequest(schemaEnforced = true) {
  return {
    agent: AGENT,
    environment: 'remote',
    background: false,
    tools: [],
    agent_config: { type: 'antigravity', max_total_tokens: TOKEN_BUDGET },
    input: 'Return only one compact JSON object defining a coherent visual style for a fictional studio website. '
      + 'Do not use tools, browse, write files, or execute code. '
      + 'Use this exact shape: {"name":"short name","page":{"color":"#RRGGBB","background-color":"#RRGGBB"},'
      + '"button":{"color":"#RRGGBB","background-color":"#RRGGBB","border-radius":"12px"}}. '
      + 'All colors must be six-digit hex. Locked constraint: button border-radius is exactly 12px. '
      + 'Unset constraint: omit button border-width entirely. No extra keys, Markdown, or explanation.',
    ...(schemaEnforced ? {
      response_format: { type: 'text', mime_type: 'application/json', schema: probeSchema },
    } : {}),
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

export function validateProbeStyle(value: unknown): boolean {
  if (!isRecord(value) || !exactKeys(value, ['name', 'page', 'button'])) return false;
  if (typeof value.name !== 'string' || !/^[\p{L}\p{N} .'-]{1,80}$/u.test(value.name)) return false;
  const { page, button } = value;
  if (!isRecord(page) || !isRecord(button)) return false;
  if (!exactKeys(page, ['color', 'background-color'])) return false;
  if (!exactKeys(button, ['color', 'background-color', 'border-radius'])) return false;
  return [page.color, page['background-color'], button.color, button['background-color']]
    .every(color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))
    && button['border-radius'] === '12px';
}

// Only extract final text outputs; never parse tool results or reasoning as styles.
export function extractOutputText(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  if (Array.isArray(value.steps)) {
    const finalOutput = value.steps.filter(isRecord).findLast(step => step.type === 'model_output');
    if (!finalOutput || !Array.isArray(finalOutput.content)) return undefined;
    const parts = finalOutput.content.filter(isRecord)
      .filter(part => part.type === 'text' && typeof part.text === 'string')
      .map(part => part.text as string);
    return parts.length ? parts.join('') : undefined;
  }
  if (typeof value.output_text === 'string') return value.output_text;
  if (!Array.isArray(value.outputs)) return undefined;
  const parts = value.outputs.filter(isRecord)
    .filter(part => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text as string);
  return parts.length ? parts.join('') : undefined;
}

export function sanitize(value: string, secret?: string): string {
  const redacted = secret ? value.split(secret).join('[REDACTED]') : value;
  return redacted.replace(/AIza[\w-]+/g, '[REDACTED]')
    .replace(/[\r\n\t]+/g, ' ').slice(0, 600);
}

// Logs include token counts only, never arbitrary response fields/transcripts.
export function numericUsage(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  const counts = Object.fromEntries(Object.entries(value)
    .filter(([key, count]) => /^[a-z_]*tokens$/.test(key) && typeof count === 'number' && Number.isFinite(count)));
  return Object.keys(counts).length ? counts as Record<string, number> : undefined;
}
