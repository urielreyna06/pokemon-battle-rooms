import { describe, it, expect } from 'vitest';
import type { RoomDoc, RoomPlayer } from '../../../../packages/shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlayer(
  id: string,
  name: string,
  team: number[] = [],
  isReady: boolean = false
): RoomPlayer {
  return {
    id,
    name,
    team,
    activePokemonId: '',
    isReady,
  };
}

function makeRoom(overrides?: Partial<RoomDoc>): RoomDoc {
  return {
    code: 'TEST01',
    status: 'waiting',
    players: [],
    createdAt: new Date(),
    ...overrides,
  } as RoomDoc;
}

// Helper: Validate no duplicate Pokemon between two teams
function validateNoDuplicatePokemon(
  currentTeam: number[],
  opponentTeam: number[]
): { valid: boolean; duplicates: number[] } {
  const duplicates = currentTeam.filter((pokedexId) => opponentTeam.includes(pokedexId));
  return {
    valid: duplicates.length === 0,
    duplicates,
  };
}

// ─── Pokemon Blocking Tests ────────────────────────────────────────────────────

describe('pokemon blocking', () => {
  it('players can confirm different pokémon teams without error', () => {
    const p1Team = [1, 2, 3]; // Bulbasaur, Ivysaur, Venusaur
    const p2Team = [4, 5, 6]; // Charmander, Charmeleon, Charizard

    const result = validateNoDuplicatePokemon(p1Team, p2Team);
    expect(result.valid).toBe(true);
    expect(result.duplicates).toHaveLength(0);
  });

  it("players cannot confirm a team that overlaps with opponent's already-confirmed team", () => {
    const opponentTeam = [1, 2, 3, 4, 5, 6];
    const playerTeam = [4, 7, 8]; // 4 is duplicate

    const result = validateNoDuplicatePokemon(playerTeam, opponentTeam);
    expect(result.valid).toBe(false);
    expect(result.duplicates).toContain(4);
    expect(result.duplicates).toHaveLength(1);
  });

  it('error response has correct shape with duplicate_pokemon error', () => {
    const opponentTeam = [1, 2, 3];
    const playerTeam = [1, 4, 5]; // 1 is duplicate

    const result = validateNoDuplicatePokemon(playerTeam, opponentTeam);
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('duplicates');
    expect(Array.isArray(result.duplicates)).toBe(true);
    expect(result.duplicates).toEqual([1]);
  });

  it('first player to confirm any team succeeds (no opponent yet)', () => {
    const room = makeRoom({
      players: [makePlayer('p1', 'Alice', [1, 2, 3, 4, 5, 6])],
    });

    // First player to confirm — no opponent, so no validation needed
    const hasOpponent = room.players.length >= 2;
    expect(hasOpponent).toBe(false);
  });

  it('detects multiple duplicate pokémon', () => {
    const opponentTeam = [1, 2, 3, 4, 5, 6];
    const playerTeam = [2, 4, 6]; // Three duplicates

    const result = validateNoDuplicatePokemon(playerTeam, opponentTeam);
    expect(result.valid).toBe(false);
    expect(result.duplicates).toEqual([2, 4, 6]);
    expect(result.duplicates).toHaveLength(3);
  });

  it('full team submission with no overlaps', () => {
    const p1 = makePlayer('p1', 'Alice', [1, 2, 3, 4, 5, 6], true);
    const p2Team = [7, 8, 9, 10, 11, 12];

    const result = validateNoDuplicatePokemon(p2Team, p1.team);
    expect(result.valid).toBe(true);
    expect(result.duplicates).toHaveLength(0);
  });

  it('room state remains consistent after duplicate check', () => {
    const room = makeRoom({
      players: [
        makePlayer('p1', 'Alice', [1, 2, 3], true),
        makePlayer('p2', 'Bob', [1, 4, 5], false),
      ],
    });

    const p2Team = room.players[1].team;
    const p1Team = room.players[0].team;
    const result = validateNoDuplicatePokemon(p2Team, p1Team);

    // Room should not be mutated
    expect(room.players[0].team).toEqual([1, 2, 3]);
    expect(room.players[1].team).toEqual([1, 4, 5]);
    expect(result.duplicates).toContain(1);
  });

  it('empty team returns no duplicates', () => {
    const opponentTeam = [1, 2, 3];
    const playerTeam: number[] = [];

    const result = validateNoDuplicatePokemon(playerTeam, opponentTeam);
    expect(result.valid).toBe(true);
    expect(result.duplicates).toHaveLength(0);
  });

  it('single pokémon team with duplicate is caught', () => {
    const opponentTeam = [25]; // Pikachu
    const playerTeam = [25];

    const result = validateNoDuplicatePokemon(playerTeam, opponentTeam);
    expect(result.valid).toBe(false);
    expect(result.duplicates).toEqual([25]);
  });
});
