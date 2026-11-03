import { useState, useEffect, useRef, useMemo } from 'react';
import { selectors, type SelectorId, type Property } from '../shared/style.ts';
import { useGeneration } from './generation/useGeneration.ts';
import { useCountdown } from './generation/useCountdown.ts';
import { presets } from './styles/presets.ts';
import { StyleCard } from './components/StyleCard.tsx';
import { parseSnapshot, toggleConstraint, type Snapshot } from '../shared/constraints.ts';
import { makeInspectionGroups, representative, normalizeComputed, type InspectionGroup } from './preview/inspection.ts';
import { Preview } from './preview/Preview.tsx';
import { ENABLED_EXPRESSIONS } from '../shared/generation.ts';
import { IntroductionVideo } from './components/IntroductionVideo.tsx';
import { EditableValue, AddDeclaration, type CssEdits } from './components/CssEditing.tsx';
import { useSavedPresets } from './styles/savedPresets.ts';
import { useAutoGeneration } from './generation/useAutoGeneration.ts';

function Inspector({ values, constraints, groups, edits, onEdit, onRemoveEdit, onToggle, active, remaining, unusedConstraints, onGenerate, auto, onAutoChange, inspirationId, onClearInspiration }: { values: Record<string, string>; constraints: Snapshot; groups: readonly InspectionGroup[];
  auto: ReturnType<typeof useAutoGeneration>; onAutoChange: (enabled: boolean) => void;
  edits: CssEdits;
  onEdit: (selector: SelectorId, property: Property, value: string, added?: boolean) => void;
  onRemoveEdit: (selector: SelectorId, property: Property) => void;
  remaining: number | null;
  unusedConstraints: boolean;
  inspirationId: string | null; onClearInspiration: () => void;
  active: boolean; onGenerate: () => void; onToggle: (selector: SelectorId, property: Property, state: 'locked' | 'unset') => void }) {
  return (
    <aside className="inspector-panel workspace-panel" aria-labelledby="inspector-label">
      <header className="panel-heading inspector-heading">
        <div><span className="panel-kicker">THE DETAILS</span><h2 id="inspector-label">CSS inspector</h2></div>
        <span className="inspector-code-icon" aria-hidden="true">{'{ }'}</span>
      </header>
      <div className="inspector-description">
        <p>L - Locks a line, to be applied in preview and in generations.</p>
        <p>U - Unsets a line, so it's not used in generations.</p>
      </div>
      <div className="inspector-scroll scroll-region" tabIndex={0} role="region" aria-label="Scrollable CSS declarations">
        {groups.map(rule => (
          <div className="css-rule" key={rule.selectorId}>
            <div className="css-selector">{selectors[rule.selectorId]} <span>{'{'}</span></div>
            <dl>{rule.properties.map(property => {
              const edit = edits[`${rule.selectorId}:${property}`];
              return (
              <div className="css-declaration" key={property} data-declaration={`${rule.selectorId}:${property}`}>
                <dt className={edit?.kind === 'added' ? 'css-edited' : undefined}>{property}<span>:</span></dt>
                <dd><EditableValue selector={rule.selectorId} property={property}
                  value={lockedValue(constraints, rule.selectorId, property) ?? values[`${rule.selectorId}:${property}`] ?? '…'}
                  edited={!!edit} onEdit={onEdit} /></dd>
                <span className="declaration-controls">{edit ? <>
                  <button disabled aria-label={`Lock ${rule.selectorId} ${property}`} aria-pressed="true">L</button>
                  <button className="css-remove-edit" aria-label={`${edit.kind === 'added' ? 'Delete' : 'Reset'} ${rule.selectorId} ${property}`}
                    onClick={() => onRemoveEdit(rule.selectorId, property)}>{edit.kind === 'added' ? 'Del' : 'Reset'}</button>
                </> : (['locked', 'unset'] as const).map(state => <button key={state}
                  aria-label={`${state === 'locked' ? 'Lock' : 'Unset'} ${rule.selectorId} ${property}`}
                  aria-pressed={constraints.some(c => c.selectorId === rule.selectorId && c.property === property && c.state === state)}
                  onClick={() => onToggle(rule.selectorId, property, state)}>{state === 'locked' ? 'L' : 'U'}</button>)}</span>
              </div>
            ); })}</dl>
            <AddDeclaration selector={rule.selectorId} existing={rule.properties} onAdd={(selector, property, value) => onEdit(selector, property, value, true)} />
            <span className="css-brace">{'}'}</span>
          </div>
        ))}
      </div>
      <footer className="generation-footer">
        <div className="generation-footer-caption" role="status" aria-label="Generation inspiration"><span className="status-dot" />
          {inspirationId ? `Inspiration: ${inspirationId}` : 'No inspiration selected.'}
          {inspirationId && <button className="clear-inspiration" onClick={onClearInspiration}>Clear inspiration</button>}
        </div>
        <div className="generation-actions">
        <button className="generate-button" disabled={active} onClick={onGenerate} aria-describedby="generation-availability">
          <span aria-hidden="true">✳</span> {active ? 'Generating…' : remaining !== null && remaining <= 3 ? `Sending in ${remaining}…` : 'Generate'} <span aria-hidden="true">↗</span>
        </button>
        <label className="auto-generation">
          <input type="checkbox" role="switch" checked={auto.enabled} disabled={!auto.ready} onChange={event => onAutoChange(event.target.checked)} />
          <span className="auto-generation-track" aria-hidden="true" />
          <span>Auto (8 sec)</span>
        </label>
        </div>
        {auto.error && <p role="status" aria-label="Auto preference storage">{auto.error}</p>}
        <p id="generation-availability" role="status" aria-label="Generation constraints">{active && unusedConstraints
          ? 'Edits apply to the preview. This batch uses earlier constraints.'
          : remaining !== null && !active ? 'Sending eight seconds after the last constraint change.'
          : unusedConstraints ? 'Current constraints have not been used. Generate when ready.'
          : 'Joker, Harlequin and four AI expressions. Select as they arrive.'}</p>
      </footer>
    </aside>
  );
}

function lockedValue(constraints: Snapshot, selector: SelectorId, property: Property) {
  const c = constraints.find(c => c.selectorId === selector && c.property === property);
  return c?.state === 'locked' ? c.value : undefined;
}

export function App() {
  const generation = useGeneration();
  const savedPresets = useSavedPresets();
  const auto = useAutoGeneration();
  const [saveMessage, setSaveMessage] = useState('');
  const allPresets = [...presets, ...savedPresets.saved.map(row => row.style)];
  const editMayArm = useRef(false);
  // Retain discovered declaration rows for the session, so locks remain reachable
  // even after selecting a preset that omits that generated declaration.
  const [edits, setEdits] = useState<CssEdits>({});
  const groups = useMemo(() => makeInspectionGroups([...savedPresets.saved.map(row => row.style), ...generation.slots.flatMap(slot => slot.style ? [slot.style] : [])]).map(group => ({
    ...group, properties: [...new Set([...group.properties, ...Object.keys(edits)
      .filter(key => key.startsWith(`${group.selectorId}:`)).map(key => key.split(':')[1] as Property)])],
  })), [generation.slots, edits, savedPresets.saved]);
  const generatedRail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!generation.scrollTarget || !generatedRail.current) return;
    const rail = generatedRail.current;
    const slot = rail.querySelector<HTMLElement>(`[data-slot="${generation.scrollTarget}"]`);
    if (slot) rail.scrollTo({ top: slot.getBoundingClientRect().top - rail.getBoundingClientRect().top + rail.scrollTop - 19,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [generation.scrollTarget]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  const [constraints, setConstraints] = useState<Snapshot>([]);
  const [notice, setNotice] = useState('');
  function onEdit(selectorId: SelectorId, property: Property, value: string, added = false) {
    const key = `${selectorId}:${property}`;
    const next = parseSnapshot([...constraints.filter(c => c.selectorId !== selectorId || c.property !== property),
      { selectorId, property, state: 'locked', value }]);
    setEdits(current => ({ ...current, [key]: current[key] ?? { kind: added ? 'added' : 'changed',
      previous: constraints.find(c => c.selectorId === selectorId && c.property === property) } }));
    editMayArm.current = auto.ready && auto.enabled && !generation.isActive();
    setConstraints(next); setNotice('');
  }
  function onRemoveEdit(selectorId: SelectorId, property: Property) {
    const key = `${selectorId}:${property}`, edit = edits[key];
    if (!edit) return;
    const next = constraints.filter(c => c.selectorId !== selectorId || c.property !== property);
    if (edit.previous) next.push(edit.previous);
    editMayArm.current = auto.ready && auto.enabled && !generation.isActive();
    setConstraints(parseSnapshot(next));
    setEdits(current => { const copy = { ...current }; delete copy[key]; return copy; });
    setNotice('');
  }
  function onToggle(selector: SelectorId, property: Property, state: 'locked' | 'unset') {
    if (edits[`${selector}:${property}`]) return;
    const element = root && representative(root, selector);
    if (!element) return;
    const value = normalizeComputed(property, getComputedStyle(element).getPropertyValue(property).trim(), element);
    const old = constraints.find(c => c.selectorId === selector && c.property === property);
    if (state === 'locked' && old?.state !== 'locked' && value === undefined) {
      setNotice('This effective value is outside the supported style vocabulary.'); return;
    }
    setNotice('');
    editMayArm.current = auto.ready && auto.enabled && !generation.isActive();
    setConstraints(toggleConstraint(constraints, selector, property, state, value));
  }
  const [selectedId, setSelectedId] = useState('S1');
  const [inspirationId, setInspirationId] = useState<string | null>(null);
  const styles = [...allPresets, ...generation.slots.flatMap(slot => slot.style ? [slot.style] : [])];
  const selected = styles.find(style => style.id === selectedId)!;
  const savedLayers = savedPresets.saved.find(row => row.style.id === selectedId)?.layers;
  async function saveCurrentPreset() {
    setSaveMessage('');
    try {
      const saved = await savedPresets.save(selected, constraints, savedLayers);
      if (saved) setSaveMessage(`Saved as ${saved.style.id}.`);
    } catch { setSaveMessage('Could not save preset. Please try again.'); }
  }
  const inspiration = styles.find(style => style.id === inspirationId) ?? null;
  // Constraints are canonical; compare values rather than edit counts so reverting
  // to the captured inputs clears the notice. Inspiration styles are immutable.
  const unusedConstraints = generation.lastBatchContext !== null && (
    JSON.stringify(constraints) !== JSON.stringify(generation.lastBatchContext.constraints)
    || (inspiration?.id ?? null) !== (generation.lastBatchContext.inspiration?.id ?? null));
  const toggleInspiration = (id: string | null) => {
    editMayArm.current = auto.ready && auto.enabled && !generation.isActive();
    setInspirationId(current => current === id ? null : id);
  };
  const countdown = useCountdown(() => generation.generate(constraints, inspiration), () => auto.ready && auto.enabled && !generation.isActive());
  function onAutoChange(enabled: boolean) {
    countdown.cancel();
    editMayArm.current = false;
    auto.update(enabled);
  }
  const previousInputs = useRef({ constraints, inspiration });
  useEffect(() => {
    if (previousInputs.current.constraints === constraints && previousInputs.current.inspiration === inspiration) return;
    previousInputs.current = { constraints, inspiration };
    // Keep an active-request edit ineligible even if completion happens before
    // React commits it; restart also checks the synchronous generation guard.
    if (editMayArm.current) countdown.restart();
    else countdown.cancel();
  }, [constraints, inspiration, countdown.restart, countdown.cancel]);
  function generate() { countdown.cancel(); generation.generate(constraints, inspiration); }
  function retry(slot: Parameters<typeof generation.retry>[0]) { countdown.cancel(); generation.retry(slot); }

  return (
    <div className="styler-app">
      <header className="app-header">
        <div className="app-wordmark">
          <span className="app-logo" aria-hidden="true">s<span>.</span></span><h1>styler<span>.</span></h1>
          <span className="app-header-divider" /><span className="app-tagline">A space for visual possibility.</span>
        </div>
        <IntroductionVideo />
      </header>
      <main className="workspace" aria-label="Style exploration workspace">
        <section className="preview-panel workspace-panel" aria-labelledby="preview-label">
          <header className="panel-heading preview-heading">
            <div><span className="panel-kicker">THE CANVAS</span><h2 id="preview-label">Website preview</h2></div>
            <div className="preview-style-chip" role="status" aria-label="Selected style">
              <span /> {selected.id} <span className="preview-style-chip-divider">/</span> {selected.name}
            </div>
          </header>
          <div className="preview-scroll scroll-region" tabIndex={0} role="region" aria-label="Scrollable website preview">
            <Preview groups={groups} constraints={constraints} style={selected} savedLayers={savedLayers} onInspect={setValues} onRoot={setRoot} />
          </div>
          <footer className="preview-status">
            <span><span className="status-dot" /> Same content. A different feeling.</span>
            <span>DESKTOP CANVAS <span aria-hidden="true">↗</span></span>
          </footer>
        </section>

        <section className="style-panel workspace-panel" aria-labelledby="presets-label">
          <header className="panel-heading rail-heading"><span className="panel-kicker">01</span><h2 id="presets-label">Presets</h2></header>
          <div className="rail-scroll scroll-region" tabIndex={0} role="region" aria-label="Scrollable predefined styles">
            {allPresets.map(style => <StyleCard key={style.id} style={style} active={style.id === selectedId} inspired={style.id === inspirationId} onSelect={() => setSelectedId(style.id)} onInspire={() => toggleInspiration(style.id)} />)}
            <div className="rail-bottom-note"><span aria-hidden="true">✳</span><p>A starting<br />point.</p></div>
          </div>
          <footer className="presets-footer">
            <button className="save-preset-button" disabled={!savedPresets.ready || savedPresets.saving} onClick={saveCurrentPreset}>
              {savedPresets.saving ? 'Saving…' : 'Save preset'}
            </button>
            <span>{allPresets.length} STYLES</span>
            {(savedPresets.error || saveMessage) && <p role="status" aria-label="Preset storage">{savedPresets.error || saveMessage}</p>}
            {savedPresets.error && <button className="save-preset-button" onClick={savedPresets.reload}>Retry loading</button>}
          </footer>
        </section>

        <section className="style-panel workspace-panel generated-panel" aria-labelledby="generated-label">
          <header className="panel-heading rail-heading"><span className="panel-kicker">02</span><h2 id="generated-label">Generated</h2></header>
          <div ref={generatedRail} className="rail-scroll scroll-region" tabIndex={0} role="region" aria-label="Scrollable generated styles">
             {generation.slots.map(slot => <div data-slot={slot.id} key={slot.id}>
              {slot.style ? <StyleCard style={slot.style} active={selectedId === slot.id} inspired={slot.id === inspirationId} expression={slot.expression} onSelect={() => setSelectedId(slot.id)} onInspire={() => toggleInspiration(slot.id)} />
                : <div className="generation-slot" role="status"><strong>{slot.id} · {slot.localKind === 'harlequin' ? 'Harlequin' : slot.seed !== undefined ? 'Joker' : slot.expression ?? 'AI'}</strong>
                  <p>{slot.status === 'pending' ? 'Generating…' : slot.error}</p>
                  {slot.status === 'error' && slot.seed === undefined && <button disabled={generation.active || (slot.expression !== undefined && !ENABLED_EXPRESSIONS.includes(slot.expression))} onClick={() => retry(slot)} aria-label={`Retry ${slot.id}`}>Retry</button>}
                </div>}
            </div>)}
            <div className="rail-bottom-note generated-note"><span aria-hidden="true">↟</span><p>New ideas<br />start here.</p></div>
          </div>
          <footer className="rail-footer">{generation.slots.length} STYLES</footer>
        </section>
        <Inspector groups={groups} edits={edits} onEdit={onEdit} onRemoveEdit={onRemoveEdit} values={values} constraints={constraints} onToggle={onToggle} active={generation.active} remaining={countdown.remaining} unusedConstraints={unusedConstraints} onGenerate={generate} auto={auto} onAutoChange={onAutoChange} inspirationId={inspirationId} onClearInspiration={() => toggleInspiration(null)} />
        {notice && <div className="app-notice" role="status">{notice}</div>}
      </main>
    </div>
  );
}
