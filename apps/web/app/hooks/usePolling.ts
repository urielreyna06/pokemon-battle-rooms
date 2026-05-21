import { useState, useEffect, useRef, useCallback } from 'react';

// Generic polling hook with cleanup on unmount.
// intervalMs: normal interval. Can be overridden once via triggerFastPoll().
export function usePolling<T>(
  fn: () => Promise<T>,
  intervalMs: number
): { data: T | null; error: string | null; triggerFastPoll: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fastPollRef = useRef(false);
  const fnRef = useRef(fn);

  // Keep fnRef current without re-triggering the effect
  useEffect(() => { fnRef.current = fn; }, [fn]);

  // Trigger one cycle at 500ms (snappy post-action feedback per README)
  const triggerFastPoll = useCallback(() => {
    fastPollRef.current = true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout>;

    const tick = async (delay: number) => {
      try {
        const next = await fnRef.current();
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }

      if (!cancelled) {
        const nextDelay = fastPollRef.current ? 500 : delay;
        fastPollRef.current = false;
        timerId = setTimeout(() => tick(delay), nextDelay);
      }
    };

    tick(intervalMs);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [intervalMs]); // fn is via ref — stable

  return { data, error, triggerFastPoll };
}
