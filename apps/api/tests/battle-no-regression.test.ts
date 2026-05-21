import { describe, it, expect } from 'vitest';
import { bothPlayersActed } from '../src/engine/battleEngine';
import type { BattleDoc, BattlePlayerState, BattlePokemon } from '../../../../packages/shared/types';

function makePlayer(id: string, selectedAction?: BattlePlayerState['selectedAction']): BattlePlayerState {
  return {
    id,
    team: [],
    activePokemonId: 'pok_1',
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

describe('bothPlayersActed', () => {
  it('returns false when neither player has acted', () => {
    expect(bothPlayersActed(makeBattle())).toBe(false);
  });

  it('returns false when only one player has acted', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2'),
      ],
    });
    expect(bothPlayersActed(battle)).toBe(false);
  });

  it('returns true when both players have acted with moves', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2', { type: 'move', moveId: 'scratch' }),
      ],
    });
    expect(bothPlayersActed(battle)).toBe(true);
  });

  it('returns true when both players have acted with switch actions', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'switch', targetInstanceId: 'pok_2' }),
        makePlayer('p2', { type: 'switch', targetInstanceId: 'pok_3' }),
      ],
    });
    expect(bothPlayersActed(battle)).toBe(true);
  });

  it('returns true for mixed move/switch actions', () => {
    const battle = makeBattle({
      players: [
        makePlayer('p1', { type: 'move', moveId: 'tackle' }),
        makePlayer('p2', { type: 'switch', targetInstanceId: 'pok_3' }),
      ],
    });
    expect(bothPlayersActed(battle)).toBe(true);
  });
});

describe('BattleDoc structure integrity', () => {
  it('battle document has required fields', () => {
    const battle = makeBattle();
    expect(battle).toHaveProperty('roomCode');
    expect(battle).toHaveProperty('status');
    expect(battle).toHaveProperty('players');
    expect(battle).toHaveProperty('turnNumber');
    expect(battle).toHaveProperty('log');
    expect(Array.isArray(battle.players)).toBe(true);
    expect(battle.players).toHaveLength(2);
  });

  it('player state has required fields', () => {
    const player = makePlayer('p1', { type: 'move', moveId: 'tackle' });
    expect(player).toHaveProperty('id');
    expect(player).toHaveProperty('team');
    expect(player).toHaveProperty('activePokemonId');
    expect(player).toHaveProperty('selectedAction');
    expect(player).toHaveProperty('remainingSwitches');
  });

  it('BattlePokemon accepts optional isShiny field without breaking', () => {
    const pok: Pick<BattlePokemon, 'instanceId' | 'name' | 'isShiny' | 'shinySpriteUrl'> = {
      instanceId: 'pok_1',
      name: 'Pikachu',
      isShiny: true,
      shinySpriteUrl: 'https://example.com/shiny/25.png',
    };
    expect(pok.isShiny).toBe(true);
    expect(pok.shinySpriteUrl).toBeDefined();
  });

  it('BattlePokemon without shiny fields is valid', () => {
    const pok: Pick<BattlePokemon, 'instanceId' | 'name'> = {
      instanceId: 'pok_2',
      name: 'Charmander',
    };
    expect((pok as BattlePokemon).isShiny).toBeUndefined();
    expect((pok as BattlePokemon).shinySpriteUrl).toBeUndefined();
  });
});
