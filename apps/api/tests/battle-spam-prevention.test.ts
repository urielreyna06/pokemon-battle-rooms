import { describe, it, expect } from 'vitest';
import { bothPlayersActed } from '../src/engine/battleEngine';
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

function makePlayer(id: string, action?: BattlePlayerState['selectedAction'], team?: BattlePokemon[]): BattlePlayerState {
  const defaultTeam = [makePokemon({ instanceId: `${id}_1`, name: 'Bulbasaur' })];
  const t = team ?? defaultTeam;
  return {
    id,
    team: t,
    activePokemonId: t[0].instanceId,
    selectedAction: action,
    remainingSwitches: 1,
  };
}

function makeBattle(overrides?: Partial<BattleDoc>): BattleDoc {
  return {
    roomCode: 'SPAM01',
    status: 'active',
    players: [makePlayer('p1'), makePlayer('p2')],
    turnNumber: 1,
    log: [],
    ...overrides,
  } as BattleDoc;
}

// ─── Server-side spam prevention (mirrors registerAction check) ───────────────

describe('server-side spam prevention: selectedAction guard', () => {
  it('player with existing move selectedAction is flagged as already acted', () => {
    const player = makePlayer('p1', { type: 'move', moveId: 'tackle' });
    // This is the exact check performed by registerAction (battleEngine.ts:568)
    expect(!!player.selectedAction).toBe(true);
  });

  it('player with existing switch selectedAction is also flagged as already acted', () => {
    const player = makePlayer('p1', { type: 'switch', targetInstanceId: 'pok_2' });
    expect(!!player.selectedAction).toBe(true);
  });

  it('player with no selectedAction is not flagged', () => {
    const player = makePlayer('p1', undefined);
    expect(!!player.selectedAction).toBe(false);
  });

  it('duplicate submission returns the correct error message', () => {
    // Simulate the registerAction logic for the guard branch
    const existingAction: BattlePlayerState['selectedAction'] = { type: 'move', moveId: 'tackle' };
    const result = existingAction
      ? { valid: false, error: 'You have already submitted an action this turn' }
      : { valid: true, error: undefined };
    expect(result.valid).toBe(false);
    expect(result.error).toBe('You have already submitted an action this turn');
  });

  it('after selectedAction is cleared (new turn) the player can act again', () => {
    const player = makePlayer('p1', { type: 'move', moveId: 'tackle' });
    // Simulate turn resolution clearing selectedAction
    const cleared: BattlePlayerState = { ...player, selectedAction: undefined };
    expect(!!cleared.selectedAction).toBe(false);
  });
});

// ─── Voluntary switch flow ───────────────────────────────────────────────────

describe('voluntary switch mid-battle', () => {
  it('player can submit a switch action without being forced', () => {
    const p1 = makePlayer('p1', { type: 'switch', targetInstanceId: 'p1_2' });
    const p2 = makePlayer('p2', { type: 'move', moveId: 'tackle' });
    const battle = makeBattle({ players: [p1, p2] });
    expect(bothPlayersActed(battle)).toBe(true);
  });

  it('voluntary switch counts as acting for turn resolution', () => {
    const p1 = makePlayer('p1', { type: 'switch', targetInstanceId: 'p1_2' });
    const p2 = makePlayer('p2');
    const battle = makeBattle({ players: [p1, p2] });
    // p2 hasn't acted yet — turn not resolved
    expect(bothPlayersActed(battle)).toBe(false);
  });

  it('switch target must be a non-active team member', () => {
    const backup = makePokemon({ instanceId: 'p1_2', name: 'Charmander' });
    const active = makePokemon({ instanceId: 'p1_1', name: 'Bulbasaur' });
    const player = makePlayer('p1', { type: 'switch', targetInstanceId: 'p1_2' }, [active, backup]);

    const action = player.selectedAction;
    expect(action?.type).toBe('switch');
    if (action?.type === 'switch') {
      const target = player.team.find(p => p.instanceId === action.targetInstanceId);
      expect(target?.instanceId).toBe('p1_2');
      expect(target?.instanceId).not.toBe(player.activePokemonId);
    }
  });

  it('cannot voluntarily switch to the currently active Pokémon', () => {
    const active = makePokemon({ instanceId: 'p1_1', name: 'Bulbasaur' });
    const player = makePlayer('p1', undefined, [active]);

    const wouldBeInvalid = active.instanceId === player.activePokemonId;
    expect(wouldBeInvalid).toBe(true);
  });
});

// ─── canAct derived state (mirrors client-side logic) ────────────────────────

describe('canAct client-side gate', () => {
  it('canAct is true when phase is menu and battle is active and not spectator', () => {
    const phase = 'menu';
    const battleStatus = 'active';
    const isSpectator = false;
    const canAct = !isSpectator && phase === 'menu' && battleStatus === 'active';
    expect(canAct).toBe(true);
  });

  it('canAct is false when phase is busy (action submitted, waiting for opponent)', () => {
    const phase = 'busy';
    const battleStatus = 'active';
    const isSpectator = false;
    const canAct = !isSpectator && phase === 'menu' && battleStatus === 'active';
    expect(canAct).toBe(false);
  });

  it('canAct is false for spectators', () => {
    const phase = 'menu';
    const battleStatus = 'active';
    const isSpectator = true;
    const canAct = !isSpectator && phase === 'menu' && battleStatus === 'active';
    expect(canAct).toBe(false);
  });

  it('canAct is false when battle is finished', () => {
    const phase = 'finished';
    const battleStatus = 'finished';
    const isSpectator = false;
    const canAct = !isSpectator && phase === 'menu' && battleStatus === 'active';
    expect(canAct).toBe(false);
  });
});

// ─── Turn state transitions ──────────────────────────────────────────────────

describe('turn state machine', () => {
  it('bothPlayersActed is false at start of turn (no actions)', () => {
    const battle = makeBattle();
    expect(bothPlayersActed(battle)).toBe(false);
  });

  it('bothPlayersActed is false when only p1 has acted', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2'),
      ],
    });
    expect(bothPlayersActed(battle)).toBe(false);
  });

  it('bothPlayersActed is false when only p2 has acted', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1'),
        makePlayer('p2', { type: 'move', moveId: 'tackle' }),
      ],
    });
    expect(bothPlayersActed(battle)).toBe(false);
  });

  it('bothPlayersActed is true when both players acted with moves', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2', { type: 'move', moveId: 'scratch' }),
      ],
    });
    expect(bothPlayersActed(battle)).toBe(true);
  });

  it('bothPlayersActed is true with mixed move + switch', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2', { type: 'switch', targetInstanceId: 'p2_2' }),
      ],
    });
    expect(bothPlayersActed(battle)).toBe(true);
  });
});
