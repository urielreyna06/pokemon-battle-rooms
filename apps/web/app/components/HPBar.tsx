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
  const barColor = pct > 50 ? '#58d050' : pct > 20 ? '#e8c018' : '#e02818';

  return (
    <div style={{ width }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '7px',
            color: '#484038',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          HP
        </span>
        <div
          style={{
            flex: 1,
            height: '10px',
            background: '#484038',
            border: '2px solid #282020',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: barColor,
              transition: 'width 0.4s ease, background 0.4s ease',
            }}
          />
        </div>
      </div>
      {showNumeric && (
        <div
          style={{
            marginTop: '4px',
            textAlign: 'right',
            fontFamily: "'VT323', monospace",
            fontSize: '18px',
            lineHeight: 1,
            color: '#282828',
          }}
        >
          {Math.max(0, Math.round(current))}
          <span style={{ color: '#888880' }}>/{max}</span>
        </div>
      )}
      {showExp && (
        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '7px',
              color: '#888880',
            }}
          >
            EXP
          </span>
          <div
            style={{
              flex: 1,
              height: '6px',
              background: '#484038',
              border: '1px solid #282020',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: `${expPct}%`, height: '100%', background: '#4878f0' }} />
          </div>
        </div>
      )}
    </div>
  );
}
