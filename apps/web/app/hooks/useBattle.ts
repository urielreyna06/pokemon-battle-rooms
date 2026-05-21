import { useCallback } from 'react';
import { usePolling } from './usePolling';
import { getBattle } from '../lib/api';
import type { BattleState } from '../lib/types';

// Polls GET /battle/:code every 1500ms.
// triggerFastPoll() drops to 500ms for one cycle — call it right after POSTing an action.
export function useBattle(roomCode: string): {
  battle: BattleState | null;
  error: string | null;
  triggerFastPoll: () => void;
} {
  const fn = useCallback(() => getBattle(roomCode), [roomCode]);
  const { data, error, triggerFastPoll } = usePolling<BattleState>(fn, 1500);
  return { battle: data, error, triggerFastPoll };
}
