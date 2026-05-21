/**
 * Thin client for the Hono API.
 * All calls go here — no fetch calls scattered in components.
 */

import type {
  CreateRoomResponse,
  JoinRoomResponse,
  RoomStateResponse,
  PokemonListResponse,
  ActionResponse,
  Action,
} from "@pokemon-battle/shared";

const BASE = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  createRoom: () =>
    request<CreateRoomResponse>("/rooms", { method: "POST" }),

  joinRoom: (code: string, playerName: string) =>
    request<JoinRoomResponse>(`/rooms/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ playerName }),
    }),

  submitTeam: (code: string, playerId: string, team: number[]) =>
    request<{ success: boolean }>(`/rooms/${code}/team`, {
      method: "POST",
      body: JSON.stringify({ playerId, team }),
    }),

  setReady: (code: string, playerId: string) =>
    request<{ room: RoomStateResponse["room"] }>(`/rooms/${code}/ready`, {
      method: "POST",
      body: JSON.stringify({ playerId }),
    }),

  getRoomState: (code: string) =>
    request<RoomStateResponse>(`/rooms/${code}`),

  getPokemon: (limit = 20, offset = 0) =>
    request<PokemonListResponse>(`/pokemon?limit=${limit}&offset=${offset}`),

  submitAction: (roomCode: string, playerId: string, action: Action) =>
    request<ActionResponse>(`/battle/${roomCode}/action`, {
      method: "POST",
      body: JSON.stringify({ playerId, action }),
    }),

  getBattle: (roomCode: string) =>
    request<{ battle: ActionResponse["battle"] }>(`/battle/${roomCode}`),
};
