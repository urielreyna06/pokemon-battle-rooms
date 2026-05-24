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
  const type = move.type as PokemonType;
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.normal;
  const icon = DAMAGE_CLASS_ICON[move.damageClass];
  const isActive = selected && !disabled;

  return (
    <button
      data-testid="pb-move"
      data-move-id={move.id}
      onClick={onClick}
      disabled={disabled}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '3px',
        padding: '8px 8px 6px',
        textAlign: 'left',
        background: disabled ? '#d0ccc0' : isActive ? '#fff' : c.bg,
        color: disabled ? '#808070' : isActive ? c.bg : c.text,
        border: isActive ? `2px solid ${c.bg}` : `2px solid ${disabled ? '#b0ac98' : '#282820'}`,
        boxShadow: disabled ? 'none' : '2px 2px 0 rgba(0,0,0,0.35)',
        textShadow:
          !disabled && !isActive && c.text === '#fff'
            ? '1px 1px 0 rgba(0,0,0,0.45)'
            : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.06s',
        minHeight: '52px',
        borderRadius: '3px',
        fontFamily: "'Press Start 2P', monospace",
      }}
    >
      <span
        style={{
          fontSize: '7px',
          lineHeight: 1.3,
          textTransform: 'capitalize',
          letterSpacing: '0.04em',
          display: 'block',
          width: '100%',
          paddingRight: move.power ? '18px' : '0',
        }}
      >
        {move.name.replace(/-/g, ' ')}
      </span>

      <span
        style={{
          fontSize: '11px',
          fontFamily: "'VT323', monospace",
          color: disabled ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.75)',
          letterSpacing: '0.02em',
        }}
      >
        PP {move.currentPp}/{move.pp ?? move.currentPp}
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', width: '100%' }}>
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '5px',
            textTransform: 'uppercase',
            padding: '1px 4px',
            borderRadius: '2px',
            background: 'rgba(0,0,0,0.25)',
            color: c.text === '#fff' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)',
            letterSpacing: '0.06em',
          }}
        >
          {move.type}
        </span>
        <span
          style={{ fontSize: '10px', marginLeft: 'auto', opacity: 0.7 }}
          title={move.damageClass}
        >
          {icon}
        </span>
      </span>

      {move.power !== null && move.power > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '6px',
            right: '5px',
            fontFamily: "'VT323', monospace",
            fontSize: '14px',
            color: c.text === '#fff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
          }}
        >
          {move.power}
        </span>
      )}
    </button>
  );
}
