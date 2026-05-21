// ─── MongoDB Document Types ────────────────────────────────────────────────

export interface PokemonDoc {
  pokedexId: number;
  name: string;
  types: string[];
  baseStats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  spriteUrl: string;
  shinySpriteUrl?: string;
  moveIds: string[]; // Exactly 4
}

export interface MoveDoc {
  id: string;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  priority: number;
  damageClass: "physical" | "special" | "status";
  effect: string;
}

export interface TypeRelationDoc {
  type: string;
  doubleDamageTo: string[];
  halfDamageTo: string[];
  noDamageTo: string[];
  doubleDamageFrom: string[];
  halfDamageFrom: string[];
  noDamageFrom: string[];
}

// ─── Room / Lobby Types ────────────────────────────────────────────────────

export interface RoomPlayer {
  id: string;
  name: string;
  team: number[]; // pokedexIds selected during team selection phase
  activePokemonId: string;
  isReady: boolean;
}

export interface RoomDoc {
  code: string;
  status: "waiting" | "ready" | "battling" | "finished";
  players: RoomPlayer[];
  createdAt: Date;
}

// ─── Battle Types ──────────────────────────────────────────────────────────

export type StatusType =
  | "burn"
  | "poison"
  | "paralysis"
  | "attackDown"
  | "defenseDown"
  | "speedDown";

export interface StatusCondition {
  type: StatusType;
  remainingTurns: number;
}

export interface BattleMove {
  id: string;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  priority: number;
  damageClass: "physical" | "special" | "status";
  effect: string;
}

export interface BattlePokemonStats {
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface BattlePokemonIVs {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

// Stage modifiers per stat (-6 to +6)
export interface StatStages {
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface BattlePokemon {
  instanceId: string;
  pokedexId: number;
  name: string;
  types: string[];
  currentHp: number;
  maxHp: number;
  stats: BattlePokemonStats; // Base battle stats (before stage modifiers)
  stages: StatStages; // Current stage modifiers
  moves: BattleMove[];
  statusConditions: StatusCondition[];
  ivs: BattlePokemonIVs;
  spriteUrl: string;
  shinySpriteUrl?: string;
  isShiny?: boolean;
}

// ─── User / Subscription Types ─────────────────────────────────────────────

export interface UserDoc {
  clerkId: string;
  email: string;
  subscriptionStatus: 'none' | 'active' | 'canceled' | 'past_due';
  shinyUnlocked: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionEndsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type MoveAction = { type: "move"; moveId: string };
export type SwitchAction = { type: "switch"; targetInstanceId: string };
export type Action = MoveAction | SwitchAction;

export interface BattlePlayerState {
  id: string;
  team: BattlePokemon[];
  activePokemonId: string; // instanceId
  selectedAction?: Action;
}

export interface BattleDoc {
  roomCode: string;
  turn: number;
  status: "active" | "finished";
  players: BattlePlayerState[];
  battleLog: string[];
  winnerPlayerId?: string;
}

// ─── API Response Types ────────────────────────────────────────────────────

export interface CreateRoomResponse {
  code: string;
}

export interface JoinRoomResponse {
  playerId: string;
  room: RoomDoc;
}

export interface RoomStateResponse {
  room: RoomDoc;
  battle?: BattleDoc;
}

export interface PokemonListResponse {
  pokemon: PokemonDoc[];
  total: number;
}

export interface ActionResponse {
  battle: BattleDoc;
}
