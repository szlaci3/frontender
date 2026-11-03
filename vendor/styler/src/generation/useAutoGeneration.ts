import { useEffect, useRef, useState } from 'react';
import { db } from '../storage.ts';

export function useAutoGeneration() {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const writes = useRef(Promise.resolve());
  const revision = useRef(0);
  useEffect(() => {
    let disposed = false;
    void db.settings.get('autoGeneration').then(row => {
      if (row && typeof row.value !== 'boolean') throw new Error('Invalid preference');
      if (!disposed) { setEnabled(row?.value ?? true); setReady(true); }
    }).catch(() => {
      if (!disposed) {
        setEnabled(false); setReady(true);
        setError('Could not load Auto preference. Auto is off.');
      }
    });
    return () => { disposed = true; };
  }, []);
  function update(value: boolean) {
    setEnabled(value); setError('');
    const current = ++revision.current;
    // Keep rapid toggles in order, including after a failed write.
    writes.current = writes.current.then(async () => {
      await db.settings.put({ key: 'autoGeneration', value });
    }).catch(() => {
      if (revision.current === current) setError('Auto preference was not saved. Toggle again to retry.');
    });
  }
  return { enabled, ready, error, update };
}
