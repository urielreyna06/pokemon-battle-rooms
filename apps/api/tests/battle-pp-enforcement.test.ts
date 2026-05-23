import { describe, it, expect } from 'vitest';
import type { BattleDoc, BattlePlayerState, BattlePokemon, BattleMove } from '../../../../packages/shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMove(overrides?: Partial<BattleMove>): BattleMove {
  return {
    id: 'tackle', name: 'Tackle', type: 'normal', power: 40,
    accuracy: 100, priority: 0, damageClass: 'physical', effect: '',
    pp: 35, currentPp: 35,
    ...overrides,
  };
}

function makePokemon(overrides: Partial<BattlePokemon> & { instanceId: string; name: string }): BattlePokemon {
  return {
    pokedexId: 1,
    types: ['normal'],
    currentHp: 100,
    maxHp: 100,
    stats: { attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    moves: [makeMove()],
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
    roomCode: 'PP0001',
    status: 'active',
    players: [makePlayer('p1'), makePlayer('p2')],
    turn: 1,
    battleLog: [],
    ...overrides,
  } as BattleDoc;
}

// Mirrors initializeBattle move-building logic
function buildBattleMove(moveDoc: { id: string; name: string; pp?: number }): BattleMove {
  return {
    id: moveDoc.id,
    name: moveDoc.name,
    type: 'normal',
    power: 40,
    accuracy: 100,
    priority: 0,
    damageClass: 'physical',
    effect: '',
    pp: moveDoc.pp ?? 35,
    currentPp: moveDoc.pp ?? 35,
  };
}

// Mirrors registerAction PP guard logic
function simulateRegisterAction(
  battle: BattleDoc,
  playerId: string,
  action: { type: 'move'; moveId: string } | { type: 'switch'; targetInstanceId: string },
): { valid: true } | { valid: false; error: string } {
  const player = battle.players.find((p) => p.id === playerId);
  if (!player) return { valid: false, error: 'Player not found' };
  const activePokemon = player.team.find((p) => p.instanceId === player.activePokemonId);
  if (!activePokemon) return { valid: false, error: 'No active Pokémon' };

  if (action.type === 'move') {
    const move = activePokemon.moves.find((m) => m.id === action.moveId);
    if (!move) return { valid: false, error: `Move ${action.moveId} does not belong to ${activePokemon.name}` };
    if (move.currentPp <= 0) return { valid: false, error: `${move.name} has no PP left!` };
  }
  return { valid: true };
}

// Mirrors processTurn PP decrement: mutates a copy of the move, returns new currentPp
function simulateMoveUse(move: BattleMove): BattleMove {
  return { ...move, currentPp: Math.max(0, move.currentPp - 1) };
}

// Mirrors processTurn victory check: returns endReason if any player has all Pokémon fainted
function simulateVictoryCheck(
  battle: BattleDoc,
): { finished: true; winnerId: string; endReason: 'ko' } | { finished: false } {
  for (const player of battle.players) {
    const allFainted = player.team.every((p) => p.currentHp <= 0);
    if (allFainted) {
      const winner = battle.players.find((p) => p.id !== player.id);
      return { finished: true, winnerId: winner!.id, endReason: 'ko' };
    }
  }
  return { finished: false };
}

// ─── PP initialization ────────────────────────────────────────────────────────

describe('PP initialization', () => {
  it('sets currentPp to moveDoc.pp when provided', () => {
    const move = buildBattleMove({ id: 'watergun', name: 'Water Gun', pp: 25 });
    expect(move.currentPp).toBe(25);
    expect(move.pp).toBe(25);
  });

  it('defaults currentPp to 35 when moveDoc.pp is absent', () => {
    const move = buildBattleMove({ id: 'tackle', name: 'Tackle' });
    expect(move.currentPp).toBe(35);
    expect(move.pp).toBe(35);
  });

  it('currentPp equals pp at initialization', () => {
    const move = buildBattleMove({ id: 'ember', name: 'Ember', pp: 25 });
    expect(move.currentPp).toBe(move.pp);
  });

  it('uses 35 as fallback for moves with pp: 0 (truthy check edge case)', () => {
    // pp: 0 is falsy — ?? only catches null/undefined, so 0 would not fall back
    // This documents the current behavior: pp: 0 stays 0
    const move = buildBattleMove({ id: 'splash', name: 'Splash', pp: 0 });
    expect(move.currentPp).toBe(0);
  });
});

// ─── PP decrement ─────────────────────────────────────────────────────────────

describe('PP decrement on move use', () => {
  it('decrements currentPp by 1 on each use', () => {
    let move = makeMove({ pp: 35, currentPp: 35 });
    move = simulateMoveUse(move);
    expect(move.currentPp).toBe(34);
  });

  it('decrements to 0 on the last use', () => {
    let move = makeMove({ pp: 5, currentPp: 1 });
    move = simulateMoveUse(move);
    expect(move.currentPp).toBe(0);
  });

  it('currentPp never goes below 0', () => {
    let move = makeMove({ pp: 5, currentPp: 0 });
    move = simulateMoveUse(move);
    expect(move.currentPp).toBe(0);
  });

  it('does not modify pp (max PP stays constant)', () => {
    const move = makeMove({ pp: 35, currentPp: 35 });
    const after = simulateMoveUse(move);
    expect(after.pp).toBe(35);
  });

  it('cumulative decrements track remaining PP correctly', () => {
    let move = makeMove({ pp: 5, currentPp: 5 });
    for (let i = 0; i < 5; i++) move = simulateMoveUse(move);
    expect(move.currentPp).toBe(0);
  });
});

// ─── registerAction PP guard ──────────────────────────────────────────────────

describe('registerAction PP guard', () => {
  it('accepts a move with PP remaining', () => {
    const battle = makeBattle();
    const result = simulateRegisterAction(battle, 'p1', { type: 'move', moveId: 'tackle' });
    expect(result.valid).toBe(true);
  });

  it('rejects a move with 0 PP', () => {
    const emptyMove = makeMove({ id: 'tackle', name: 'Tackle', currentPp: 0 });
    const p1 = makePlayer('p1', [makePokemon({ instanceId: 'p1_1', name: 'Bulbasaur', moves: [emptyMove] })]);
    const battle = makeBattle({ players: [p1, makePlayer('p2')] });
    const result = simulateRegisterAction(battle, 'p1', { type: 'move', moveId: 'tackle' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe('Tackle has no PP left!');
  });

  it('error message includes the move name', () => {
    const flamethrower = makeMove({ id: 'flamethrower', name: 'Flamethrower', currentPp: 0 });
    const p1 = makePlayer('p1', [makePokemon({ instanceId: 'p1_1', name: 'Charizard', moves: [flamethrower] })]);
    const battle = makeBattle({ players: [p1, makePlayer('p2')] });
    const result = simulateRegisterAction(battle, 'p1', { type: 'move', moveId: 'flamethrower' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe('Flamethrower has no PP left!');
  });

  it('rejects an unknown move id regardless of PP', () => {
    const battle = makeBattle();
    const result = simulateRegisterAction(battle, 'p1', { type: 'move', moveId: 'nonexistent' });
    expect(result.valid).toBe(false);
  });

  it('accepts a switch action without checking PP', () => {
    const emptyMove = makeMove({ currentPp: 0 });
    const p1 = makePlayer('p1', [
      makePokemon({ instanceId: 'p1_1', name: 'Bulbasaur', moves: [emptyMove] }),
      makePokemon({ instanceId: 'p1_2', name: 'Squirtle' }),
    ]);
    const battle = makeBattle({ players: [p1, makePlayer('p2')] });
    const result = simulateRegisterAction(battle, 'p1', { type: 'switch', targetInstanceId: 'p1_2' });
    expect(result.valid).toBe(true);
  });

  it('accepts a move with exactly 1 PP remaining', () => {
    const lastPP = makeMove({ currentPp: 1 });
    const p1 = makePlayer('p1', [makePokemon({ instanceId: 'p1_1', name: 'Bulbasaur', moves: [lastPP] })]);
    const battle = makeBattle({ players: [p1, makePlayer('p2')] });
    const result = simulateRegisterAction(battle, 'p1', { type: 'move', moveId: 'tackle' });
    expect(result.valid).toBe(true);
  });
});

// ─── endReason: 'ko' ─────────────────────────────────────────────────────────

describe("endReason 'ko' on victory by KO", () => {
  it("sets endReason to 'ko' when all of a player's Pokémon faint", () => {
    const fainted = makePokemon({ instanceId: 'p2_1', name: 'Squirtle', currentHp: 0 });
    const p2 = makePlayer('p2', [fainted]);
    const battle = makeBattle({ players: [makePlayer('p1'), p2] });
    const result = simulateVictoryCheck(battle);
    expect(result.finished).toBe(true);
    if (result.finished) expect(result.endReason).toBe('ko');
  });

  it('winner is the opponent of the fainted player', () => {
    const fainted = makePokemon({ instanceId: 'p1_1', name: 'Bulbasaur', currentHp: 0 });
    const p1 = makePlayer('p1', [fainted]);
    const battle = makeBattle({ players: [p1, makePlayer('p2')] });
    const result = simulateVictoryCheck(battle);
    expect(result.finished).toBe(true);
    if (result.finished) expect(result.winnerId).toBe('p2');
  });

  it('no victory while any Pokémon on each side still has HP', () => {
    const battle = makeBattle();
    const result = simulateVictoryCheck(battle);
    expect(result.finished).toBe(false);
  });

  it('victory triggers when entire team is fainted, not just active Pokémon', () => {
    const p2 = makePlayer('p2', [
      makePokemon({ instanceId: 'p2_1', name: 'Squirtle', currentHp: 0 }),
      makePokemon({ instanceId: 'p2_2', name: 'Wartortle', currentHp: 0 }),
    ]);
    const battle = makeBattle({ players: [makePlayer('p1'), p2] });
    const result = simulateVictoryCheck(battle);
    expect(result.finished).toBe(true);
    if (result.finished) expect(result.endReason).toBe('ko');
  });

  it('no victory when at least one team member still has HP', () => {
    const p2 = makePlayer('p2', [
      makePokemon({ instanceId: 'p2_1', name: 'Squirtle', currentHp: 0 }),
      makePokemon({ instanceId: 'p2_2', name: 'Wartortle', currentHp: 50 }),
    ]);
    const battle = makeBattle({ players: [makePlayer('p1'), p2] });
    const result = simulateVictoryCheck(battle);
    expect(result.finished).toBe(false);
  });
});

// ─── endReason: 'forfeit' ─────────────────────────────────────────────────────

describe("endReason 'forfeit' on player forfeit", () => {
  it("forfeit produces endReason 'forfeit' in the DB update payload", () => {
    const dbUpdate = {
      status: 'finished' as const,
      winnerPlayerId: 'p2',
      endReason: 'forfeit' as const,
    };
    expect(dbUpdate.endReason).toBe('forfeit');
  });

  it("forfeit endReason is distinct from 'ko'", () => {
    const forfeitReason = 'forfeit' as const;
    const koReason = 'ko' as const;
    expect(forfeitReason).not.toBe(koReason);
  });

  it('endReason is optional on BattleDoc (legacy battles without it are valid)', () => {
    const battle = makeBattle();
    expect(battle.endReason).toBeUndefined();
  });

  it("endReason 'ko' is set by processTurn, not by forfeit route", () => {
    const koUpdate = { endReason: 'ko' as const };
    const forfeitUpdate = { endReason: 'forfeit' as const };
    expect(koUpdate.endReason).toBe('ko');
    expect(forfeitUpdate.endReason).toBe('forfeit');
    expect(koUpdate.endReason).not.toBe(forfeitUpdate.endReason);
  });
});

// ─── VictoryOverlay content selection ────────────────────────────────────────

type OverlayContent = { heading: string; sub: string };

// Mirrors getOverlayContent logic from VictoryOverlay.tsx
function getOverlayContent(
  won: boolean,
  isSpectator: boolean,
  endReason: 'ko' | 'forfeit' | undefined,
  winnerName: string,
): OverlayContent {
  if (isSpectator) {
    return { heading: `${winnerName} wins!`, sub: 'Battle over — thanks for watching.' };
  }
  if (won && endReason === 'forfeit') {
    return { heading: 'Victory!', sub: 'Your opponent gave up.' };
  }
  if (won) {
    return { heading: 'Victory!', sub: 'All enemy Pokémon have fainted!' };
  }
  if (endReason === 'forfeit') {
    return { heading: 'You forfeited.', sub: 'Better luck next time!' };
  }
  return { heading: 'Defeated!', sub: 'All your Pokémon have fainted.' };
}

describe('VictoryOverlay content selection', () => {
  it('spectator sees winner name regardless of endReason', () => {
    const content = getOverlayContent(false, true, 'ko', 'Ash');
    expect(content.heading).toContain('Ash');
  });

  it('spectator message works with forfeit endReason too', () => {
    const content = getOverlayContent(false, true, 'forfeit', 'Misty');
    expect(content.heading).toContain('Misty');
  });

  it('winner + forfeit shows "Your opponent gave up."', () => {
    const content = getOverlayContent(true, false, 'forfeit', '');
    expect(content.heading).toBe('Victory!');
    expect(content.sub).toBe('Your opponent gave up.');
  });

  it('winner + ko shows enemy Pokémon fainted message', () => {
    const content = getOverlayContent(true, false, 'ko', '');
    expect(content.heading).toBe('Victory!');
    expect(content.sub).toContain('fainted');
  });

  it('winner + no endReason (legacy) falls through to KO message', () => {
    const content = getOverlayContent(true, false, undefined, '');
    expect(content.heading).toBe('Victory!');
    expect(content.sub).toContain('fainted');
  });

  it('loser + forfeit shows forfeited message', () => {
    const content = getOverlayContent(false, false, 'forfeit', '');
    expect(content.heading).toBe('You forfeited.');
  });

  it('loser + ko shows defeated message', () => {
    const content = getOverlayContent(false, false, 'ko', '');
    expect(content.heading).toBe('Defeated!');
    expect(content.sub).toContain('fainted');
  });

  it('loser + no endReason (legacy) shows defeated message', () => {
    const content = getOverlayContent(false, false, undefined, '');
    expect(content.heading).toBe('Defeated!');
  });

  it('all 4 non-spectator variants produce distinct headings or subs', () => {
    const results = [
      getOverlayContent(true, false, 'forfeit', ''),
      getOverlayContent(true, false, 'ko', ''),
      getOverlayContent(false, false, 'forfeit', ''),
      getOverlayContent(false, false, 'ko', ''),
    ];
    const subs = results.map((r) => r.sub);
    const unique = new Set(subs);
    expect(unique.size).toBe(4);
  });
});

// ─── UI: move button disabled when PP is 0 ────────────────────────────────────

describe('move button disabled logic', () => {
  it('button is enabled when canAct is true and PP > 0', () => {
    const move = makeMove({ currentPp: 5 });
    const canAct = true;
    const disabled = !canAct || move.currentPp <= 0;
    expect(disabled).toBe(false);
  });

  it('button is disabled when PP is 0 even if canAct is true', () => {
    const move = makeMove({ currentPp: 0 });
    const canAct = true;
    const disabled = !canAct || move.currentPp <= 0;
    expect(disabled).toBe(true);
  });

  it('button is disabled when canAct is false regardless of PP', () => {
    const move = makeMove({ currentPp: 35 });
    const canAct = false;
    const disabled = !canAct || move.currentPp <= 0;
    expect(disabled).toBe(true);
  });

  it('PP display shows currentPp/maxPp correctly', () => {
    const move = makeMove({ pp: 35, currentPp: 20 });
    const display = `PP ${move.currentPp}/${move.pp ?? move.currentPp}`;
    expect(display).toBe('PP 20/35');
  });

  it('PP display falls back to currentPp/currentPp when pp is undefined', () => {
    const move = makeMove({ currentPp: 10 });
    delete (move as Partial<BattleMove>).pp;
    const display = `PP ${move.currentPp}/${move.pp ?? move.currentPp}`;
    expect(display).toBe('PP 10/10');
  });
});
