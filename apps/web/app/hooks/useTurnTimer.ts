import { useEffect, useRef, useState } from 'react';

const TURN_TIMEOUT_S = 60;

export function useTurnTimer({
  enabled,
  onTimeout,
}: {
  enabled: boolean;
  onTimeout: () => void;
}): { timeLeft: number; syncTimer: (turnStartedAt: string) => void } {
  const [timeLeft, setTimeLeft] = useState(TURN_TIMEOUT_S);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onTimeoutRef.current = onTimeout; });

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(id); onTimeoutRef.current(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [enabled]);

  const syncTimer = (turnStartedAt: string) => {
    const elapsed = Math.floor((Date.now() - new Date(turnStartedAt).getTime()) / 1000);
    setTimeLeft(Math.max(0, TURN_TIMEOUT_S - elapsed));
  };

  return { timeLeft, syncTimer };
}
