// TYPE_COLORS — the ONLY hardcoded Pokémon data allowed in the frontend
// All other data (names, stats, sprites, moves) comes from the backend.
import type { PokemonType } from './types';

export const TYPE_COLORS: Record<PokemonType, { bg: string; text: string }> = {
  normal:   { bg: '#A8A77A', text: '#fff' },
  fire:     { bg: '#EE8130', text: '#fff' },
  water:    { bg: '#6390F0', text: '#fff' },
  electric: { bg: '#F7D02C', text: '#000' },
  grass:    { bg: '#7AC74C', text: '#fff' },
  ice:      { bg: '#96D9D6', text: '#000' },
  fighting: { bg: '#C22E28', text: '#fff' },
  poison:   { bg: '#A33EA1', text: '#fff' },
  ground:   { bg: '#E2BF65', text: '#000' },
  flying:   { bg: '#A98FF3', text: '#fff' },
  psychic:  { bg: '#F95587', text: '#fff' },
  bug:      { bg: '#A6B91A', text: '#fff' },
  rock:     { bg: '#B6A136', text: '#000' },
  ghost:    { bg: '#735797', text: '#fff' },
  dragon:   { bg: '#6F35FC', text: '#fff' },
  dark:     { bg: '#705746', text: '#fff' },
  steel:    { bg: '#B7B7CE', text: '#000' },
  fairy:    { bg: '#D685AD', text: '#fff' },
};

export const STATUS_META: Record<string, { abbr: string; bg: string; desc: string }> = {
  burn:        { abbr: 'BRN',   bg: '#e84028', desc: 'Pierde HP cada turno' },
  poison:      { abbr: 'PSN',   bg: '#A33EA1', desc: 'Pierde HP cada turno' },
  paralysis:   { abbr: 'PAR',   bg: '#f8c038', desc: 'Puede perder el turno' },
  sleep:       { abbr: 'SLP',   bg: '#888888', desc: 'No puede moverse' },
  freeze:      { abbr: 'FRZ',   bg: '#96D9D6', desc: 'No puede moverse' },
  attackDown:  { abbr: 'ATK↓', bg: '#e84028', desc: 'Ataque reducido' },
  defenseDown: { abbr: 'DEF↓', bg: '#6390F0', desc: 'Defensa reducida' },
  speedDown:   { abbr: 'SPD↓', bg: '#A98FF3', desc: 'Velocidad reducida' },
};

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
