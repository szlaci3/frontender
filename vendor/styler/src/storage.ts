import { Dexie, type Table } from 'dexie';
import type { SavedPreset } from './styles/savedPresets.ts';

export const db = new Dexie('styler-presets') as Dexie & {
  presets: Table<SavedPreset, number>;
  settings: Table<{ key: string; value: boolean }, string>;
};
db.version(1).stores({ presets: 'number' });
db.version(2).stores({ presets: 'number', settings: 'key' });
