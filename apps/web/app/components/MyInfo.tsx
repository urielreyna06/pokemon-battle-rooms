import { HPBar } from './HPBar';
import { BallRow } from './BallRow';
import { TypeBadge } from './TypeBadge';
import { StatusBadge } from './StatusBadge';
import type { PokemonType, StatusType } from '../lib/types';
import type { BattlePokemon, BattlePlayerState } from '@pokemon-battle/shared';

export function MyInfo({ pokemon, player }: {
  pokemon: BattlePokemon;
  player: BattlePlayerState;
}) {
  return (
    <div
      style={{
        background: '#f0f0e0',
        border: '3px solid #282820',
        borderRadius: '4px',
        padding: '7px 10px 6px',
        minWidth: '170px',
        maxWidth: '195px',
        boxShadow: '-3px 3px 0 rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '7px',
            color: '#181818',
            letterSpacing: '0.03em',
            textTransform: 'capitalize',
          }}
        >
          {pokemon.name.replace(/-/g, ' ')}
        </span>
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '6px',
            color: '#484848',
            letterSpacing: '0.03em',
          }}
        >
          Lv50
        </span>
      </div>
      {(pokemon.types.length > 0 || pokemon.statusConditions.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '5px' }}>
          {pokemon.types.map((t) => (
            <TypeBadge key={t} type={t as PokemonType} size="xs" />
          ))}
          {pokemon.statusConditions.map((s) => (
            <StatusBadge key={s.type} status={s.type as StatusType} remainingTurns={s.remainingTurns} />
          ))}
        </div>
      )}
      <HPBar current={pokemon.currentHp} max={pokemon.maxHp} showNumeric width="100%" />
      <div style={{ marginTop: '5px' }}>
        <BallRow team={player.team} activePokemonId={player.activePokemonId} />
      </div>
    </div>
  );
}
