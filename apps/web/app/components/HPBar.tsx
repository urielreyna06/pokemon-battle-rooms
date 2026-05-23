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

  const gradient =
    pct > 50
      ? 'linear-gradient(90deg, #2ecc71, #27ae60)'
      : pct > 20
      ? 'linear-gradient(90deg, #f39c12, #e67e22)'
      : 'linear-gradient(90deg, #e74c3c, #c0392b)';

  return (
    <div style={{ width }}>
      <div className="flex items-center gap-2">
        <span className="hp-label">HP</span>
        <div
          className="flex-1"
          style={{
            height: '12px',
            borderRadius: '6px',
            background: '#0e0e1a',
            border: '1px solid rgba(255,255,255,0.15)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: gradient,
              borderRadius: '6px',
              transition: 'width 0.3s ease, background 0.3s ease',
            }}
          />
        </div>
      </div>
      {showNumeric && (
        <div
          className="mt-1.5 text-right font-pixel-body text-[20px] leading-none tabular-nums"
          style={{ color: '#d0c8e0' }}
        >
          {Math.max(0, Math.round(current))}
          <span style={{ color: '#7a6a8a' }}>/{max}</span>
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
