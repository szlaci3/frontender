import { selectors, properties, type SelectorId, type Property, type Style } from '../../shared/style.ts';
import { presets } from '../styles/presets.ts';

export type InspectionGroup = { selectorId: SelectorId; properties: Property[] };
export function makeInspectionGroups(history: readonly Style[] = []): InspectionGroup[] {
  return (Object.keys(selectors) as SelectorId[]).map(selectorId => ({
    selectorId,
    properties: [...new Set<Property>(['color', ...[...presets, ...history].flatMap(style => style.rules
      .filter(rule => rule.selectorId === selectorId).flatMap(rule => rule.declarations.map(entry => entry.property)))])],
  }));
}
export const inspectionGroups = makeInspectionGroups();
export function representative(root: ShadowRoot, selectorId: SelectorId) {
  // The track remains inspectable when the conditional :checked selector is inactive.
  return root.querySelector(selectorId === 'switch' ? '.sample-switch-track' : selectors[selectorId]);
}
export function readEffective(root: ShadowRoot, groups: readonly InspectionGroup[] = inspectionGroups) {
  return Object.fromEntries(groups.flatMap(group => {
    const element = representative(root, group.selectorId);
    return group.properties.map(property => [`${group.selectorId}:${property}`,
      element ? getComputedStyle(element).getPropertyValue(property).trim() : 'Unavailable']);
  }));
}

export function normalizeComputed(property: Property, raw: string, element: Element): string | undefined {
  let value = raw.replace(/rgba?\(([^)]+)\)/g, (_, channels: string) => {
    const parts = channels.split(',').map(Number);
    return '#' + parts.slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('')
      + (parts.length === 4 ? Math.round(parts[3]! * 255).toString(16).padStart(2, '0') : '');
  });
  if (property === 'font-family') value = value.replaceAll('"', "'");
  if (property === 'line-height' && value.endsWith('px')) value = String(Math.round(parseFloat(value) / parseFloat(getComputedStyle(element).fontSize) * 100) / 100);
  if (property === 'box-shadow' && value !== 'none') {
    const parts = value.split(' ');
    if (parts[0]?.startsWith('#')) value = [...parts.slice(1), parts[0]].join(' ');
  }
  if (/^-?\d+\.\d+px$/.test(value)) value = `${Math.round(parseFloat(value) * 100) / 100}px`;
  if (property === 'font-weight' && /^\d+(?:\.\d+)?$/.test(value)) value = String(Math.round(Number(value) * 100) / 100);
  return properties[property](value) ? value : undefined;
}
