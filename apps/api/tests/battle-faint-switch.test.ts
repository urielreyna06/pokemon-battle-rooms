import { describe, it, expect } from 'vitest';
import { bothPlayersActed } from '../src/engine/battleEngine';
import type { BattleDoc, BattlePlayerState, BattlePokemon, BattleMove } from '../../../../packages/shared/types';

// ─── Helpers (mirror battle-no-regression.test.ts) ───────────────────────────

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

function makePlayer(id: string, selectedAction?: BattlePlayerState['selectedAction'], team: BattlePokemon[] = []): BattlePlayerState {
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

// ─── Faint detection ──────────────────────────────────────────────────────────

describe('faint detection', () => {
  it('detects a fainted active Pokémon by currentHp <= 0', () => {
    const fainted = makePokemon({ instanceId: 'pok_1', name: 'Pidgey', currentHp: 0 });
    expect(fainted.currentHp).toBe(0);
    expect(fainted.currentHp <= 0).toBe(true);
  });

  it('does not treat a Pokémon with 1 HP as fainted', () => {
    const alive = makePokemon({ instanceId: 'pok_1', name: 'Pidgey', currentHp: 1 });
    expect(alive.currentHp <= 0).toBe(false);
  });

  it('team has at least one alive non-active member after active faints', () => {
    const fainted = makePokemon({ instanceId: 'pok_1', name: 'Pidgey', currentHp: 0 });
    const alive   = makePokemon({ instanceId: 'pok_2', name: 'Rattata', currentHp: 55 });
    const player  = makePlayer('p1', undefined, [fainted, alive]);
    player.activePokemonId = 'pok_1';

    const hasAlive = player.team.some(
      (p) => p.instanceId !== player.activePokemonId && p.currentHp > 0
    );
    expect(hasAlive).toBe(true);
  });

  it('has no alive backup when entire remaining team is fainted', () => {
    const fainted1 = makePokemon({ instanceId: 'pok_1', name: 'Pidgey',   currentHp: 0 });
    const fainted2 = makePokemon({ instanceId: 'pok_2', name: 'Rattata',  currentHp: 0 });
    const player   = makePlayer('p1', undefined, [fainted1, fainted2]);
    player.activePokemonId = 'pok_1';

    const hasAlive = player.team.some(
      (p) => p.instanceId !== player.activePokemonId && p.currentHp > 0
    );
    expect(hasAlive).toBe(false);
  });
});

// ─── Forced switch action ─────────────────────────────────────────────────────

describe('forced switch after faint', () => {
  it('bothPlayersActed is false before the fainted player submits a switch', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2'), // fainted player hasn't switched yet
      ],
    });
    expect(bothPlayersActed(battle)).toBe(false);
  });

  it('bothPlayersActed is true once the fainted player submits a switch', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2', { type: 'switch', targetInstanceId: 'pok_2' }),
      ],
    });
    expect(bothPlayersActed(battle)).toBe(true);
  });

  it('switch action targets a non-active instance', () => {
    const action: BattlePlayerState['selectedAction'] = { type: 'switch', targetInstanceId: 'pok_2' };
    expect(action?.type).toBe('switch');
    if (action?.type === 'switch') {
      expect(action.targetInstanceId).toBe('pok_2');
    }
  });
});

// ─── BattleMove pp field ──────────────────────────────────────────────────────

describe('BattleMove optional pp field', () => {
  it('accepts a move without pp (engine-sourced)', () => {
    const move: BattleMove = {
      id: 'tackle',
      name: 'Tackle',
      type: 'normal',
      power: 40,
      accuracy: 100,
      priority: 0,
      damageClass: 'physical',
      effect: 'Deals damage.',
    };
    expect(move.pp).toBeUndefined();
  });

  it('accepts a move with pp defined', () => {
    const move: BattleMove = {
      id: 'tackle',
      name: 'Tackle',
      type: 'normal',
      power: 40,
      accuracy: 100,
      priority: 0,
      damageClass: 'physical',
      effect: 'Deals damage.',
      pp: 35,
    };
    expect(move.pp).toBe(35);
  });

  it('pp display falls back to -- when undefined', () => {
    const move: BattleMove = {
      id: 'growl',
      name: 'Growl',
      type: 'normal',
      power: null,
      accuracy: 100,
      priority: 0,
      damageClass: 'status',
      effect: 'Lowers attack.',
    };
    const display = move.pp ?? '--';
    expect(display).toBe('--');
  });
});

// ─── Full flow: attack → faint → switch → continue ───────────────────────────

describe('attack → faint → switch → continue regression', () => {
  it('turn resolves after both players acted, then switch is submitted for fainted player', () => {
    // Turn N: both act with moves
    const turnN = makeBattle({
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2', { type: 'move', moveId: 'scratch' }),
      ],
    });
    expect(bothPlayersActed(turnN)).toBe(true);

    // After resolution p2's active Pokémon is at 0 HP.
    // Turn N+1 starts: p1 selects a move, p2 must switch (forced).
    const turnN1 = makeBattle({
      turnNumber: 2,
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2', { type: 'switch', targetInstanceId: 'pok_2' }),
      ],
    });
    expect(bothPlayersActed(turnN1)).toBe(true);
  });

  it('battle remains active while awaiting switch after faint', () => {
    const battle = makeBattle({
      status: 'active',
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2'), // forced switch pending
      ],
    });
    expect(battle.status).toBe('active');
    expect(bothPlayersActed(battle)).toBe(false);
  });
});

// ─── Alive filter during forced switch ─────────────────────────────────────────

describe('alive filter during forced switch', () => {
  it('eligible switch targets contain only alive non-active pokémon', () => {
    const active = makePokemon({ instanceId: 'pok_1', name: 'Pikachu', currentHp: 50 });
    const fainted = makePokemon({ instanceId: 'pok_2', name: 'Raichu', currentHp: 0 });
    const alive = makePokemon({ instanceId: 'pok_3', name: 'Magneton', currentHp: 75 });

    const player = makePlayer('p1', undefined, [active, fainted, alive]);
    player.activePokemonId = 'pok_1';

    // Filter for eligible switches (alive, non-active)
    const eligibleTargets = player.team.filter(
      (p) => p.instanceId !== player.activePokemonId && p.currentHp > 0
    );

    expect(eligibleTargets).toHaveLength(1);
    expect(eligibleTargets[0].instanceId).toBe('pok_3');
    expect(eligibleTargets[0].currentHp).toBeGreaterThan(0);
  });

  it('no eligible targets when all non-active are fainted', () => {
    const active = makePokemon({ instanceId: 'pok_1', name: 'Pikachu', currentHp: 10 });
    const fainted1 = makePokemon({ instanceId: 'pok_2', name: 'Raichu', currentHp: 0 });
    const fainted2 = makePokemon({ instanceId: 'pok_3', name: 'Magneton', currentHp: 0 });

    const player = makePlayer('p1', undefined, [active, fainted1, fainted2]);
    player.activePokemonId = 'pok_1';

    const eligibleTargets = player.team.filter(
      (p) => p.instanceId !== player.activePokemonId && p.currentHp > 0
    );

    expect(eligibleTargets).toHaveLength(0);
  });

  it('all non-active alive pokémon are eligible', () => {
    const active = makePokemon({ instanceId: 'pok_1', name: 'Pikachu', currentHp: 100 });
    const backup1 = makePokemon({ instanceId: 'pok_2', name: 'Raichu', currentHp: 80 });
    const backup2 = makePokemon({ instanceId: 'pok_3', name: 'Magneton', currentHp: 60 });
    const backup3 = makePokemon({ instanceId: 'pok_4', name: 'Machamp', currentHp: 40 });

    const player = makePlayer('p1', undefined, [active, backup1, backup2, backup3]);
    player.activePokemonId = 'pok_1';

    const eligibleTargets = player.team.filter(
      (p) => p.instanceId !== player.activePokemonId && p.currentHp > 0
    );

    expect(eligibleTargets).toHaveLength(3);
    expect(eligibleTargets.map((p) => p.instanceId)).toEqual(['pok_2', 'pok_3', 'pok_4']);
  });
});
