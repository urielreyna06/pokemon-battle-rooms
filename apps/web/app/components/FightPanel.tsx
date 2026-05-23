import { MoveButton } from './MoveButton';
import type { BattlePokemon } from '@pokemon-battle/shared';

export function FightPanel({
  pokemon,
  canAct,
  onMove,
  onSwitchMenu,
}: {
  pokemon: BattlePokemon;
  canAct: boolean;
  onMove: (id: string) => void;
  onSwitchMenu: () => void;
}) {
  return (
    <div style={{ borderTop: '2px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
      <div
        style={{
          marginBottom: '8px',
          padding: '5px 10px',
          borderRadius: '4px',
          background: canAct ? 'rgba(46,204,113,0.15)' : 'rgba(91,74,94,0.2)',
          border: `1px solid ${canAct ? 'rgba(46,204,113,0.5)' : 'rgba(91,74,94,0.3)'}`,
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '7px',
          color: canAct ? '#2ecc71' : '#5b4a5e',
          textAlign: 'center',
          letterSpacing: '0.06em',
        }}
      >
        {canAct ? '▶ YOUR TURN — choose an action' : '⏳ WAITING...'}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        {pokemon.moves.map((move) => (
          <MoveButton key={move.id} move={move} disabled={!canAct} onClick={() => onMove(move.id)} />
        ))}
      </div>
      <button
        onClick={onSwitchMenu}
        disabled={!canAct}
        style={{
          width: '100%',
          background: '#2a1f2e',
          color: '#f0e8d0',
          border: '3px solid #14101a',
          borderRadius: '8px',
          padding: '10px',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '8px',
          cursor: canAct ? 'pointer' : 'not-allowed',
          boxShadow: '0 3px 0 #14101a',
          opacity: canAct ? 1 : 0.5,
          letterSpacing: '0.06em',
        }}
      >
        ↔ SWITCH POKÉMON
      </button>
    </div>
  );
}
