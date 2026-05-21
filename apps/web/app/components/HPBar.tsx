import React from 'react';

interface HPBarProps {
  current: number;
  max: number;
  showNumeric?: boolean;
  showExp?: boolean;
  expPct?: number;
  width?: string;
}

export function HPBar({
  current,
  max,
  showNumeric = false,
  showExp = false,
  expPct = 42,
  width = '100%',
}: HPBarProps) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const fillClass = pct > 50 ? '' : pct > 20 ? 'mid' : 'lo';

  return (
    <div style={{ width }}>
      <div className="flex items-center gap-2">
        <span className="hp-label">HP</span>
        <div className="flex-1 hp-track">
          <div className={`hp-fill ${fillClass}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {showNumeric && (
        <div
          className="mt-1.5 text-right font-pixel-body text-[20px] leading-none tabular-nums"
          style={{ color: '#2a1f2e' }}
        >
          {Math.max(0, Math.round(current))}
          <span style={{ color: '#5b4a5e' }}>/{max}</span>
        </div>
      )}
      {showExp && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="font-pixel text-[8px]" style={{ color: '#5b4a5e' }}>EXP</span>
          <div className="flex-1 xp-track">
            <div className="xp-fill" style={{ width: `${expPct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
