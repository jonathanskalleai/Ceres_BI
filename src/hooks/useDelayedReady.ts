import { useEffect, useState } from "react";

/**
 * Schedules non-critical work after the first render without changing the
 * rendered layout. A disabled query is reset immediately, so changing a
 * filter never leaves an old secondary request running by accident.
 */
export function useDelayedReady(
  enabled: boolean,
  delayMs: number,
  resetKey?: string | number,
): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!enabled) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setReady(true);
    }, Math.max(0, delayMs));

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, delayMs, resetKey]);

  return ready;
}
