// All TypeScript types for PokeBattle frontend
// Source of truth: design_handoff_pokebattle/README.md "Data shapes" section

export type PokemonType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export type StatusType =
  | 'burn' | 'poison' | 'paralysis' | 'sleep' | 'freeze'
  | 'attackDown' | 'defenseDown' | 'speedDown';

export type StatusCondition = {
  type: StatusType;
  remainingTurns?: number;
};

export type Move = {
  id: string;
  name: string;
  type: PokemonType;
  power: number;
  accuracy: number;
  pp: number;
  damageClass: 'physical' | 'special' | 'status';
};

export type Action =
  | { type: 'move'; moveId: string }
  | { type: 'switch'; targetInstanceId: string };

// From GET /pokemon (catalog)
export type CatalogPokemon = {
  id: number;
  name: string;
  types: PokemonType[];
  stats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  spriteUrl: string;
  spriteBackUrl?: string;
  shinySpriteUrl?: string;
};

// From GET /battle/:code — per-pokemon in battle
export type BattleCreature = {
  instanceId: string;
  pokedexId: number;
  name: string;
  level: number;
  types: PokemonType[];
  currentHp: number;
  maxHp: number;
  stats: {
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  spriteUrl: string;
  spriteBackUrl?: string;
  shinySpriteUrl?: string;
  moves: Move[];
  statusConditions: StatusCondition[];
};

export type BattlePlayer = {
  id: string;
  name: string;
  activePokemonId: string;
  team: BattleCreature[];
  selectedAction: Action | null;
};

export type BattleState = {
  roomCode: string;
  turn: number;
  status: 'waiting' | 'active' | 'finished';
  winnerPlayerId: string | null;
  players: [BattlePlayer, BattlePlayer];
  battleLog: string[];
};

// From GET /rooms/:code
export type RoomPlayer = {
  id: string;
  name: string;
  isReady: boolean;
};

export type RoomState = {
  code: string;
  status: 'waiting' | 'ready' | 'battling' | 'finished';
  players: RoomPlayer[];
  createdAt: string;
};

// Toast notification
export type ToastState = {
  msg: string;
  kind?: 'error' | 'warn' | 'success' | 'info';
} | null;

// Scene type for background
export type SceneType = 'cave' | 'grass' | 'water' | 'sunset';
