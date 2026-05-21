import React from 'react';
import { TYPE_COLORS } from '../lib/constants';
import type { PokemonType } from '../lib/types';

type Size = 'xs' | 'sm' | 'md' | 'lg';

interface TypeBadgeProps {
  type: PokemonType;
  size?: Size;
}

const SIZE_CLASSES: Record<Size, string> = {
  xs: 'text-[8px]  px-1.5 py-[2px]',
  sm: 'text-[9px]  px-2   py-0.5',
  md: 'text-[10px] px-2.5 py-1',
  lg: 'text-xs     px-3   py-1',
};

export function TypeBadge({ type, size = 'md' }: TypeBadgeProps) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.normal;
  return (
    <span
      className={`inline-flex items-center font-pixel uppercase rounded-[3px] ${SIZE_CLASSES[size]}`}
      style={{
        background: c.bg,
        color: c.text,
        border: '2px solid #14101a',
        boxShadow: '0 2px 0 #000, inset 0 1px 0 rgba(255,255,255,0.4)',
        letterSpacing: '0.06em',
        textShadow: c.text === '#fff' ? '1px 1px 0 rgba(0,0,0,0.5)' : 'none',
      }}
    >
      {type}
    </span>
  );
}
