import { useCallback } from 'react';
import { usePolling } from './usePolling';
import { getRoom } from '../lib/api';
import type { RoomState } from '../lib/types';

// Polls GET /rooms/:code every 2000ms as per README spec.
export function useRoom(code: string): {
  room: RoomState | null;
  error: string | null;
} {
  const fn = useCallback(() => getRoom(code), [code]);
  const { data, error } = usePolling<RoomState>(fn, 2000);
  return { room: data, error };
}
