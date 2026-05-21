/**
 * useApi — authenticated API client hook.
 *
 * Uses Clerk's useAuth().getToken() to attach a Bearer JWT to every
 * request. Drop-in replacement for the static api.ts object — same
 * method names and return types, but token-aware.
 *
 * Usage:
 *   const api = useApi();
 *   const { code } = await api.createRoom();
 */

import { useCallback } from 'react';
import { useAuth } from '@clerk/react';
import type {
  CreateRoomResponse,
  JoinRoomResponse,
  RoomStateResponse,
  PokemonListResponse,
  ActionResponse,
  Action,
} from '@pokemon-battle/shared';

const BASE = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001';

export function useApi() {
  const { getToken } = useAuth();

  // Core fetch wrapper — always grabs a fresh token before each call
  const request = useCallback(
    async <T>(path: string, options?: RequestInit): Promise<T> => {
      const token = await getToken();
      const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options?.headers as Record<string, string> | undefined),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      return data as T;
    },
    [getToken]
  );

  return {
    // ── Rooms ──────────────────────────────────────────────────────────────
    createRoom: () =>
      request<CreateRoomResponse>('/rooms', { method: 'POST' }),

    joinRoom: (code: string, playerName: string) =>
      request<JoinRoomResponse>(`/rooms/${code}/join`, {
        method: 'POST',
        body: JSON.stringify({ playerName }),
      }),

    submitTeam: (code: string, playerId: string, team: number[]) =>
      request<{ success: boolean }>(`/rooms/${code}/team`, {
        method: 'POST',
        body: JSON.stringify({ playerId, team }),
      }),

    setReady: (code: string, playerId: string) =>
      request<{ room: RoomStateResponse['room'] }>(`/rooms/${code}/ready`, {
        method: 'POST',
        body: JSON.stringify({ playerId }),
      }),

    getRoomState: (code: string) =>
      request<RoomStateResponse>(`/rooms/${code}`),

    // ── Pokémon catalog ────────────────────────────────────────────────────
    getPokemon: (limit = 20, offset = 0) =>
      request<PokemonListResponse>(`/pokemon?limit=${limit}&offset=${offset}`),

    // ── Battle ─────────────────────────────────────────────────────────────
    submitAction: (roomCode: string, playerId: string, action: Action) =>
      request<ActionResponse>(`/battle/${roomCode}/action`, {
        method: 'POST',
        body: JSON.stringify({ playerId, action }),
      }),

    getBattle: (roomCode: string) =>
      request<{ battle: ActionResponse['battle'] }>(`/battle/${roomCode}`),
  };
}
