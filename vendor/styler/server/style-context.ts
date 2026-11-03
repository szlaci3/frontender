import type { Style } from '../shared/style.ts';

// Preserve selector/declaration order and every value without repeating IDs,
// provenance and object field names in model context. Never used as instructions.
export function compactStyleContext(style: Style) {
  return Object.fromEntries(style.rules.map(rule => [rule.selectorId,
    Object.fromEntries(rule.declarations.map(declaration => [declaration.property, declaration.value]))]));
}
