import { liveQuery } from 'dexie';
import { useEffect, useRef, useState } from 'react';
import { parseStyle, type Style } from '../../shared/style.ts';
import { constrainStyle, lockStyle, type Snapshot } from '../../shared/constraints.ts';
import { db } from '../storage.ts';

export type SavedPreset = { number: number; style: Style; layers: readonly Style[] };

function validatePreset(row: SavedPreset): SavedPreset {
  if (!Number.isSafeInteger(row.number) || row.number < 8 || !Array.isArray(row.layers) || !row.layers.length) throw new Error('Invalid saved preset.');
  const style = parseStyle(row.style);
  if (style.id !== `S${row.number}` || style.provenance !== 'preset') throw new Error('Invalid saved preset.');
  return { number: row.number, style, layers: Object.freeze(row.layers.map(parseStyle)) };
}

export async function savePreset(style: Style, constraints: Snapshot, previousLayers?: readonly Style[]): Promise<SavedPreset> {
  // Unset affects future generation, not the current appearance being saved.
  const locks = constraints.filter(c => c.state === 'locked');
  const current = constrainStyle(style, locks);
  const layers = (previousLayers ?? [style]).map(parseStyle);
  if (locks.length) layers.push(lockStyle(locks));
  return db.transaction('rw', db.presets, async () => {
    const last = await db.presets.orderBy('number').last();
    const number = Math.max(7, last?.number ?? 7) + 1;
    const saved = validatePreset({ number, style: parseStyle({ ...current, id: `S${number}`, provenance: 'preset' }), layers });
    await db.presets.add(saved);
    return saved;
  });
}

export function useSavedPresets() {
  const [saved, setSaved] = useState<SavedPreset[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    setReady(false); setError('');
    const subscription = liveQuery(() => db.presets.orderBy('number').toArray()).subscribe({
      next: rows => {
        const valid: SavedPreset[] = [];
        let invalid = false;
        for (const row of rows) { try { valid.push(validatePreset(row)); } catch { invalid = true; } }
        // Database refreshes must not change an unchanged inspiration identity.
        setSaved(previous => valid.map(row => previous.find(old => old.number === row.number && JSON.stringify(old) === JSON.stringify(row)) ?? row));
        setReady(true); setError(invalid ? 'Some saved presets could not be loaded.' : '');
      },
      error: () => { setReady(false); setError('Saved presets are unavailable. Retry to load them.'); },
    });
    return () => subscription.unsubscribe();
  }, [attempt]);
  async function save(style: Style, constraints: Snapshot, previousLayers?: readonly Style[]) {
    if (busy.current || !ready) return;
    busy.current = true; setSaving(true);
    try { return await savePreset(style, constraints, previousLayers); }
    finally { busy.current = false; setSaving(false); }
  }
  return { saved, ready, saving, error, save, reload: () => setAttempt(value => value + 1) };
}
