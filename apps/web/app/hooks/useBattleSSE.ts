import { useEffect, useRef } from 'react';
import type { BattleDoc } from '@pokemon-battle/shared';

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001';
const MAX_RETRIES = 5;

export function useBattleSSE(
  code: string,
  getToken: () => Promise<string | null>,
  onMessage: (battle: BattleDoc) => void,
): { closeSSE: () => void } {
  const evtSource = useRef<EventSource | null>(null);
  const onMessageRef = useRef(onMessage);
  const closedRef = useRef(false);
  useEffect(() => { onMessageRef.current = onMessage; });

  useEffect(() => {
    closedRef.current = false;
    let retries = 0;

    function connect() {
      if (closedRef.current) return;
      (async () => {
        const token = await getToken();
        if (closedRef.current || !token) return;

        const url = `${API_BASE}/battle/${code}/events?token=${encodeURIComponent(token)}`;
        const es = new EventSource(url);
        evtSource.current = es;

        es.addEventListener('battle', (e: MessageEvent) => {
          retries = 0; // successful message resets backoff
          onMessageRef.current(JSON.parse(e.data) as BattleDoc);
        });

        es.onerror = () => {
          es.close();
          evtSource.current = null;
          if (closedRef.current) return;
          if (retries >= MAX_RETRIES) return;
          const delay = Math.min(1000 * 2 ** retries, 16000);
          retries++;
          setTimeout(connect, delay);
        };
      })();
    }

    connect();

    return () => {
      closedRef.current = true;
      evtSource.current?.close();
      evtSource.current = null;
    };
  }, [code]);

  return {
    closeSSE: () => {
      closedRef.current = true;
      evtSource.current?.close();
      evtSource.current = null;
    },
  };
}
