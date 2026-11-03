// Closed vocabulary shared by browser and server. No DOM or provider dependencies.
export const selectors = {
  page: '.sample-page',
  heading: '.sample-heading',
  accent: '.sample-heading em',
  copy: '.sample-copy',
  button: '.sample-button',
  card: '.sample-card',
  input: '.sample-input',
  eyebrow: '.sample-eyebrow',
  details: '.sample-nav-link, .sample-hero-note, .sample-section-count, .sample-card-link, .sample-space-detail, .sample-switch-label, .sample-form-feedback, .sample-footer, .sample-footer > span:first-child, .sample-field-label, .sample-plan-note, .sample-faq summary',
  switch: '.sample-switch-label input:checked + .sample-switch-track',
  subheading: '.sample-subheading',
  image: '.sample-image',
} as const;
export type SelectorId = keyof typeof selectors;
export const fonts = ['Georgia, serif', "'Segoe UI', Arial, sans-serif", "'Courier New', monospace"] as const;

const color = (value: string) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
function pixels(value: string, min: number, max: number) {
  return /^-?\d+(?:\.\d{1,2})?px$/.test(value) && Number.parseFloat(value) >= min && Number.parseFloat(value) <= max;
}
const spacing = (value: string) => pixels(value, 0, 48);
const borderWidth = (value: string) => pixels(value, 0, 6);
const borderStyle = (value: string) => ['solid', 'dashed', 'dotted', 'double', 'none'].includes(value);
function shadow(value: string) {
  if (value === 'none') return true;
  const parts = value.split(' ');
  return parts.length === 5 && pixels(parts[0]!, -16, 16) && pixels(parts[1]!, -16, 16)
    && pixels(parts[2]!, 0, 64) && pixels(parts[3]!, 0, 16) && color(parts[4]!);
}
export const properties = {
  color, 'background-color': color,
  'font-family': (value: string) => (fonts as readonly string[]).includes(value),
  'font-size': (value: string) => pixels(value, 8, 72),
  // Transitions can produce fractional weights; captured locks must retain them.
  'font-weight': (value: string) => /^\d{3}(?:\.\d{1,2})?$/.test(value) && +value >= 400 && +value <= 800,
  'font-style': (value: string) => ['normal', 'italic'].includes(value),
  'line-height': (value: string) => /^\d(?:\.\d{1,2})?$/.test(value) && +value >= 1 && +value <= 2,
  'letter-spacing': (value: string) => pixels(value, -3, 6),
  'padding-top': spacing, 'padding-right': spacing, 'padding-bottom': spacing, 'padding-left': spacing,
  'row-gap': spacing, 'column-gap': spacing,
  'border-top-width': borderWidth, 'border-right-width': borderWidth,
  'border-bottom-width': borderWidth, 'border-left-width': borderWidth,
  'border-top-color': color, 'border-right-color': color, 'border-bottom-color': color, 'border-left-color': color,
  'border-top-style': borderStyle, 'border-right-style': borderStyle,
  'border-bottom-style': borderStyle, 'border-left-style': borderStyle,
  'border-top-left-radius': spacing, 'border-top-right-radius': spacing,
  'border-bottom-right-radius': spacing, 'border-bottom-left-radius': spacing,
  'box-shadow': shadow,
} as const;
export type Property = keyof typeof properties;
export type Declaration = Readonly<{ id: string; property: Property; value: string }>;
export type StyleRule = Readonly<{ selectorId: SelectorId; declarations: readonly Declaration[] }>;
export type Style = Readonly<{
  schemaVersion: 1; id: string; name: string;
  provenance: 'preset' | 'seed' | 'joker' | 'harlequin' | 'antigravity';
  rules: readonly StyleRule[];
}>;

export function declarationId(selectorId: SelectorId, property: Property) {
  return `${selectorId}:${property}`;
}
function record(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
}
function keys(value: Record<string, unknown>, expected: readonly string[]) {
  return Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}
function invalid(): never { throw new Error('Invalid style definition.'); }

// Validate and copy at the trust boundary. No untrusted values are echoed in errors.
// Omitted declarations stay omitted; original rule/declaration source order is retained.
export function parseStyle(input: unknown): Style {
  if (!record(input) || !keys(input, ['schemaVersion', 'id', 'name', 'provenance', 'rules'])) invalid();
  if (input.schemaVersion !== 1 || typeof input.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(input.id)) invalid();
  if (typeof input.name !== 'string' || !/^[\p{L}\p{N} .'-]{1,64}$/u.test(input.name) || !input.name.trim()) invalid();
  if (!['preset', 'seed', 'joker', 'harlequin', 'antigravity'].includes(input.provenance as string)) invalid();
  if (!Array.isArray(input.rules) || input.rules.length > Object.keys(selectors).length) invalid();
  const seenSelectors = new Set<string>();
  const rules = input.rules.map((rule: unknown): StyleRule => {
    if (!record(rule) || !keys(rule, ['selectorId', 'declarations'])) invalid();
    if (typeof rule.selectorId !== 'string' || !Object.hasOwn(selectors, rule.selectorId) || seenSelectors.has(rule.selectorId)) invalid();
    seenSelectors.add(rule.selectorId);
    const selectorId = rule.selectorId as SelectorId;
    if (!Array.isArray(rule.declarations) || rule.declarations.length > Object.keys(properties).length) invalid();
    const seenProperties = new Set<string>();
    const declarations = rule.declarations.map((entry: unknown): Declaration => {
      if (!record(entry) || !keys(entry, ['id', 'property', 'value'])) invalid();
      if (typeof entry.property !== 'string' || !Object.hasOwn(properties, entry.property) || seenProperties.has(entry.property)) invalid();
      seenProperties.add(entry.property);
      const property = entry.property as Property;
      if (entry.id !== declarationId(selectorId, property) || typeof entry.value !== 'string'
        || entry.value.length > 160 || !properties[property](entry.value)) invalid();
      return Object.freeze({ id: entry.id as string, property, value: entry.value });
    });
    return Object.freeze({ selectorId, declarations: Object.freeze(declarations) });
  });
  return Object.freeze({ schemaVersion: 1, id: input.id, name: input.name,
    provenance: input.provenance as Style['provenance'], rules: Object.freeze(rules) });
}

export function compileStyle(input: unknown): string {
  const style = parseStyle(input);
  return style.rules.map(rule => {
    const scopedSelector = selectors[rule.selectorId].split(', ').map(selector => `.preview-root ${selector}`).join(', ');
    return `${scopedSelector} { ${rule.declarations.map(entry => `${entry.property}: ${entry.value};`).join(' ')} }`;
  }).join('\n');
}
