import React from 'react';

// Accept the minimal shape BallRow actually needs —
// both BattleCreature (local) and BattlePokemon (shared) satisfy this.
interface PokemonLike {
  instanceId: string;
  currentHp: number;
}

interface BallRowProps {
  team: PokemonLike[];
  activePokemonId: string;
  /** Mirror for opponent row (right-aligned, dots reversed) */
  mirror?: boolean;
}

function PokeBall({ alive, active }: { alive: boolean; active: boolean }) {
  const fill = active ? '#e84028' : alive ? '#e84028' : '#3a2a3a';
  const outline = active ? '#fff' : alive ? '#705746' : '#2a1f2e';
  const shine = alive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)';

  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      style={{
        filter: active ? 'drop-shadow(0 0 3px #fff)' : undefined,
        transition: 'filter 0.2s',
      }}
    >
      {/* Top half */}
      <path d="M1 7 A6 6 0 0 1 13 7 Z" fill={fill} />
      {/* Bottom half */}
      <path d="M1 7 A6 6 0 0 0 13 7 Z" fill="#f0f0f0" opacity={alive ? 1 : 0.3} />
      {/* Middle band */}
      <line x1="1" y1="7" x2="13" y2="7" stroke="#14101a" strokeWidth="1.5" />
      {/* Center button */}
      <circle cx="7" cy="7" r="2.2" fill="#f0f0f0" stroke="#14101a" strokeWidth="1" />
      <circle cx="7" cy="7" r="1" fill={active ? fill : '#f0f0f0'} />
      {/* Outer ring */}
      <circle cx="7" cy="7" r="6" fill="none" stroke={outline} strokeWidth="1.5" />
      {/* Shine */}
      <ellipse cx="5" cy="4.5" rx="1.5" ry="1" fill={shine} />
    </svg>
  );
}

export function BallRow({ team, activePokemonId, mirror = false }: BallRowProps) {
  const balls = team.map((p) => ({
    id: p.instanceId,
    alive: p.currentHp > 0,
    active: p.instanceId === activePokemonId,
  }));

  const displayed = mirror ? [...balls].reverse() : balls;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        justifyContent: mirror ? 'flex-end' : 'flex-start',
      }}
    >
      {displayed.map((b) => (
        <PokeBall key={b.id} alive={b.alive} active={b.active} />
      ))}
    </div>
  );
}
