import React from 'react';
import { STATUS_META } from '../lib/constants';
import type { StatusType } from '../lib/types';

interface StatusBadgeProps {
  status: StatusType;
  remainingTurns?: number;
}

export function StatusBadge({ status, remainingTurns }: StatusBadgeProps) {
  const meta = STATUS_META[status];
  if (!meta) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontFamily: "'Press Start 2P', monospace",
        textTransform: 'uppercase',
        borderRadius: '3px',
        fontSize: '8px',
        padding: '2px 6px',
        background: meta.bg,
        color: '#fff',
        border: '2px solid #14101a',
        boxShadow: '0 2px 0 #000, inset 0 1px 0 rgba(255,255,255,0.3)',
        letterSpacing: '0.04em',
        textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
      }}
      title={meta.desc}
    >
      {meta.abbr}
      {remainingTurns !== undefined && (
        <span style={{ opacity: 0.8 }}>{remainingTurns}</span>
      )}
    </span>
  );
}
