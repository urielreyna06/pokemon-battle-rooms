/**
 * Thin client for the Hono API.
 * All calls go here — no fetch calls scattered in components.
 */

import type {
  CreateRoomResponse,
  JoinRoomResponse,
  RoomStateResponse,
  PokemonListResponse,
  PokemonDoc,
  ActionResponse,
  Action,
} from "@pokemon-battle/shared";

const BASE = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:3001";

const POKEMON_CACHE_KEY = "pokebattle_all_pokemon";
const POKEMON_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (res.status === 429 && retries > 0) {
    await new Promise<void>((r) => setTimeout(r, 1000));
    return fetchWithRetry(url, retries - 1);
  }
  return res;
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

  getPokemon: (limit = 20, offset = 0, name?: string, types?: string[]) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (name) params.set("name", name);
    if (types && types.length > 0) params.set("type", types.join(","));
    return request<PokemonListResponse>(`/pokemon?${params}`);
  },

  getAllPokemon: async (): Promise<PokemonDoc[]> => {
    const cached = localStorage.getItem(POKEMON_CACHE_KEY);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached) as { data: PokemonDoc[]; ts: number };
        if (Date.now() - ts < POKEMON_CACHE_TTL) return data;
      } catch { /* ignore corrupted cache */ }
    }

    const res = await fetchWithRetry(`${BASE}/pokemon?limit=1000&offset=0`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = (await res.json()) as PokemonListResponse;
    const all = payload.pokemon ?? [];

    localStorage.setItem(POKEMON_CACHE_KEY, JSON.stringify({ data: all, ts: Date.now() }));
    return all;
  },

  clearPokemonCache: () => localStorage.removeItem(POKEMON_CACHE_KEY),

  submitAction: (roomCode: string, playerId: string, action: Action) =>
    request<ActionResponse>(`/battle/${roomCode}/action`, {
      method: "POST",
      body: JSON.stringify({ playerId, action }),
    }),

  getBattle: (roomCode: string) =>
    request<{ battle: ActionResponse["battle"] }>(`/battle/${roomCode}`),
};
