import { parseStyle, type Property, type Style } from '../../shared/style.ts';
import { constrainStyle, parseSnapshot, type Snapshot } from '../../shared/constraints.ts';
import { presets, seedStyle } from '../styles/presets.ts';

export function makeJoker(seed: number, snapshot: Snapshot, id: string, inspiration: Style | null = null) {
  return makeLocalStyle(seed, snapshot, id, inspiration, 'joker', 20);
}

export function makeHarlequin(seed: number, snapshot: Snapshot, id: string, inspiration: Style | null = null) {
  return makeLocalStyle(seed, snapshot, id, inspiration, 'harlequin', 40);
}

function makeLocalStyle(seed: number, snapshot: Snapshot, id: string, inspiration: Style | null, kind: 'joker' | 'harlequin', deviation: number) {
  const captured = parseSnapshot(snapshot);
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  const base = inspiration ? parseStyle(inspiration) : presets[Math.floor(random() * presets.length)]!;
  const inspiredColor = (hex: string) => {
    const expanded = hex.length === 4 ? '#' + [...hex.slice(1)].map(c => c + c).join('') : hex;
    return '#' + [1, 3, 5].map(offset => {
      const original = parseInt(expanded.slice(offset, offset + 2), 16);
      const min = Math.max(0, original - deviation), max = Math.min(255, original + deviation);
      return (min + Math.floor(random() * (max - min + 1))).toString(16).padStart(2, '0');
    }).join('') + expanded.slice(7);
  };
  const colors = new Map<string, string>();
  const varyColor = (hex: string) => {
    const key = (hex.length === 4 ? '#' + [...hex.slice(1)].map(c => c + c).join('') : hex).toLowerCase();
    if (!colors.has(key)) colors.set(key, inspiredColor(key));
    return colors.get(key)!;
  };
  const colorRelated = (property: string) => property === 'color' || property.endsWith('-color') || property === 'box-shadow';
  // Resolve each declaration independently, including sparse AI inspiration.
  // Preserve base non-color values and ordering; fill missing palette entries.
  const sources = new Map(seedStyle.rules.map(rule => [rule.selectorId, rule.declarations.filter(d => colorRelated(d.property))]));
  for (const rule of inspiration ? base.rules : []) {
    const entries = new Map((sources.get(rule.selectorId) ?? []).map(d => [d.property, d]));
    for (const d of rule.declarations) if (colorRelated(d.property)) entries.set(d.property, d);
    sources.set(rule.selectorId, [...entries.values()]);
  }
  const paletteRules = base.rules.map(rule => {
    const entries = new Map((sources.get(rule.selectorId) ?? []).map(d => [d.property, d]));
    const declarations = rule.declarations.map(d => {
      const source = entries.get(d.property);
      if (!source) return d;
      if (d.property === 'box-shadow' && d.value === 'none') return d;
      // Shadow geometry remains adventurous; only its color follows the source.
      if (d.property === 'box-shadow' && d.value !== 'none' && source.value !== 'none') {
        return { ...d, value: d.value.replace(/#[\da-f]+$/i, source.value.split(' ').at(-1)!) };
      }
      return source;
    });
    for (const d of entries.values()) if (!declarations.some(existing => existing.property === d.property)) declarations.push(d);
    return { ...rule, declarations };
  });
  for (const [selectorId, declarations] of sources) {
    if (declarations.length && !paletteRules.some(rule => rule.selectorId === selectorId)) paletteRules.push({ selectorId, declarations: [...declarations] });
  }
  const rules = paletteRules.map(rule => ({ ...rule, declarations: rule.declarations.map(d => {
    let value = d.value;
    if (d.property === 'color' || d.property.endsWith('-color')) {
      value = varyColor(value);
    } else if (d.property === 'box-shadow' && value !== 'none') {
      value = value.replace(/#[\da-f]+$/i, hex => varyColor(hex));
    } else if (d.property.endsWith('-radius') || (d.property as Property).startsWith('padding-')) {
      value = inspiration ? `${Math.round(Math.max(0, Math.min(48, parseFloat(value) + Math.floor(random() * 9) - 4)) * 100) / 100}px`
        : d.property.endsWith('-radius') ? `${Math.floor(random() * 33)}px` : `${8 + Math.floor(random() * 21)}px`;
    }
    return { ...d, value };
  }) }));
  return constrainStyle(parseStyle({ ...base, id, name: `${kind === 'joker' ? 'Joker' : 'Harlequin'} ${seed >>> 0}`, provenance: kind, rules }), captured);
}
