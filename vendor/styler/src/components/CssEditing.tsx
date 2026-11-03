import { useEffect, useState } from 'react';
import { properties, type Property, type SelectorId } from '../../shared/style.ts';
import type { Constraint } from '../../shared/constraints.ts';

export type CssEdit = { kind: 'changed' | 'added'; previous?: Constraint };
export type CssEdits = Record<string, CssEdit>;

export function EditableValue({ selector, property, value, edited, onEdit }: {
  selector: SelectorId; property: Property; value: string; edited: boolean;
  onEdit: (selector: SelectorId, property: Property, value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { if (!focused) setDraft(value); }, [value, focused]);
  function commit() {
    if (draft === value) { setFocused(false); setError(false); return; }
    const next = draft.trim();
    if (next.length > 160 || !properties[property](next)) { setError(true); return; }
    setError(false); setFocused(false); onEdit(selector, property, next);
  }
  return <>
    <input className={`css-value-input${edited ? ' css-edited' : ''}`} aria-label={`Edit ${selector} ${property}`}
      value={draft} maxLength={160} spellCheck={false} aria-invalid={error}
      onFocus={() => setFocused(true)} onChange={event => { setDraft(event.target.value); setError(false); }}
      onBlur={commit} onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === 'Escape') { event.preventDefault(); setDraft(value); setError(false); }
      }} />
    {error && <span className="css-edit-error" role="alert">Unsupported value. Use the supported CSS format and range.</span>}
  </>;
}

export function AddDeclaration({ selector, existing, onAdd }: {
  selector: SelectorId; existing: readonly Property[];
  onAdd: (selector: SelectorId, property: Property, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [property, setProperty] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const available = (Object.keys(properties) as Property[]).filter(p => !existing.includes(p));
  if (!open) return <button className="css-add-button" aria-label={`Add declaration to ${selector}`}
    disabled={!available.length} onClick={() => setOpen(true)}>+</button>;
  return <form className="css-add-form" onSubmit={event => {
    event.preventDefault();
    if (!Object.hasOwn(properties, property) || existing.includes(property as Property)) {
      setError('Choose a supported property that is not already listed.'); return;
    }
    const next = value.trim();
    if (next.length > 160 || !properties[property as Property](next)) {
      setError('Unsupported value. Use the supported CSS format and range.'); return;
    }
    onAdd(selector, property as Property, next);
    setOpen(false); setProperty(''); setValue(''); setError('');
  }}>
    <input autoFocus aria-label={`New property for ${selector}`} list={`properties-${selector}`} placeholder="property"
      value={property} onChange={event => { setProperty(event.target.value); setError(''); }} spellCheck={false} />
    <datalist id={`properties-${selector}`}>{available.map(p => <option key={p} value={p} />)}</datalist>
    <input aria-label={`New value for ${selector}`} placeholder="value" value={value} maxLength={160}
      onChange={event => { setValue(event.target.value); setError(''); }} spellCheck={false} />
    <button type="submit">Add</button><button type="button" onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
    {error && <span className="css-edit-error" role="alert">{error}</span>}
  </form>;
}
