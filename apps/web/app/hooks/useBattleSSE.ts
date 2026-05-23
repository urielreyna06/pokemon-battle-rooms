import { useEffect, useRef } from 'react';
import type { BattleDoc } from '@pokemon-battle/shared';

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001';

export function useBattleSSE(
  code: string,
  getToken: () => Promise<string | null>,
  onMessage: (battle: BattleDoc) => void,
): { closeSSE: () => void } {
  const evtSource = useRef<EventSource | null>(null);
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (cancelled || !token) return;
      const url = `${API_BASE}/battle/${code}/events?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      evtSource.current = es;
      es.addEventListener('battle', (e: MessageEvent) => {
        onMessageRef.current(JSON.parse(e.data) as BattleDoc);
      });
      es.onerror = () => {};
    })();
    return () => {
      cancelled = true;
      evtSource.current?.close();
      evtSource.current = null;
    };
  }, [code]);

  return {
    closeSSE: () => {
      evtSource.current?.close();
      evtSource.current = null;
    },
  };
}
