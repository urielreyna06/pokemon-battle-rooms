/**
 * Battle Engine — all combat logic lives here.
 * The frontend never calculates damage; it only sends player decisions.
 */

import { randomUUID } from "crypto";
import type { Db } from "mongodb";
import type {
  BattleDoc,
  BattlePokemon,
  BattlePokemonIVs,
  BattlePokemonStats,
  BattleMove,
  BattlePlayerState,
  Action,
  StatusType,
  StatusCondition,
  StatStages,
  PokemonDoc,
  MoveDoc,
  TypeRelationDoc,
} from "../../../../packages/shared/types";

const LEVEL = 50;

// ─── Stat calculation ─────────────────────────────────────────────────────

function randomIV(): number {
  return Math.floor(Math.random() * 32); // 0–31
}

function calcHP(baseHp: number, iv: number): number {
  return Math.floor(((2 * baseHp + iv) * LEVEL) / 100) + LEVEL + 10;
}

function calcStat(baseStat: number, iv: number): number {
  return Math.floor(((2 * baseStat + iv) * LEVEL) / 100) + 5;
}

function buildIVs(): BattlePokemonIVs {
  return {
    hp: randomIV(),
    attack: randomIV(),
    defense: randomIV(),
    specialAttack: randomIV(),
    specialDefense: randomIV(),
    speed: randomIV(),
  };
}

function buildStats(
  base: PokemonDoc["baseStats"],
  ivs: BattlePokemonIVs
): BattlePokemonStats {
  return {
    attack: calcStat(base.attack, ivs.attack),
    defense: calcStat(base.defense, ivs.defense),
    specialAttack: calcStat(base.specialAttack, ivs.specialAttack),
    specialDefense: calcStat(base.specialDefense, ivs.specialDefense),
    speed: calcStat(base.speed, ivs.speed),
  };
}

function emptyStages(): StatStages {
  return { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
}

// ─── Effective stat after stage modifier ─────────────────────────────────

function effectiveStat(base: number, stage: number): number {
  const clamped = Math.max(-6, Math.min(6, stage));
  const multiplier = clamped >= 0 ? (2 + clamped) / 2 : 2 / (2 - clamped);
  return Math.floor(base * multiplier);
}

// ─── Type effectiveness lookup ────────────────────────────────────────────

async function getTypeMultiplier(
  db: Db,
  moveType: string,
  defenderTypes: string[]
): Promise<number> {
  let multiplier = 1;
  for (const defType of defenderTypes) {
    const rel = await db
      .collection<TypeRelationDoc>("type_relations")
      .findOne({ type: moveType });

    if (!rel) continue;

    if (rel.noDamageTo.includes(defType)) {
      multiplier *= 0;
    } else if (rel.doubleDamageTo.includes(defType)) {
      multiplier *= 2;
    } else if (rel.halfDamageTo.includes(defType)) {
      multiplier *= 0.5;
    }
    // else multiplier *= 1 (no change)
  }
  return multiplier;
}

// ─── Damage calculation ───────────────────────────────────────────────────

async function calculateDamage(
  db: Db,
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: BattleMove
): Promise<{ damage: number; typeMultiplier: number; isCritical: boolean }> {
  if (move.damageClass === "status" || !move.power) {
    return { damage: 0, typeMultiplier: 1, isCritical: false };
  }

  const attackStage =
    move.damageClass === "physical" ? attacker.stages.attack : attacker.stages.specialAttack;
  const defenseStage =
    move.damageClass === "physical" ? defender.stages.defense : defender.stages.specialDefense;

  const attackStat =
    move.damageClass === "physical"
      ? effectiveStat(attacker.stats.attack, attackStage)
      : effectiveStat(attacker.stats.specialAttack, attackStage);

  const defenseStat =
    move.damageClass === "physical"
      ? effectiveStat(defender.stats.defense, defenseStage)
      : effectiveStat(defender.stats.specialDefense, defenseStage);

  // Core damage formula (Gen 4+)
  const baseDamage =
    Math.floor(
      Math.floor(
        (Math.floor((2 * LEVEL) / 5 + 2) * move.power * attackStat) / defenseStat
      ) / 50
    ) + 2;

  const randomFactor = (Math.floor(Math.random() * 16) + 85) / 100; // 85–100
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;

  const typeMultiplier = await getTypeMultiplier(db, move.type, defender.types);

  if (typeMultiplier === 0) {
    return { damage: 0, typeMultiplier: 0, isCritical: false };
  }

  const isCritical = Math.random() < 1 / 24;
  const critical = isCritical ? 1.5 : 1;

  const isBurned = attacker.statusConditions.some((s) => s.type === "burn");
  const burnModifier = isBurned && move.damageClass === "physical" ? 0.5 : 1;

  const modifier = randomFactor * stab * typeMultiplier * critical * burnModifier;
  const finalDamage = Math.max(1, Math.floor(baseDamage * modifier));

  return { damage: finalDamage, typeMultiplier, isCritical };
}

// ─── Status application ───────────────────────────────────────────────────

function applyStatus(pokemon: BattlePokemon, statusType: StatusType): boolean {
  // Don't stack the same status
  if (pokemon.statusConditions.some((s) => s.type === statusType)) return false;

  // Burn/Poison/Paralysis are mutually exclusive (primary status)
  const primaryStatuses: StatusType[] = ["burn", "poison", "paralysis"];
  if (
    primaryStatuses.includes(statusType) &&
    pokemon.statusConditions.some((s) => primaryStatuses.includes(s.type))
  ) {
    return false;
  }

  pokemon.statusConditions.push({ type: statusType, remainingTurns: 3 });
  return true;
}

function clearStatuses(pokemon: BattlePokemon): void {
  pokemon.statusConditions = [];
  pokemon.stages = emptyStages();
}

// ─── End-of-turn resolution ───────────────────────────────────────────────

function endOfTurnResolution(pokemon: BattlePokemon): string[] {
  const log: string[] = [];

  for (const status of [...pokemon.statusConditions]) {
    if (status.type === "burn") {
      const dmg = Math.floor(pokemon.maxHp * 0.05);
      pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
      log.push(`${pokemon.name} takes ${dmg} burn damage!`);
    } else if (status.type === "poison") {
      const dmg = Math.floor(pokemon.maxHp * 0.05);
      pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
      log.push(`${pokemon.name} takes ${dmg} poison damage!`);
    } else if (status.type === "attackDown") {
      if (pokemon.stages.attack > -6) {
        pokemon.stages.attack -= 1;
        log.push(`${pokemon.name}'s Attack fell!`);
      }
    } else if (status.type === "defenseDown") {
      if (pokemon.stages.defense > -6) {
        pokemon.stages.defense -= 1;
        log.push(`${pokemon.name}'s Defense fell!`);
      }
    } else if (status.type === "speedDown") {
      if (pokemon.stages.speed > -6) {
        pokemon.stages.speed -= 1;
        log.push(`${pokemon.name}'s Speed fell!`);
      }
    }

    // Decrement and remove if expired
    status.remainingTurns -= 1;
    if (status.remainingTurns <= 0) {
      pokemon.statusConditions = pokemon.statusConditions.filter((s) => s !== status);
      log.push(`${pokemon.name}'s ${status.type} wore off!`);
    }
  }

  return log;
}

// ─── Effect parsing ───────────────────────────────────────────────────────

function getStatusFromEffect(effect: string): StatusType | null {
  const lower = effect.toLowerCase();
  if (lower.includes("burn")) return "burn";
  if (lower.includes("poison")) return "poison";
  if (lower.includes("paralyze") || lower.includes("paralysis")) return "paralysis";
  if (lower.includes("lowers the target's attack")) return "attackDown";
  if (lower.includes("lowers the target's defense")) return "defenseDown";
  if (lower.includes("lowers the target's speed")) return "speedDown";
  return null;
}

// ─── Paralysis check ─────────────────────────────────────────────────────

function isParalyzed(pokemon: BattlePokemon): boolean {
  return pokemon.statusConditions.some((s) => s.type === "paralysis");
}

function paralysisBlocks(): boolean {
  return Math.random() < 0.25; // 25% chance to be fully paralyzed
}

// ─── Victory check ────────────────────────────────────────────────────────

function checkVictory(battle: BattleDoc): string | null {
  for (const player of battle.players) {
    const allFainted = player.team.every((p) => p.currentHp <= 0);
    if (allFainted) {
      // The OTHER player wins
      const winner = battle.players.find((p) => p.id !== player.id);
      return winner?.id ?? null;
    }
  }
  return null;
}

// ─── Battle initialization ────────────────────────────────────────────────

const SHINY_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny';
const SHINY_CHANCE = 0.05;

export async function initializeBattle(
  db: Db,
  roomCode: string,
  playerConfigs: Array<{ id: string; selectedPokedexIds: number[] }>
): Promise<BattleDoc> {
  const players: BattlePlayerState[] = [];

  // Resolve shiny eligibility once per player (avoids per-pokemon DB calls)
  const shinyPlayerIds = new Set<string>();
  for (const config of playerConfigs) {
    const user = await db.collection('users').findOne({ clerkId: config.id });
    if (user?.shinyUnlocked) shinyPlayerIds.add(config.id);
  }

  for (const config of playerConfigs) {
    const team: BattlePokemon[] = [];

    for (const pokedexId of config.selectedPokedexIds) {
      const pokDoc = await db
        .collection<PokemonDoc>("pokemon")
        .findOne({ pokedexId });

      if (!pokDoc) throw new Error(`Pokémon ${pokedexId} not found in DB`);

      // Fetch move details
      const moves: BattleMove[] = [];
      for (const moveId of pokDoc.moveIds) {
        const moveDoc = await db.collection<MoveDoc>("moves").findOne({ id: moveId });
        if (!moveDoc) throw new Error(`Move ${moveId} not found in DB`);
        moves.push({
          id: moveDoc.id,
          name: moveDoc.name,
          type: moveDoc.type,
          power: moveDoc.power,
          accuracy: moveDoc.accuracy,
          priority: moveDoc.priority,
          damageClass: moveDoc.damageClass,
          effect: moveDoc.effect,
        });
      }

      const ivs = buildIVs();
      const stats = buildStats(pokDoc.baseStats, ivs);
      const maxHp = calcHP(pokDoc.baseStats.hp, ivs.hp);

      const eligible = shinyPlayerIds.has(config.id);
      const isShiny = eligible && Math.random() < SHINY_CHANCE;

      team.push({
        instanceId: randomUUID(),
        pokedexId: pokDoc.pokedexId,
        name: pokDoc.name,
        types: pokDoc.types,
        currentHp: maxHp,
        maxHp,
        stats,
        stages: emptyStages(),
        moves,
        statusConditions: [],
        ivs,
        spriteUrl: pokDoc.spriteUrl,
        isShiny,
        ...(isShiny ? { shinySpriteUrl: `${SHINY_SPRITE_BASE}/${pokDoc.pokedexId}.png` } : {}),
      });
    }

    players.push({
      id: config.id,
      team,
      activePokemonId: team[0].instanceId,
      selectedAction: undefined,
    });
  }

  const battle: BattleDoc = {
    roomCode,
    turn: 1,
    status: "active",
    players,
    battleLog: ["⚔️  The battle has begun!"],
    winnerPlayerId: undefined,
  };

  await db.collection<BattleDoc>("battles").insertOne(battle as any);
  return battle;
}

// ─── Process turn ─────────────────────────────────────────────────────────

export async function processTurn(
  db: Db,
  battle: BattleDoc
): Promise<BattleDoc> {
  const log: string[] = [];

  // Determine action order (coin flip for MVP)
  const order = [...battle.players].sort(() => Math.random() - 0.5);

  for (const actingPlayer of order) {
    const opponent = battle.players.find((p) => p.id !== actingPlayer.id)!;

    const action = actingPlayer.selectedAction;
    if (!action) continue;

    const activePokemon = actingPlayer.team.find(
      (p) => p.instanceId === actingPlayer.activePokemonId
    )!;

    if (activePokemon.currentHp <= 0) {
      log.push(`${activePokemon.name} has fainted and cannot act!`);
      continue;
    }

    // ── Switch action ─────────────────────────────────────────────
    if (action.type === "switch") {
      const target = actingPlayer.team.find(
        (p) => p.instanceId === action.targetInstanceId
      );

      if (!target || target.currentHp <= 0) {
        log.push(`${actingPlayer.id} tried to switch to an invalid Pokémon!`);
        continue;
      }

      // Clear status conditions from the Pokémon being switched out
      clearStatuses(activePokemon);

      actingPlayer.activePokemonId = target.instanceId;
      log.push(
        `${actingPlayer.id} switched from ${activePokemon.name} to ${target.name}!`
      );
      continue;
    }

    // ── Move action ───────────────────────────────────────────────
    if (action.type === "move") {
      // Paralysis check
      if (isParalyzed(activePokemon) && paralysisBlocks()) {
        log.push(`${activePokemon.name} is fully paralyzed and can't move!`);
        continue;
      }

      const move = activePokemon.moves.find((m) => m.id === action.moveId);
      if (!move) {
        log.push(`Invalid move: ${action.moveId}`);
        continue;
      }

      const activeOpponent = opponent.team.find(
        (p) => p.instanceId === opponent.activePokemonId
      )!;

      if (activeOpponent.currentHp <= 0) {
        log.push(`${activeOpponent.name} has already fainted!`);
        continue;
      }

      log.push(`${activePokemon.name} used ${move.name}!`);

      // Accuracy check
      const accuracy = move.accuracy ?? 100;
      const hitRoll = Math.floor(Math.random() * 100) + 1;
      if (hitRoll > accuracy) {
        log.push(`${activePokemon.name}'s attack missed!`);
        continue;
      }

      // Damage
      const { damage, typeMultiplier, isCritical } = await calculateDamage(
        db,
        activePokemon,
        activeOpponent,
        move
      );

      if (typeMultiplier === 0) {
        log.push(`It doesn't affect ${activeOpponent.name}...`);
      } else {
        if (move.damageClass !== "status" && move.power) {
          if (isCritical) log.push("A critical hit!");
          if (typeMultiplier > 1) log.push("It's super effective!");
          else if (typeMultiplier < 1) log.push("It's not very effective...");

          activeOpponent.currentHp = Math.max(0, activeOpponent.currentHp - damage);
          log.push(
            `${activePokemon.name} dealt ${damage} damage to ${activeOpponent.name}!`
          );

          if (activeOpponent.currentHp === 0) {
            log.push(`${activeOpponent.name} fainted!`);
          }
        }

        // Status effect from move (if applicable and move connects)
        if (move.effect && move.damageClass !== "status") {
          const statusToApply = getStatusFromEffect(move.effect);
          if (statusToApply && Math.random() < 0.3) {
            // 30% chance for secondary effects
            const applied = applyStatus(activeOpponent, statusToApply);
            if (applied) {
              log.push(`${activeOpponent.name} was afflicted with ${statusToApply}!`);
            }
          }
        }

        // Pure status moves apply their effect directly
        if (move.damageClass === "status" && move.effect) {
          const statusToApply = getStatusFromEffect(move.effect);
          if (statusToApply) {
            const applied = applyStatus(activeOpponent, statusToApply);
            if (applied) {
              log.push(`${activeOpponent.name} was afflicted with ${statusToApply}!`);
            }
          }
        }
      }
    }
  }

  // ── End of turn: apply status damage and decrement counters ──────────
  log.push("--- End of turn ---");
  for (const player of battle.players) {
    const active = player.team.find((p) => p.instanceId === player.activePokemonId);
    if (active && active.currentHp > 0) {
      const statusLog = endOfTurnResolution(active);
      log.push(...statusLog);

      if (active.currentHp <= 0) {
        log.push(`${active.name} fainted from status damage!`);
      }
    }
  }

  // Clear selected actions
  for (const player of battle.players) {
    player.selectedAction = undefined;
  }

  battle.battleLog = [...battle.battleLog, ...log].slice(-50); // Keep last 50 entries
  battle.turn += 1;

  // Check for victory
  const winnerId = checkVictory(battle);
  if (winnerId) {
    battle.status = "finished";
    battle.winnerPlayerId = winnerId;
    battle.battleLog.push(`🏆 Player ${winnerId} wins the battle!`);
  }

  // Persist updated battle state
  await db
    .collection<BattleDoc>("battles")
    .updateOne({ roomCode: battle.roomCode }, { $set: battle as any });

  return battle;
}

// ─── Validate and register a player action ───────────────────────────────

export async function registerAction(
  db: Db,
  battle: BattleDoc,
  playerId: string,
  action: Action
): Promise<{ valid: true } | { valid: false; error: string }> {
  const playerState = battle.players.find((p) => p.id === playerId);
  if (!playerState) return { valid: false, error: "Player not in this battle" };

  if (battle.status !== "active") {
    return { valid: false, error: "Battle is not active" };
  }

  if (playerState.selectedAction) {
    return { valid: false, error: "You have already submitted an action this turn" };
  }

  const activePokemon = playerState.team.find(
    (p) => p.instanceId === playerState.activePokemonId
  );
  if (!activePokemon || activePokemon.currentHp <= 0) {
    return { valid: false, error: "Your active Pokémon has fainted. You must switch first." };
  }

  if (action.type === "move") {
    const moveExists = activePokemon.moves.some((m) => m.id === action.moveId);
    if (!moveExists) {
      return {
        valid: false,
        error: `Move ${action.moveId} does not belong to ${activePokemon.name}`,
      };
    }
  }

  if (action.type === "switch") {
    const target = playerState.team.find(
      (p) => p.instanceId === action.targetInstanceId
    );
    if (!target) {
      return { valid: false, error: "Target Pokémon not in your team" };
    }
    if (target.currentHp <= 0) {
      return { valid: false, error: "Cannot switch to a fainted Pokémon" };
    }
    if (target.instanceId === playerState.activePokemonId) {
      return { valid: false, error: "That Pokémon is already active" };
    }
  }

  // Register the action
  playerState.selectedAction = action;

  await db
    .collection<BattleDoc>("battles")
    .updateOne({ roomCode: battle.roomCode }, { $set: { players: battle.players } });

  return { valid: true };
}

// ─── Check if both players have submitted actions ─────────────────────────

export function bothPlayersActed(battle: BattleDoc): boolean {
  // A player with a fainted active Pokémon who hasn't switched yet is exempt
  // from acting — but for MVP, both must act each turn
  return battle.players.every((p) => p.selectedAction !== undefined);
}

// ─── Force a switch when active Pokémon faints ───────────────────────────

export function getFirstLivePokemon(
  playerState: BattlePlayerState
): BattlePokemon | null {
  return (
    playerState.team.find(
      (p) => p.currentHp > 0 && p.instanceId !== playerState.activePokemonId
    ) ?? null
  );
}
