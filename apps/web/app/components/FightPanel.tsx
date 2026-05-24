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
    <div
      style={{
        background: '#f0f0e0',
        border: '3px solid #282820',
        borderRadius: '4px',
        padding: '10px',
        boxShadow: '2px 2px 0 rgba(0,0,0,0.3)',
      }}
    >
      <div
        style={{
          marginBottom: '8px',
          padding: '4px 8px',
          background: canAct ? 'rgba(0,140,60,0.12)' : 'rgba(100,90,80,0.12)',
          border: `1px solid ${canAct ? 'rgba(0,140,60,0.35)' : 'rgba(100,90,80,0.25)'}`,
          borderRadius: '2px',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '6px',
          color: canAct ? '#006020' : '#706050',
          textAlign: 'center',
          letterSpacing: '0.06em',
        }}
      >
        {canAct ? '▶ YOUR TURN — choose a move' : '⏳ WAITING...'}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          marginBottom: '8px',
        }}
      >
        {pokemon.moves.map((move) => (
          <MoveButton
            key={move.id}
            move={move}
            disabled={!canAct || move.currentPp <= 0}
            onClick={() => onMove(move.id)}
          />
        ))}
      </div>
      <button
        data-testid="pb-switch-open"
        onClick={onSwitchMenu}
        disabled={!canAct}
        style={{
          width: '100%',
          background: '#e0e0d0',
          color: '#282820',
          border: '2px solid #282820',
          borderRadius: '3px',
          padding: '8px',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '7px',
          cursor: canAct ? 'pointer' : 'not-allowed',
          boxShadow: canAct ? '2px 2px 0 rgba(0,0,0,0.3)' : 'none',
          opacity: canAct ? 1 : 0.5,
          letterSpacing: '0.06em',
        }}
      >
        ↔ SWITCH
      </button>
    </div>
  );
}
