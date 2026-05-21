import React from 'react';
import { TYPE_COLORS } from '../lib/constants';
import type { BattleMove } from '@pokemon-battle/shared';
import type { PokemonType } from '../lib/types';

interface MoveButtonProps {
  move: BattleMove;
  disabled?: boolean;
  selected?: boolean;
  onClick: () => void;
}

const DAMAGE_CLASS_ICON: Record<BattleMove['damageClass'], string> = {
  physical: '⚔',
  special:  '✦',
  status:   '●',
};

export function MoveButton({ move, disabled = false, selected = false, onClick }: MoveButtonProps) {
  // BattleMove.type is string; cast to PokemonType for color lookup
  const type = move.type as PokemonType;
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.normal;
  const icon = DAMAGE_CLASS_ICON[move.damageClass];
  const isActive = selected && !disabled;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative w-full flex flex-col items-start gap-1 p-2 text-left"
      style={{
        background: disabled ? '#3a2a3a' : isActive ? '#fff' : c.bg,
        color: disabled ? '#5b4a5e' : isActive ? c.bg : c.text,
        border: isActive ? `2px solid ${c.bg}` : '2px solid #14101a',
        boxShadow: disabled
          ? '0 3px 0 #000'
          : `0 3px 0 #000, inset 0 1px 0 rgba(255,255,255,0.3)`,
        textShadow:
          !disabled && !isActive && c.text === '#fff'
            ? '1px 1px 0 rgba(0,0,0,0.5)'
            : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'all 0.08s',
        minHeight: '52px',
        borderRadius: '4px',
        fontFamily: "'Press Start 2P', monospace",
      }}
    >
      {/* Move name */}
      <span
        style={{
          fontSize: '8px',
          lineHeight: 1.3,
          textTransform: 'capitalize',
          letterSpacing: '0.04em',
          display: 'block',
          width: '100%',
          paddingRight: move.power ? '20px' : '0',
        }}
      >
        {move.name.replace(/-/g, ' ')}
      </span>

      {/* Bottom row: type label + damage class icon */}
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '6px',
            textTransform: 'uppercase',
            padding: '1px 4px',
            borderRadius: '2px',
            background: 'rgba(0,0,0,0.3)',
            color: c.text === '#fff' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)',
            letterSpacing: '0.06em',
          }}
        >
          {move.type}
        </span>
        <span
          style={{
            fontSize: '10px',
            marginLeft: 'auto',
            opacity: 0.75,
          }}
          title={move.damageClass}
        >
          {icon}
        </span>
      </span>

      {/* Power top-right */}
      {move.power !== null && move.power > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            fontFamily: "'VT323', monospace",
            fontSize: '14px',
            color:
              c.text === '#fff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
          }}
        >
          {move.power}
        </span>
      )}
    </button>
  );
}
