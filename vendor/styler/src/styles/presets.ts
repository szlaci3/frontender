import { declarationId, parseStyle, type Property, type SelectorId, type StyleRule } from '../../shared/style.ts';

type Values = Partial<Record<Property, string>>;
function rule(selectorId: SelectorId, values: Values): StyleRule {
  return { selectorId, declarations: Object.entries(values).map(([property, value]) => ({
    id: declarationId(selectorId, property as Property), property: property as Property, value,
  })) };
}
const padding = (vertical: number, horizontal = vertical): Values => ({
  'padding-top': `${vertical}px`, 'padding-right': `${horizontal}px`,
  'padding-bottom': `${vertical}px`, 'padding-left': `${horizontal}px`,
});
const radius = (value: number): Values => ({
  'border-top-left-radius': `${value}px`, 'border-top-right-radius': `${value}px`,
  'border-bottom-right-radius': `${value}px`, 'border-bottom-left-radius': `${value}px`,
});
function border(width: number, color: string): Values {
  const values: Values = {};
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    values[`border-${side}-width`] = `${width}px`;
    values[`border-${side}-color`] = color;
    values[`border-${side}-style`] = 'solid';
  }
  return values;
}

const themes = [
  { id: 'S1', name: 'Foundation', page: '#f8f7f2', ink: '#25352e', muted: '#69746d', accent: '#6e8064', button: '#344e41', label: '#ffffff', surface: '#ffffff', border: '#dfe3d9', font: 'Georgia, serif', size: 58, weight: '400', round: 8, space: 14, width: 1, shadow: '0px 4px 16px 0px #25352e08', italic: true },
  { id: 'S2', name: 'Blueprint', page: '#edf4ff', ink: '#142b5e', muted: '#49638c', accent: '#2459c8', button: '#2459c8', label: '#ffffff', surface: '#ffffff', border: '#bacded', font: "'Segoe UI', Arial, sans-serif", size: 54, weight: '700', round: 3, space: 18, width: 1, shadow: '0px 4px 0px 0px #bacded', italic: false },
  { id: 'S3', name: 'After Hours', page: '#211e2c', ink: '#f3eaf7', muted: '#bfb0c9', accent: '#d6b1ef', button: '#d6b1ef', label: '#211e2c', surface: '#302a3d', border: '#65536f', font: 'Georgia, serif', size: 60, weight: '400', round: 20, space: 20, width: 1, shadow: '0px 8px 24px 0px #00000030', italic: true },
  { id: 'S4', name: 'Papercut', page: '#fff2dc', ink: '#302719', muted: '#796442', accent: '#ab461d', button: '#ffb545', label: '#302719', surface: '#fff9ed', border: '#302719', font: "'Courier New', monospace", size: 48, weight: '700', round: 0, space: 16, width: 2, shadow: '5px 5px 0px 0px #302719', italic: false },
  { id: 'S5', name: 'Rosewater', page: '#fff2f4', ink: '#54293c', muted: '#85556c', accent: '#ac3d6b', button: '#ac3d6b', label: '#ffffff', surface: '#fffafb', border: '#e8b8c9', font: 'Georgia, serif', size: 58, weight: '400', round: 28, space: 22, width: 1, shadow: '0px 8px 28px 0px #ac3d6b14', italic: true },
  { id: 'S6', name: 'Signal', page: '#e6f0da', ink: '#203525', muted: '#50694c', accent: '#376a37', button: '#c9f169', label: '#203525', surface: '#f5fbe9', border: '#3d5937', font: "'Segoe UI', Arial, sans-serif", size: 56, weight: '800', round: 4, space: 18, width: 2, shadow: '0px 6px 0px 0px #a4ba8f', italic: false },
  { id: 'S7', name: 'Monograph', page: '#f3f3f3', ink: '#191919', muted: '#636363', accent: '#444444', button: '#191919', label: '#ffffff', surface: '#ffffff', border: '#8b8b8b', font: "'Segoe UI', Arial, sans-serif", size: 54, weight: '500', round: 0, space: 24, width: 1, shadow: 'none', italic: false },
] as const;

const originalPresets = Object.freeze(themes.map(theme => parseStyle({
  schemaVersion: 1, id: theme.id, name: theme.name, provenance: 'preset', rules: [
    rule('page', { color: theme.ink, 'background-color': theme.page, 'font-family': theme.font, ...padding(32) }),
    rule('heading', { 'font-family': theme.font, 'font-size': `${theme.size}px`, 'font-weight': theme.weight, 'line-height': '1.05', 'letter-spacing': '-2px' }),
    rule('accent', { color: theme.accent, 'font-style': theme.italic ? 'italic' : 'normal', 'font-weight': theme.weight }),
    rule('copy', { color: theme.muted, 'font-size': '13px', 'line-height': '1.7' }),
    rule('button', { color: theme.label, 'background-color': theme.button, 'font-family': theme.font, ...radius(theme.round), ...padding(12, 18), ...border(theme.width, theme.width === 2 ? theme.ink : theme.button) }),
    rule('card', { color: theme.ink, 'background-color': theme.surface, ...radius(Math.min(theme.round + (theme.round ? 4 : 0), 32)), ...padding(theme.space), ...border(theme.width, theme.border), 'box-shadow': theme.shadow }),
    rule('input', { color: theme.ink, 'background-color': theme.surface, ...radius(theme.round), ...padding(12, 14), ...border(theme.width, theme.border) }),
    rule('eyebrow', { color: theme.accent }),
    rule('details', { color: theme.muted }),
    rule('switch', { 'background-color': theme.button }),
    rule('subheading', { 'font-family': theme.font, 'font-size': '26px', 'font-weight': theme.weight, 'line-height': '1.2', 'letter-spacing': '-0.5px' }),
    rule('image', { ...radius(theme.round), ...border(theme.width, theme.border) }),
  ],
})));

const tidalAtelier = parseStyle({
  schemaVersion: 1, id: 'S1', name: 'Tidal Atelier', provenance: 'preset', rules: [
    rule('page', { color: '#213e43', 'background-color': '#edf3f2', 'font-family': 'Georgia, serif', ...padding(32) }),
    rule('heading', { 'font-family': 'Georgia, serif', 'font-size': '56px', 'font-weight': '400', 'line-height': '1.08', 'letter-spacing': '-1.8px' }),
    rule('accent', { color: '#a64e36', 'font-style': 'italic', 'font-weight': '400' }),
    rule('copy', { color: '#53676a', 'font-size': '13px', 'line-height': '1.7' }),
    rule('button', { color: '#fcfbf7', 'background-color': '#245b63', 'font-family': "'Segoe UI', Arial, sans-serif", ...radius(10), ...padding(12, 18), ...border(1, '#245b63') }),
    rule('card', { color: '#213e43', 'background-color': '#fffcf6', ...radius(18), ...padding(18), ...border(1, '#c9d7d4'), 'box-shadow': '0px 6px 20px 0px #213e4310' }),
    rule('input', { color: '#213e43', 'background-color': '#fffdf8', ...radius(8), ...padding(12, 14), ...border(1, '#b8c9c5') }),
    rule('eyebrow', { color: '#9a4933' }),
    rule('details', { color: '#53676a' }),
    rule('switch', { 'background-color': '#245b63' }),
    rule('subheading', { 'font-family': 'Georgia, serif', 'font-size': '26px', 'font-weight': '400', 'line-height': '1.2', 'letter-spacing': '-0.6px' }),
    rule('image', { ...radius(10), ...border(1, '#d6ded8') }),
  ],
});

// Rotate complete designs: Foundation S1 → S5, Rosewater S5 → G1,
// Tidal Atelier G1 → S1. Rules stay intact; provenance follows the slot.
export const presets = Object.freeze(originalPresets.map((style, index) => index === 0 ? tidalAtelier
  : index === 4 ? parseStyle({ ...originalPresets[0], id: 'S5' }) : style));
export const seedStyle = parseStyle({ ...originalPresets[4], id: 'G1', provenance: 'seed' });
