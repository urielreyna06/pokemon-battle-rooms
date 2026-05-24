import React, { useEffect, useRef } from 'react';

interface BattleLogProps {
  entries: string[];
  maxVisible?: number;
}

function getEntryColor(entry: string): string {
  const lower = entry.toLowerCase();
  if (lower.includes('super effective') || lower.includes('súper efectivo')) return '#c86000';
  if (lower.includes('not very effective') || lower.includes('poco efectivo')) return '#0070b8';
  if (lower.includes('no effect') || lower.includes('sin efecto') || lower.includes('no afecta')) return '#808080';
  if (lower.includes('fainted') || lower.includes('se debilitó') || lower.includes('ko')) return '#c81010';
  if (lower.includes('critical') || lower.includes('crítico')) return '#900080';
  if (lower.includes('wins') || lower.includes('ganó') || lower.includes('victoria')) return '#006010';
  if (lower.includes('burned') || lower.includes('poisoned') || lower.includes('paralyzed')
      || lower.includes('quemado') || lower.includes('envenenado') || lower.includes('paralizado')) return '#701070';
  return '#181818';
}

export function BattleLog({ entries, maxVisible = 10 }: BattleLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const visible = entries.slice(-maxVisible);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div
      data-testid="pb-battle-log"
      data-entry-count={entries.length}
      ref={containerRef}
      style={{
        background: '#f8f8f0',
        border: '3px solid #282820',
        padding: '8px 10px',
        maxHeight: '110px',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: '#b0a890 #f8f8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}
    >
      {visible.length === 0 ? (
        <p
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: '18px',
            color: '#888878',
            margin: 0,
          }}
        >
          ▶ Waiting for battle to begin...
        </p>
      ) : (
        visible.map((entry, i) => (
          <p
            key={`${i}-${entry.slice(0, 20)}`}
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: '18px',
              color: getEntryColor(entry),
              margin: 0,
              lineHeight: 1.25,
              opacity: i === visible.length - 1 ? 1 : Math.max(0.4, 1 - (visible.length - 1 - i) * 0.15),
            }}
          >
            {i === visible.length - 1 ? '▶ ' : '  '}
            {entry}
          </p>
        ))
      )}
    </div>
  );
}
