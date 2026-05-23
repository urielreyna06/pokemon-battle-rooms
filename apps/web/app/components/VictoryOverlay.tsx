import type { BattlePlayerState } from '@pokemon-battle/shared';

export function VictoryOverlay({ won, isSpectator, winnerPlayerId, players }: {
  won: boolean;
  isSpectator: boolean;
  winnerPlayerId?: string;
  players: BattlePlayerState[];
}) {
  const headingColor = isSpectator ? '#f8efd1' : won ? '#f8b830' : '#e84028';
  const emoji = isSpectator ? '👁' : won ? '🏆' : '😔';
  const heading = isSpectator ? 'BATTLE OVER!' : won ? 'YOU WIN!' : 'YOU LOSE!';
  const sub = isSpectator
    ? `Winner: Player ${(players.findIndex(p => p.id === winnerPlayerId) + 1) || '?'}`
    : won
    ? 'All opponent Pokémon have fainted!'
    : 'All your Pokémon have fainted...';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        gap: '20px',
        padding: '24px',
      }}
    >
      <div style={{ fontSize: '64px', lineHeight: 1 }}>{emoji}</div>
      <h2
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '18px',
          color: headingColor,
          textAlign: 'center',
          letterSpacing: '0.06em',
          textShadow: '3px 3px 0 #14101a',
          margin: 0,
        }}
      >
        {heading}
      </h2>
      <p style={{ fontFamily: "'VT323', monospace", fontSize: '22px', color: '#5b4a5e', textAlign: 'center', margin: 0 }}>
        {sub}
      </p>
      <a
        href="/"
        style={{
          display: 'inline-block',
          background: '#e84028',
          color: '#fff',
          border: '3px solid #14101a',
          borderRadius: '4px',
          padding: '12px 24px',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '9px',
          textDecoration: 'none',
          boxShadow: '0 4px 0 #14101a',
          textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
          letterSpacing: '0.06em',
          marginTop: '8px',
        }}
      >
        ▶ PLAY AGAIN
      </a>
    </div>
  );
}
