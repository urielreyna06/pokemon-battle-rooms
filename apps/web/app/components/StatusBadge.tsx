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
      className="inline-flex items-center gap-1 font-pixel uppercase rounded-[3px] text-[8px] px-1.5 py-[2px]"
      style={{
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
