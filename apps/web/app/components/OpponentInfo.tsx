import { HPBar } from './HPBar';
import { BallRow } from './BallRow';
import { TypeBadge } from './TypeBadge';
import { StatusBadge } from './StatusBadge';
import type { PokemonType, StatusType } from '../lib/types';
import type { BattlePokemon, BattlePlayerState } from '@pokemon-battle/shared';

export function OpponentInfo({ pokemon, player }: {
  pokemon: BattlePokemon;
  player: BattlePlayerState;
}) {
  return (
    <div
      style={{
        background: 'rgba(10, 8, 20, 0.90)',
        border: '3px solid #2a1f2e',
        borderBottom: '2px solid #3a2e4a',
        borderRadius: '8px',
        padding: '10px 12px',
        boxShadow: '0 4px 0 #000',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: "'Silkscreen', monospace",
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#f0e8d0',
            textTransform: 'capitalize',
            letterSpacing: '0.04em',
          }}
        >
          {pokemon.name.replace(/-/g, ' ')}
        </span>
        {pokemon.types.map((t) => (
          <TypeBadge key={t} type={t as PokemonType} size="xs" />
        ))}
        {pokemon.statusConditions.map((s) => (
          <StatusBadge key={s.type} status={s.type as StatusType} remainingTurns={s.remainingTurns} />
        ))}
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '7px',
            color: '#5b4a5e',
          }}
        >
          Lv{50}
        </span>
      </div>
      <HPBar current={pokemon.currentHp} max={pokemon.maxHp} width="100%" />
      <div style={{ marginTop: '6px' }}>
        <BallRow team={player.team} activePokemonId={player.activePokemonId} mirror />
      </div>
    </div>
  );
}
