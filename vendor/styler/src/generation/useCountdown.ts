import { useCallback, useEffect, useRef, useState } from 'react';

// One timeout owns both the visible ticks and the send deadline. Latest callbacks
// keep the eventual request current without restarting on unrelated renders.
export function useCountdown(send: () => void, canArm: () => boolean) {
  const callbacks = useRef({ send, canArm });
  callbacks.current = { send, canArm };
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [remaining, setRemaining] = useState<number | null>(null);
  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    setRemaining(null);
  }, []);
  const restart = useCallback(() => {
    cancel();
    if (!callbacks.current.canArm()) return;
    const deadline = performance.now() + 8000;
    const tick = () => {
      const ms = deadline - performance.now();
      if (ms <= 0) {
        timer.current = undefined;
        setRemaining(null);
        callbacks.current.send();
        return;
      }
      const seconds = Math.ceil(ms / 1000);
      setRemaining(seconds);
      timer.current = setTimeout(tick, Math.min(ms, ms - (seconds - 1) * 1000));
    };
    tick();
  }, [cancel]);
  useEffect(() => () => { clearTimeout(timer.current); }, []);
  return { remaining, restart, cancel };
}
