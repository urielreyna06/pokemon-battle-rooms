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
        background: 'rgba(10, 8, 20, 0.90)',
        border: '3px solid #2a1f2e',
        borderRadius: '8px',
        padding: '10px 12px',
        boxShadow: '0 4px 0 #000',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: isForcedSwitch ? '#e84028' : '#f8efd1', letterSpacing: '0.06em' }}>
          {isForcedSwitch ? 'CHOOSE NEXT!' : 'SWITCH TO:'}
        </span>
        {!isForcedSwitch && (
          <button
            onClick={onCancel}
            style={{
              background: '#2a1f2e',
              color: '#f0e8d0',
              border: '2px solid #14101a',
              borderRadius: '8px',
              padding: '5px 10px',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 0 #14101a',
            }}
          >
            ✕ CANCEL
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {visibleTeam.map((p) => {
          const isActive = p.instanceId === player.activePokemonId;
          const isFainted = p.currentHp <= 0;
          const isDisabled = isActive || isFainted || !canAct;
          return (
            <div
              key={p.instanceId}
              onClick={() => !isDisabled && onSwitch(p.instanceId)}
              style={{
                background: isActive ? '#1a0f1e' : isFainted ? '#0a080e' : '#14101a',
                border: `3px solid ${isActive ? '#e84028' : isFainted ? '#1a0f1e' : '#2a1f2e'}`,
                borderRadius: '8px',
                padding: '8px',
                textAlign: 'center',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isFainted ? 0.4 : 1,
                boxShadow: isActive ? '0 0 10px rgba(232,64,40,0.3)' : '0 2px 0 #000',
              }}
            >
              <img
                src={p.spriteUrl}
                alt={p.name}
                style={{
                  width: '52px',
                  height: '52px',
                  imageRendering: 'pixelated',
                  display: 'block',
                  margin: '0 auto',
                  filter: isFainted ? 'grayscale(1)' : undefined,
                }}
              />
              <div style={{ fontFamily: "'VT323', monospace", fontSize: '14px', color: isFainted ? '#5b4a5e' : '#f0e8d0', textTransform: 'capitalize', marginTop: '4px' }}>
                {p.name.slice(0, 8)}
              </div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: '13px', color: '#5b4a5e' }}>
                {Math.max(0, p.currentHp)}/{p.maxHp}
              </div>
              {isActive && (
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '5px', color: '#e84028', marginTop: '2px' }}>
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
