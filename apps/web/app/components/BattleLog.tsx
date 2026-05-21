import React, { useEffect, useRef } from 'react';

interface BattleLogProps {
  entries: string[];
  maxVisible?: number;
}

/** Color-codes log entries based on content keywords */
function getEntryColor(entry: string): string {
  const lower = entry.toLowerCase();
  if (lower.includes('super effective') || lower.includes('súper efectivo')) return '#f8b830';
  if (lower.includes('not very effective') || lower.includes('poco efectivo')) return '#96D9D6';
  if (lower.includes('no effect') || lower.includes('sin efecto') || lower.includes('no afecta')) return '#888';
  if (lower.includes('fainted') || lower.includes('se debilitó') || lower.includes('ko')) return '#e02828';
  if (lower.includes('critical') || lower.includes('crítico')) return '#F95587';
  if (lower.includes('wins') || lower.includes('ganó') || lower.includes('victoria')) return '#5fc63a';
  if (lower.includes('burned') || lower.includes('poisoned') || lower.includes('paralyzed')
      || lower.includes('quemado') || lower.includes('envenenado') || lower.includes('paralizado')) return '#A33EA1';
  return '#f0e8d0';
}

export function BattleLog({ entries, maxVisible = 10 }: BattleLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const visible = entries.slice(-maxVisible);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div
      ref={containerRef}
      style={{
        background: '#14101a',
        border: '3px solid #2a1f2e',
        borderRadius: '4px',
        padding: '8px 10px',
        maxHeight: '120px',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: '#2a1f2e #14101a',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
      }}
    >
      {visible.length === 0 ? (
        <p
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: '18px',
            color: '#5b4a5e',
            margin: 0,
            letterSpacing: '0.03em',
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
              letterSpacing: '0.03em',
              lineHeight: 1.2,
              // Newest entry is brightest
              opacity: i === visible.length - 1 ? 1 : 0.7 - (visible.length - 1 - i) * 0.06,
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
