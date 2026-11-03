import type { CSSProperties } from 'react';
import type { Style } from '../../shared/style.ts';
import type { Expression } from '../../shared/generation.ts';

function sampleValues(style: Style, selectorId: 'page' | 'button') {
  const values = Object.fromEntries(style.rules.find(rule => rule.selectorId === selectorId)?.declarations
    .map(entry => [entry.property, entry.value]) ?? []);
  return values;
}

export function StyleCard({ style, active, inspired, onSelect, onInspire, expression }: { style: Style; active: boolean; inspired: boolean; onSelect: () => void; onInspire: () => void; expression?: Expression }) {
  const label = style.provenance === 'joker' ? 'Joker'
    : style.provenance === 'harlequin' ? 'Harlequin'
    : style.provenance === 'antigravity' ? expression ?? 'AI'
    : style.name;
  const page = sampleValues(style, 'page');
  const button = sampleValues(style, 'button');
  const surface: CSSProperties = { backgroundColor: page['background-color'], color: page.color };
  const buttonAppearance: CSSProperties = {
    backgroundColor: button['background-color'], color: button.color, fontFamily: button['font-family'],
    borderRadius: button['border-top-left-radius'], border: `${button['border-top-width'] ?? '0px'} solid ${button['border-top-color'] ?? 'transparent'}`,
  };
  return (
    <div className="style-card-wrapper">
      <button type="button" className={`style-card${active ? ' style-card-active' : ''}`}
        aria-label={`${style.id}: ${style.name}${style.provenance === 'seed' ? ' (seed)' : ''}`}
        aria-pressed={active} onClick={onSelect} title={style.name}>
        <span className="style-sample" style={surface} aria-hidden="true">
          <span className="style-sample-lines"><i style={{ backgroundColor: page.color }} /><i /></span>
          <span className="style-sample-button" style={buttonAppearance}>{style.id}</span>
        </span>
        <span className="style-card-id">{label}</span>
      </button>
      <button type="button" className="inspiration-button" aria-label={`Use ${style.id} as inspiration`} aria-pressed={inspired}
        title={inspired ? `Clear ${style.id} inspiration` : `Use ${style.name} for future generation`} onClick={onInspire}>
        <span aria-hidden="true">{inspired ? '✦' : '✧'}</span> {inspired ? 'Inspired' : 'Inspire'}
      </button>
    </div>
  );
}
