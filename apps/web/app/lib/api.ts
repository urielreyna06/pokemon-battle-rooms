// All fetch wrappers — frontend never calls PokeAPI directly, only our backend.
import { API_BASE } from './constants';
import type { RoomState, BattleState, CatalogPokemon, Action } from './types';

async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, headers: extraHeaders, ...rest } = options ?? {};
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extraHeaders as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((body['message'] as string | undefined) ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

export async function createRoom(): Promise<{ code: string }> {
  return apiFetch<{ code: string }>('/rooms', { method: 'POST' });
}

export async function joinRoom(
  code: string,
  playerName: string
): Promise<{ playerId: string }> {
  return apiFetch<{ playerId: string }>(`/rooms/${code}/join`, {
    method: 'POST',
    body: JSON.stringify({ name: playerName }),
  });
}

export async function getRoom(code: string): Promise<RoomState> {
  return apiFetch<RoomState>(`/rooms/${code}`);
}

export async function setReady(
  code: string,
  playerId: string,
  pokemonIds: number[]
): Promise<void> {
  return apiFetch<void>(`/rooms/${code}/ready`, {
    method: 'POST',
    body: JSON.stringify({ playerId, pokemonIds }),
  });
}

// ─── Pokemon catalog ──────────────────────────────────────────────────────────

export async function getPokemonCatalog(
  limit = 50,
  offset = 0
): Promise<{ pokemon: CatalogPokemon[]; total: number }> {
  return apiFetch<{ pokemon: CatalogPokemon[]; total: number }>(
    `/pokemon?limit=${limit}&offset=${offset}`
  );
}

// ─── Auth / Subscription ─────────────────────────────────────────────────────

export async function getMe(token: string): Promise<{ isShinySubscriber: boolean }> {
  return apiFetch<{ isShinySubscriber: boolean }>('/users/me', { token });
}

export async function getSubscriptionStatus(
  token: string
): Promise<{ status: string; shinyUnlocked: boolean }> {
  return apiFetch<{ status: string; shinyUnlocked: boolean }>('/stripe/subscription-status', {
    token,
  });
}

export async function createCheckoutSession(token: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/stripe/create-checkout-session', {
    method: 'POST',
    token,
  });
}

// ─── Battle ───────────────────────────────────────────────────────────────────

export async function getBattle(roomCode: string): Promise<BattleState> {
  return apiFetch<BattleState>(`/battle/${roomCode}`);
}

export async function sendAction(
  roomCode: string,
  playerId: string,
  action: Action
): Promise<BattleState> {
  return apiFetch<BattleState>(`/battle/${roomCode}/action`, {
    method: 'POST',
    body: JSON.stringify({ playerId, action }),
  });
}
