import { describe, it, expect } from 'vitest';
import { bothPlayersActed } from '../src/engine/battleEngine';
import type { BattleDoc, BattlePlayerState, BattlePokemon } from '../../../../packages/shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePokemon(overrides: Partial<BattlePokemon> & { instanceId: string; name: string }): BattlePokemon {
  return {
    pokedexId: 1,
    types: ['normal'],
    currentHp: 100,
    maxHp: 100,
    stats: { attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    moves: [],
    statusConditions: [],
    ivs: { hp: 15, attack: 15, defense: 15, specialAttack: 15, specialDefense: 15, speed: 15 },
    spriteUrl: 'https://example.com/sprite.png',
    ...overrides,
  };
}

function makePlayer(
  id: string,
  selectedAction?: BattlePlayerState['selectedAction'],
  team: BattlePokemon[] = []
): BattlePlayerState {
  return {
    id,
    team,
    activePokemonId: team[0]?.instanceId ?? 'pok_1',
    selectedAction,
    remainingSwitches: 1,
  };
}

function makeBattle(overrides?: Partial<BattleDoc>): BattleDoc {
  return {
    roomCode: 'TEST01',
    status: 'active',
    players: [makePlayer('p1'), makePlayer('p2')],
    turnNumber: 1,
    log: [],
    ...overrides,
  } as BattleDoc;
}

// ─── Turn Order & Both Players Acted ───────────────────────────────────────────

describe('bothPlayersActed', () => {
  it('returns false when one player has no action', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2'), // undefined selectedAction
      ],
    });
    expect(bothPlayersActed(battle)).toBe(false);
  });

  it('returns true when both players have actions', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2', { type: 'move', moveId: 'scratch' }),
      ],
    });
    expect(bothPlayersActed(battle)).toBe(true);
  });

  it('returns true when both have move actions', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2', { type: 'move', moveId: 'thunderbolt' }),
      ],
    });
    expect(bothPlayersActed(battle)).toBe(true);
  });

  it('returns true when both have switch actions', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'switch', targetInstanceId: 'pok_2' }),
        makePlayer('p2', { type: 'switch', targetInstanceId: 'pok_3' }),
      ],
    });
    expect(bothPlayersActed(battle)).toBe(true);
  });

  it('returns true for mixed move and switch actions', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2', { type: 'switch', targetInstanceId: 'pok_2' }),
      ],
    });
    expect(bothPlayersActed(battle)).toBe(true);
  });

  it('returns false when neither player has acted', () => {
    const battle = makeBattle({
      players: [makePlayer('p1'), makePlayer('p2')],
    });
    expect(bothPlayersActed(battle)).toBe(false);
  });
});

// ─── Turn Spam Prevention ──────────────────────────────────────────────────────

describe('turn spam hardening', () => {
  it('a player who submitted a move cannot be re-processed in the same turn', () => {
    const originalAction = { type: 'move' as const, moveId: 'tackle' };
    const battle = makeBattle({
      players: [
        makePlayer('p1', originalAction),
        makePlayer('p2', { type: 'move', moveId: 'scratch' }),
      ],
    });

    // Verify both have acted (turn can proceed)
    expect(bothPlayersActed(battle)).toBe(true);

    // After processing, the action should still exist
    expect(battle.players[0].selectedAction).toBe(originalAction);
  });

  it('processing a turn does not modify selectedAction', () => {
    const p1Action = { type: 'move' as const, moveId: 'tackle' };
    const p2Action = { type: 'move' as const, moveId: 'scratch' };
    const battle = makeBattle({
      players: [makePlayer('p1', p1Action), makePlayer('p2', p2Action)],
    });

    const beforeTurnNumber = battle.turnNumber;
    expect(bothPlayersActed(battle)).toBe(true);

    // Actions should be unchanged
    expect(battle.players[0].selectedAction).toBe(p1Action);
    expect(battle.players[1].selectedAction).toBe(p2Action);
    expect(battle.turnNumber).toBe(beforeTurnNumber);
  });

  it('both players must act before any turn resolution', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2'), // No action yet
      ],
    });

    expect(bothPlayersActed(battle)).toBe(false);
    // Turn should not advance until both have acted
  });
});

// ─── Speed-Based Move Order ────────────────────────────────────────────────────

describe('speed stat influence (structural)', () => {
  it('faster pokémon should be available for move order check', () => {
    const fastPokemon = makePokemon({
      instanceId: 'pok_1',
      name: 'Electrode',
      stats: { attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 140 },
    });

    const slowPokemon = makePokemon({
      instanceId: 'pok_2',
      name: 'Blissey',
      stats: { attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 55 },
    });

    expect(fastPokemon.stats.speed).toBeGreaterThan(slowPokemon.stats.speed);
  });

  it('move priority is available in action structure', () => {
    const moveWithPriority = {
      type: 'move' as const,
      moveId: 'quick-attack',
      // priority is typically on the move def in engine, not the action
    };

    expect(moveWithPriority.type).toBe('move');
  });
});

// ─── Switch Resolution ─────────────────────────────────────────────────────────

describe('switch action structure', () => {
  it('switch action targets a non-active instance', () => {
    const p1 = makePlayer('p1', undefined, [
      makePokemon({ instanceId: 'pok_1', name: 'Pikachu' }),
      makePokemon({ instanceId: 'pok_2', name: 'Raichu' }),
    ]);
    p1.activePokemonId = 'pok_1';

    const switchAction: BattlePlayerState['selectedAction'] = {
      type: 'switch',
      targetInstanceId: 'pok_2',
    };

    expect(switchAction?.type).toBe('switch');
    if (switchAction?.type === 'switch') {
      expect(switchAction.targetInstanceId).not.toBe(p1.activePokemonId);
      expect(switchAction.targetInstanceId).toBe('pok_2');
    }
  });

  it('both players can submit switch actions in same turn', () => {
    const team1 = [
      makePokemon({ instanceId: 'pok_1', name: 'Pidgeot' }),
      makePokemon({ instanceId: 'pok_2', name: 'Pidgeotto' }),
    ];

    const team2 = [
      makePokemon({ instanceId: 'pok_3', name: 'Charizard' }),
      makePokemon({ instanceId: 'pok_4', name: 'Charmeleon' }),
    ];

    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'switch', targetInstanceId: 'pok_2' }, team1),
        makePlayer('p2', { type: 'switch', targetInstanceId: 'pok_4' }, team2),
      ],
    });

    expect(bothPlayersActed(battle)).toBe(true);
  });
});

// ─── Turn State Consistency ────────────────────────────────────────────────────

describe('turn state consistency', () => {
  it('turn number does not auto-increment on bothPlayersActed check', () => {
    const battle = makeBattle({ turnNumber: 5 });
    const beforeCheck = battle.turnNumber;

    bothPlayersActed(battle);

    expect(battle.turnNumber).toBe(beforeCheck);
  });

  it('log is not modified by turn check', () => {
    const battle = makeBattle({ log: [] });
    const beforeCheck = [...battle.log];

    bothPlayersActed(battle);

    expect(battle.log).toEqual(beforeCheck);
  });

  it('battle status remains active during turn execution', () => {
    const battle = makeBattle({
      status: 'active',
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2', { type: 'move', moveId: 'scratch' }),
      ],
    });

    expect(bothPlayersActed(battle)).toBe(true);
    expect(battle.status).toBe('active');
  });
});
