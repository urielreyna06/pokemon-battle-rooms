import type { BattlePlayerState } from '@pokemon-battle/shared';

function PokeBallIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" fill="#e84028" stroke="#14101a" strokeWidth="3" />
      <path d="M2 32 Q2 62 32 62 Q62 62 62 32 Z" fill="#f0f0f0" />
      <rect x="2" y="30" width="60" height="4" fill="#14101a" />
      <circle cx="32" cy="32" r="9" fill="#f0f0f0" stroke="#14101a" strokeWidth="3" />
      <circle cx="32" cy="32" r="5" fill="#e84028" />
    </svg>
  );
}

function FaintedIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" fill="#3a3050" stroke="#14101a" strokeWidth="3" />
      <circle cx="32" cy="32" r="9" fill="#5b4a5e" stroke="#14101a" strokeWidth="3" />
      <line x1="21" y1="21" x2="27" y2="27" stroke="#e84028" strokeWidth="3" strokeLinecap="round" />
      <line x1="27" y1="21" x2="21" y2="27" stroke="#e84028" strokeWidth="3" strokeLinecap="round" />
      <line x1="37" y1="21" x2="43" y2="27" stroke="#e84028" strokeWidth="3" strokeLinecap="round" />
      <line x1="43" y1="21" x2="37" y2="27" stroke="#e84028" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 44 Q32 38 42 44" stroke="#e84028" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function ForfeitIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="10" width="6" height="44" rx="2" fill="#f8b830" stroke="#14101a" strokeWidth="2" />
      <rect x="18" y="12" width="26" height="22" rx="2" fill="#f8b830" stroke="#14101a" strokeWidth="2" />
      <path d="M18 12 L44 12 L44 34 L18 34 Z" fill="#f8efd1" stroke="#14101a" strokeWidth="2" />
      <line x1="26" y1="19" x2="36" y2="27" stroke="#e84028" strokeWidth="3" strokeLinecap="round" />
      <line x1="36" y1="19" x2="26" y2="27" stroke="#e84028" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SpectatorIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="32" rx="28" ry="16" stroke="#f8efd1" strokeWidth="3" fill="none" />
      <circle cx="32" cy="32" r="8" fill="#f8efd1" stroke="#14101a" strokeWidth="2" />
      <circle cx="32" cy="32" r="4" fill="#14101a" />
    </svg>
  );
}

type EndReason = 'ko' | 'forfeit' | undefined;

interface VictoryOverlayProps {
  won: boolean;
  isSpectator: boolean;
  winnerPlayerId?: string;
  players: BattlePlayerState[];
  endReason?: EndReason;
}

function getOverlayContent(won: boolean, isSpectator: boolean, endReason: EndReason, winnerIdx: number) {
  if (isSpectator) {
    return {
      icon: <SpectatorIcon size={64} />,
      heading: 'BATTLE OVER!',
      headingColor: '#f8efd1',
      sub: `Player ${winnerIdx > -1 ? winnerIdx + 1 : '?'} wins${endReason === 'forfeit' ? ' by forfeit' : ''}!`,
    };
  }

  if (won && endReason === 'forfeit') {
    return {
      icon: <ForfeitIcon size={64} />,
      heading: 'YOU WIN!',
      headingColor: '#f8b830',
      sub: 'Your opponent forfeited. Victory is yours!',
    };
  }

  if (won) {
    return {
      icon: <PokeBallIcon size={64} />,
      heading: 'YOU WIN!',
      headingColor: '#f8b830',
      sub: 'All opponent Pokémon have fainted!',
    };
  }

  if (endReason === 'forfeit') {
    return {
      icon: <ForfeitIcon size={64} />,
      heading: 'YOU LOSE!',
      headingColor: '#e84028',
      sub: 'You forfeited the battle.',
    };
  }

  return {
    icon: <FaintedIcon size={64} />,
    heading: 'YOU LOSE!',
    headingColor: '#e84028',
    sub: 'All your Pokémon have fainted...',
  };
}

export function VictoryOverlay({ won, isSpectator, winnerPlayerId, players, endReason }: VictoryOverlayProps) {
  const winnerIdx = players.findIndex(p => p.id === winnerPlayerId);
  const { icon, heading, headingColor, sub } = getOverlayContent(won, isSpectator, endReason, winnerIdx);

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
      <div style={{ lineHeight: 1 }}>{icon}</div>
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
