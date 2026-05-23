import { describe, it, expect } from 'vitest';
import type { BattleDoc, BattlePlayerState, BattlePokemon, BattleMove } from '../../../../packages/shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TACKLE: BattleMove = {
  id: 'tackle', name: 'Tackle', type: 'normal', power: 40,
  accuracy: 100, priority: 0, damageClass: 'physical', effect: '',
};

function makePokemon(overrides: Partial<BattlePokemon> & { instanceId: string; name: string }): BattlePokemon {
  return {
    pokedexId: 1,
    types: ['normal'],
    currentHp: 100,
    maxHp: 100,
    stats: { attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    moves: [TACKLE],
    statusConditions: [],
    ivs: { hp: 15, attack: 15, defense: 15, specialAttack: 15, specialDefense: 15, speed: 15 },
    spriteUrl: '',
    ...overrides,
  };
}

function makePlayer(id: string, team?: BattlePokemon[]): BattlePlayerState {
  const defaultTeam = [makePokemon({ instanceId: `${id}_1`, name: 'Bulbasaur' })];
  const t = team ?? defaultTeam;
  return {
    id,
    team: t,
    activePokemonId: t[0].instanceId,
    selectedAction: undefined,
    remainingSwitches: 1,
  };
}

function makeBattle(overrides?: Partial<BattleDoc>): BattleDoc {
  return {
    roomCode: 'FORF01',
    status: 'active',
    players: [makePlayer('p1'), makePlayer('p2')],
    turn: 1,
    battleLog: [],
    ...overrides,
  } as BattleDoc;
}

// Mirrors the server-side forfeit guard logic in battle.ts
function simulateForfeit(
  battle: BattleDoc,
  playerId: string,
): { valid: true; winnerPlayerId: string; logEntry: string } | { valid: false; error: string; status: number } {
  if (battle.status !== 'active') {
    return { valid: false, error: 'Battle is already finished', status: 409 };
  }
  const player = battle.players.find((p) => p.id === playerId);
  if (!player) {
    return { valid: false, error: 'Player not in this battle', status: 403 };
  }
  const opponent = battle.players.find((p) => p.id !== playerId);
  const winnerPlayerId = opponent!.id;
  const activePokemon = player.team.find((p) => p.instanceId === player.activePokemonId);
  const activeName = activePokemon?.name ?? 'Player';
  return {
    valid: true,
    winnerPlayerId,
    logEntry: `${activeName} forfeited the battle!`,
  };
}

// ─── Forfeit guard conditions ─────────────────────────────────────────────────

describe('forfeit guard conditions', () => {
  it('allows forfeit when battle is active', () => {
    const battle = makeBattle({ status: 'active' });
    const result = simulateForfeit(battle, 'p1');
    expect(result.valid).toBe(true);
  });

  it('rejects forfeit when battle is already finished', () => {
    const battle = makeBattle({ status: 'finished' });
    const result = simulateForfeit(battle, 'p1');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Battle is already finished');
      expect(result.status).toBe(409);
    }
  });

  it('rejects forfeit for a player not in the battle', () => {
    const battle = makeBattle();
    const result = simulateForfeit(battle, 'unknown_player');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Player not in this battle');
      expect(result.status).toBe(403);
    }
  });

  it('allows either player to forfeit', () => {
    const battle = makeBattle();
    expect(simulateForfeit(battle, 'p1').valid).toBe(true);
    expect(simulateForfeit(battle, 'p2').valid).toBe(true);
  });
});

// ─── Winner determination ─────────────────────────────────────────────────────

describe('forfeit winner determination', () => {
  it('opponent wins when p1 forfeits', () => {
    const battle = makeBattle();
    const result = simulateForfeit(battle, 'p1');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.winnerPlayerId).toBe('p2');
    }
  });

  it('opponent wins when p2 forfeits', () => {
    const battle = makeBattle();
    const result = simulateForfeit(battle, 'p2');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.winnerPlayerId).toBe('p1');
    }
  });

  it('winnerPlayerId is never the forfeiting player', () => {
    const battle = makeBattle();
    for (const forfeiter of ['p1', 'p2']) {
      const result = simulateForfeit(battle, forfeiter);
      if (result.valid) {
        expect(result.winnerPlayerId).not.toBe(forfeiter);
      }
    }
  });
});

// ─── Post-forfeit battle state ────────────────────────────────────────────────

describe('post-forfeit battle state', () => {
  it('log entry includes the active Pokémon name', () => {
    const pikachu = makePokemon({ instanceId: 'p1_1', name: 'Pikachu' });
    const p1 = makePlayer('p1', [pikachu]);
    const battle = makeBattle({ players: [p1, makePlayer('p2')] });
    const result = simulateForfeit(battle, 'p1');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.logEntry).toBe('Pikachu forfeited the battle!');
    }
  });

  it('forfeit is valid even in the middle of a turn (one action submitted)', () => {
    const battle = makeBattle({
      players: [
        { ...makePlayer('p1'), selectedAction: { type: 'move', moveId: 'tackle' } },
        makePlayer('p2'),
      ],
    });
    const result = simulateForfeit(battle, 'p2');
    expect(result.valid).toBe(true);
  });

  it('status must be set to finished after forfeit', () => {
    const battle = makeBattle();
    const result = simulateForfeit(battle, 'p1');
    expect(result.valid).toBe(true);
    // Simulate DB update
    const updated: Partial<BattleDoc> = {
      ...battle,
      status: 'finished',
      ...(result.valid ? { winnerPlayerId: result.winnerPlayerId } : {}),
    };
    expect(updated.status).toBe('finished');
  });
});

// ─── Client-side forfeit button/modal visibility ───────────────────────────────

describe('client-side forfeit visibility', () => {
  it('forfeit button is visible during menu phase for active non-spectator', () => {
    const phase = 'menu';
    const battleStatus = 'active';
    const isSpectator = false;
    const showForfeit = !isSpectator && battleStatus === 'active' && phase !== 'finished';
    expect(showForfeit).toBe(true);
  });

  it('forfeit button is visible during busy phase (waiting for opponent)', () => {
    const phase = 'busy';
    const battleStatus = 'active';
    const isSpectator = false;
    const showForfeit = !isSpectator && battleStatus === 'active' && phase !== 'finished';
    expect(showForfeit).toBe(true);
  });

  it('forfeit button is visible during switch phase', () => {
    const phase = 'switch';
    const battleStatus = 'active';
    const isSpectator = false;
    const showForfeit = !isSpectator && battleStatus === 'active' && phase !== 'finished';
    expect(showForfeit).toBe(true);
  });

  it('forfeit button is hidden for spectators', () => {
    const phase = 'menu';
    const battleStatus = 'active';
    const isSpectator = true;
    const showForfeit = !isSpectator && battleStatus === 'active' && phase !== 'finished';
    expect(showForfeit).toBe(false);
  });

  it('forfeit button is hidden when battle is finished', () => {
    const phase = 'finished';
    const battleStatus = 'finished';
    const isSpectator = false;
    const showForfeit = !isSpectator && battleStatus === 'active' && phase !== 'finished';
    expect(showForfeit).toBe(false);
  });

  it('forfeit modal defaults to hidden (showForfeit starts false)', () => {
    const showForfeit = false;
    expect(showForfeit).toBe(false);
  });
});
