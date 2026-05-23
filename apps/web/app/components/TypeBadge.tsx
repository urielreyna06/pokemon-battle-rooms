import React from 'react';
import { TYPE_COLORS } from '../lib/constants';
import type { PokemonType } from '../lib/types';

type Size = 'xs' | 'sm' | 'md' | 'lg';

interface TypeBadgeProps {
  type: PokemonType;
  size?: Size;
}

const SIZE_STYLES: Record<Size, React.CSSProperties> = {
  xs: { fontSize: '8px',  padding: '2px 6px' },
  sm: { fontSize: '9px',  padding: '2px 8px' },
  md: { fontSize: '10px', padding: '4px 10px' },
  lg: { fontSize: '12px', padding: '4px 12px' },
};

export function TypeBadge({ type, size = 'md' }: TypeBadgeProps) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.normal;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: "'Press Start 2P', monospace",
        textTransform: 'uppercase',
        borderRadius: '3px',
        letterSpacing: '0.06em',
        background: c.bg,
        color: c.text,
        border: '2px solid #14101a',
        boxShadow: '0 2px 0 #000, inset 0 1px 0 rgba(255,255,255,0.4)',
        textShadow: c.text === '#fff' ? '1px 1px 0 rgba(0,0,0,0.5)' : 'none',
        ...SIZE_STYLES[size],
      }}
    >
      {type}
    </span>
  );
}
