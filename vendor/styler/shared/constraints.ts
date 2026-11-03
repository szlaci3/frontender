import { selectors, properties, parseStyle, declarationId, compileStyle, type Style, type SelectorId, type Property } from './style.ts';

export type Constraint = Readonly<{ selectorId: SelectorId; property: Property; state: 'locked'; value: string }
  | { selectorId: SelectorId; property: Property; state: 'unset' }>;
export type Snapshot = readonly Constraint[];

export function parseSnapshot(input: unknown): Snapshot {
  if (!Array.isArray(input) || input.length > Object.keys(selectors).length * Object.keys(properties).length) throw new Error('Invalid constraints.');
  const seen = new Set<string>();
  const result = input.map((entry: unknown): Constraint => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid constraints.');
    const c = entry as Record<string, unknown>;
    if (typeof c.selectorId !== 'string' || !Object.hasOwn(selectors, c.selectorId)
      || typeof c.property !== 'string' || !Object.hasOwn(properties, c.property)
      || (c.state !== 'locked' && c.state !== 'unset')
      || Object.keys(c).sort().join(',') !== (c.state === 'locked' ? 'property,selectorId,state,value' : 'property,selectorId,state')) throw new Error('Invalid constraints.');
    const selectorId = c.selectorId as SelectorId, property = c.property as Property;
    const id = declarationId(selectorId, property);
    if (seen.has(id)) throw new Error('Invalid constraints.');
    seen.add(id);
    if (c.state === 'unset') return Object.freeze({ selectorId, property, state: 'unset' });
    if (typeof c.value !== 'string' || c.value.length > 160 || !properties[property](c.value)) throw new Error('Invalid locked value.');
    return Object.freeze({ selectorId, property, state: 'locked', value: c.value });
  });
  // Canonical stylesheet order, independent of click/Map insertion order.
  result.sort((a, b) => Object.keys(selectors).indexOf(a.selectorId) - Object.keys(selectors).indexOf(b.selectorId)
    || Object.keys(properties).indexOf(a.property) - Object.keys(properties).indexOf(b.property));
  return Object.freeze(result);
}

export function toggleConstraint(snapshot: Snapshot, selectorId: SelectorId, property: Property, state: 'locked' | 'unset', value?: string): Snapshot {
  const old = snapshot.find(c => c.selectorId === selectorId && c.property === property);
  const next = snapshot.filter(c => c !== old);
  if (old?.state !== state) next.push(state === 'locked' ? { selectorId, property, state, value: value! } : { selectorId, property, state });
  return parseSnapshot(next);
}

export function lockStyle(snapshot: Snapshot): Style {
  const constraints = parseSnapshot(snapshot);
  return parseStyle({ schemaVersion: 1, id: 'Locks', name: 'Locks', provenance: 'seed', rules:
    Object.keys(selectors).map(selectorId => ({ selectorId, declarations: constraints.filter(c => c.selectorId === selectorId && c.state === 'locked')
      .map(c => ({ id: declarationId(c.selectorId, c.property), property: c.property, value: c.state === 'locked' ? c.value : '' })) })) });
}
export function compileLocks(snapshot: Snapshot) { return compileStyle(lockStyle(snapshot)); }

// Validate unsafe free values before normalization. Captured locks are injected;
// Unset removes declarations, never emits the CSS keyword unset.
export function constrainStyle(input: unknown, snapshot: Snapshot): Style {
  const style = parseStyle(input), constraints = parseSnapshot(snapshot);
  const rules = style.rules.map(rule => ({ selectorId: rule.selectorId, declarations: rule.declarations.filter(d =>
    !constraints.some(c => c.selectorId === rule.selectorId && c.property === d.property)).map(d => ({ ...d })) }));
  for (const c of constraints) if (c.state === 'locked') {
    let rule = rules.find(r => r.selectorId === c.selectorId);
    if (!rule) { rule = { selectorId: c.selectorId, declarations: [] }; rules.push(rule); }
    rule.declarations.push({ id: declarationId(c.selectorId, c.property), property: c.property, value: c.value });
  }
  return parseStyle({ ...style, rules });
}
