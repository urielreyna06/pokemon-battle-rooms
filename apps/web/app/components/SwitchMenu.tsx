import type { BattlePlayerState } from '@pokemon-battle/shared';

export function SwitchMenu({
  player,
  canAct,
  isForcedSwitch = false,
  onSwitch,
  onCancel,
}: {
  player: BattlePlayerState;
  canAct: boolean;
  isForcedSwitch?: boolean;
  onSwitch: (instanceId: string) => void;
  onCancel: () => void;
}) {
  const visibleTeam = player.team.filter(p => p.instanceId !== player.activePokemonId && p.currentHp > 0);

  return (
    <div
      style={{
        background: '#f0f0e0',
        border: '3px solid #282820',
        borderRadius: '4px',
        padding: '10px 12px',
        boxShadow: '2px 2px 0 rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '8px',
          color: isForcedSwitch ? '#c01010' : '#181818',
          letterSpacing: '0.06em',
        }}>
          {isForcedSwitch ? 'CHOOSE NEXT!' : 'SWITCH TO:'}
        </span>
        {!isForcedSwitch && (
          <button
            onClick={onCancel}
            style={{
              background: '#e0e0d0',
              color: '#282820',
              border: '2px solid #282820',
              borderRadius: '3px',
              padding: '4px 8px',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '6px',
              cursor: 'pointer',
              boxShadow: '2px 2px 0 rgba(0,0,0,0.3)',
            }}
          >
            ✕ CANCEL
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
        {visibleTeam.map((p) => {
          const isActive = p.instanceId === player.activePokemonId;
          const isFainted = p.currentHp <= 0;
          const isDisabled = isActive || isFainted || !canAct;
          return (
            <div
              key={p.instanceId}
              onClick={() => !isDisabled && onSwitch(p.instanceId)}
              style={{
                background: isActive ? '#e0d8c8' : isFainted ? '#c8c0b0' : '#ffffff',
                border: `2px solid ${isActive ? '#c86000' : isFainted ? '#a09080' : '#282820'}`,
                borderRadius: '3px',
                padding: '6px',
                textAlign: 'center',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isFainted ? 0.5 : 1,
                boxShadow: isActive ? '0 0 0 1px #c86000' : '2px 2px 0 rgba(0,0,0,0.2)',
              }}
            >
              <img
                src={p.spriteUrl}
                alt={p.name}
                style={{
                  width: '48px',
                  height: '48px',
                  imageRendering: 'pixelated',
                  display: 'block',
                  margin: '0 auto',
                  filter: isFainted ? 'grayscale(1)' : undefined,
                }}
              />
              <div style={{ fontFamily: "'VT323', monospace", fontSize: '14px', color: isFainted ? '#888878' : '#181818', textTransform: 'capitalize', marginTop: '3px' }}>
                {p.name.slice(0, 8)}
              </div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: '13px', color: '#606050' }}>
                {Math.max(0, p.currentHp)}/{p.maxHp}
              </div>
              {isActive && (
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '5px', color: '#c86000', marginTop: '2px' }}>
                  OUT
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
