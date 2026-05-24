import { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from '@clerk/react';
import { useApi } from '../hooks/useApi';
import { useBattleSSE } from '../hooks/useBattleSSE';
import { useTurnTimer } from '../hooks/useTurnTimer';
import { PokemonSprite } from '../components/PokemonSprite';
import { BattleLog } from '../components/BattleLog';
import { Toast } from '../components/Toast';
import { OpponentInfo } from '../components/OpponentInfo';
import { MyInfo } from '../components/MyInfo';
import { FightPanel } from '../components/FightPanel';
import { SwitchMenu } from '../components/SwitchMenu';
import { VictoryOverlay } from '../components/VictoryOverlay';
import { ForfeitModal } from '../components/ForfeitModal';
import type { ToastState } from '../lib/types';
import type { BattleDoc, BattlePokemon, Action } from '@pokemon-battle/shared';

export const Route = createFileRoute('/battle/$code')({ component: BattlePage });

type Phase = 'menu' | 'fight' | 'switch' | 'busy' | 'finished';
type AnimTarget = 'me' | 'opp';
type AnimType = 'shake' | 'flash' | 'faint';
type AnimState = { target: AnimTarget; type: AnimType } | null;

function BattlePage() {
  const { code } = Route.useParams();
  const api = useApi();
  const stored = sessionStorage.getItem(`player_${code}`);
  const { playerId } = stored ? (JSON.parse(stored) as { playerId: string }) : { playerId: '' };
  const { getToken, userId } = useAuth();

  const [battle, setBattle] = useState<BattleDoc | null>(null);
  const [phase, setPhase] = useState<Phase>('menu');
  const phaseRef = useRef<Phase>('menu');
  const [anim, setAnim] = useState<AnimState>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [forcedSwitch, setForcedSwitch] = useState(false);
  const [showForfeit, setShowForfeit] = useState(false);
  const prevLogLen = useRef(0);
  const closeSSERef = useRef<() => void>(() => {});
  const syncTimerRef = useRef<(t: string) => void>(() => {});
  const autoSubmitRef = useRef<() => void>(() => {});

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  function triggerAnim(target: AnimTarget, type: AnimType) {
    setAnim({ target, type });
    setTimeout(() => setAnim(null), 700);
  }

  function handleBattleUpdate(b: BattleDoc) {
    // Initialize prevLogLen on first message so existing entries don't trigger animations
    if (prevLogLen.current === 0) {
      prevLogLen.current = b.battleLog.length;
    } else if (b.battleLog.length > prevLogLen.current) {
      const newEntries = b.battleLog.slice(prevLogLen.current);
      prevLogLen.current = b.battleLog.length;
      const myAct = getActive(b, playerId);
      const oppAct = getOppActive(b, playerId);
      for (const entry of newEntries) {
        const lower = entry.toLowerCase();
        if (myAct && lower.includes(myAct.name.toLowerCase()) && lower.includes('damage')) {
          triggerAnim('me', 'shake');
        } else if (oppAct && lower.includes(oppAct.name.toLowerCase()) && lower.includes('damage')) {
          triggerAnim('opp', 'flash');
        }
        if (myAct && (lower.includes(`${myAct.name.toLowerCase()} fainted`) || lower.includes(`${myAct.name.toLowerCase()} se debilitó`))) {
          triggerAnim('me', 'faint');
        }
      }
    }

    setBattle(b);

    if (b.status === 'finished') {
      setPhase('finished');
      closeSSERef.current();
    } else {
      if (b.turnStartedAt) syncTimerRef.current(b.turnStartedAt);
      const myState = b.players.find((p) => p.id === playerId);
      const hasActed = !!myState?.selectedAction;
      if (hasActed) {
        setPhase('busy');
      } else if (phaseRef.current === 'busy') {
        setForcedSwitch(false);
        setPhase('menu');
      }
    }
  }

  const { closeSSE } = useBattleSSE(code, getToken, handleBattleUpdate);
  useEffect(() => { closeSSERef.current = closeSSE; });

  // ── Derived state ────────────────────────────────────────────────────────────
  const myState = battle?.players.find((p) => p.id === playerId);
  const oppState = battle?.players.find((p) => p.id !== playerId);
  const myActive = myState && getActive(battle!, playerId);
  const oppActive = oppState && getOppActive(battle!, playerId);
  const isSpectator = !!battle && !!userId && !battle.players.some(p => p.id === userId);
  const canAct = !isSpectator && phase === 'menu' && battle?.status === 'active';
  const iWon = !isSpectator && battle?.status === 'finished' && battle.winnerPlayerId === playerId;
  const spectatorP2 = isSpectator ? battle?.players[1] : undefined;
  const spectatorP2Active = spectatorP2
    ? spectatorP2.team.find(p => p.instanceId === spectatorP2.activePokemonId) ?? null
    : null;

  // ── Turn timer ───────────────────────────────────────────────────────────────
  const { timeLeft, syncTimer } = useTurnTimer({
    enabled: !isSpectator && phase === 'menu' && battle?.status === 'active',
    onTimeout: () => autoSubmitRef.current(),
  });
  useEffect(() => { syncTimerRef.current = syncTimer; });

  useEffect(() => {
    autoSubmitRef.current = () => {
      if (!isSpectator && phaseRef.current === 'menu' && battle?.status === 'active' && myActive) {
        const fallback = myActive.moves[0];
        if (fallback) sendAction({ type: 'move', moveId: fallback.id });
      }
    };
  });

  // Detect when active Pokémon faints and force a switch
  useEffect(() => {
    if (myActive && myActive.currentHp <= 0 && battle?.status === 'active' && phase === 'menu') {
      const hasAlive = myState?.team.some(
        (p) => p.instanceId !== myState.activePokemonId && p.currentHp > 0
      );
      if (hasAlive) { setForcedSwitch(true); setPhase('switch'); }
    }
  }, [myActive?.currentHp, battle?.status, phase]);

  async function sendAction(action: Action) {
    setPhase('busy');
    try {
      const { battle: updated } = await api.submitAction(code, playerId, action);
      handleBattleUpdate(updated);
      if (action.type === 'move') triggerAnim('me', 'flash');
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'Action failed', kind: 'error' });
      setPhase('menu');
    }
  }

  async function handleForfeit() {
    setShowForfeit(false);
    try {
      const { battle: updated } = await api.forfeit(code, playerId);
      handleBattleUpdate(updated);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'Forfeit failed', kind: 'error' });
    }
  }

  if (!battle) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8e8d8' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #b0a890', borderTopColor: '#282820', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#e8e8d8',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        maxWidth: '480px',
        margin: '0 auto',
        position: 'relative',
      }}
    >
      {showForfeit && <ForfeitModal onConfirm={handleForfeit} onCancel={() => setShowForfeit(false)} />}

      {phase === 'finished' && (
        <VictoryOverlay won={iWon} isSpectator={isSpectator} winnerPlayerId={battle.winnerPlayerId} players={battle.players} endReason={battle.endReason} />
      )}

      {/* Battle scene: sky-to-grass field with overlaid info panels */}
      <div
        style={{
          position: 'relative',
          height: '260px',
          background: 'linear-gradient(180deg, #5ab8e8 0%, #8ed0f8 40%, #68b840 43%, #4a9030 100%)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* OpponentInfo — top-left overlay */}
        <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 2 }}>
          {oppState && oppActive && <OpponentInfo pokemon={oppActive} player={oppState} />}
        </div>

        {/* Opponent sprite — top-right */}
        <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
          <PokemonSprite spriteUrl={oppActive?.spriteUrl ?? ''} name={oppActive?.name ?? ''} size="md" animating={anim?.target === 'opp' ? anim.type : null} />
          <div style={{ width: '70px', height: '18px', background: 'radial-gradient(ellipse, rgba(0,60,0,0.5) 0%, transparent 70%)', marginTop: '-8px' }} />
        </div>

        {/* My sprite — bottom-left */}
        <div style={{ position: 'absolute', bottom: '10px', left: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
          <PokemonSprite
            spriteUrl={(isSpectator ? spectatorP2Active : myActive)?.spriteUrl ?? ''}
            name={(isSpectator ? spectatorP2Active : myActive)?.name ?? ''}
            size="lg"
            animating={anim?.target === 'me' ? anim.type : null}
            isBack
          />
          <div style={{ width: '90px', height: '22px', background: 'radial-gradient(ellipse, rgba(0,60,0,0.5) 0%, transparent 70%)', marginTop: '-10px' }} />
        </div>

        {/* MyInfo — bottom-right overlay */}
        <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 2 }}>
          {isSpectator && spectatorP2 && spectatorP2Active ? (
            <MyInfo pokemon={spectatorP2Active} player={spectatorP2} />
          ) : myState && myActive ? (
            <MyInfo pokemon={myActive} player={myState} />
          ) : null}
        </div>

        {/* Turn counter — top-center badge */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '7px',
            color: '#ffffff',
            background: 'rgba(0,0,0,0.28)',
            padding: '4px 8px',
            borderRadius: '3px',
            zIndex: 3,
            textShadow: '1px 1px 0 rgba(0,0,0,0.7)',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}
        >
          Turn {battle.turn}
          {phase === 'menu' && battle.status === 'active' && (
            <div style={{ color: timeLeft <= 10 ? '#ff6644' : 'rgba(255,255,255,0.85)', marginTop: '2px' }}>
              {timeLeft}s
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '8px 16px', flexShrink: 0 }}>
        <BattleLog entries={battle.battleLog} maxVisible={6} />
      </div>

      <div style={{ padding: '8px 16px 16px', flexShrink: 0 }}>
        {isSpectator ? (
          <SpectatorPanel />
        ) : phase === 'finished' ? null : phase === 'switch' ? (
          <SwitchMenu
            player={myState!}
            canAct={canAct}
            isForcedSwitch={forcedSwitch}
            onSwitch={(instanceId) => sendAction({ type: 'switch', targetInstanceId: instanceId })}
            onCancel={() => setPhase('menu')}
          />
        ) : phase === 'busy' ? (
          <WaitingPanel />
        ) : myActive ? (
          <FightPanel
            pokemon={myActive}
            canAct={canAct}
            onMove={(moveId) => sendAction({ type: 'move', moveId })}
            onSwitchMenu={() => setPhase('switch')}
          />
        ) : null}
      </div>

      {!isSpectator && battle.status === 'active' && phase !== 'finished' && (
        <div style={{ padding: '0 16px 12px', flexShrink: 0, textAlign: 'center', position: 'sticky', bottom: 0, background: '#e8e8d8' }}>
          <button
            onClick={() => setShowForfeit(true)}
            style={{
              background: 'transparent',
              color: '#484838',
              border: '1px solid #6a6858',
              borderRadius: '4px',
              padding: '5px 16px',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '6px',
              cursor: 'pointer',
              letterSpacing: '0.06em',
              transition: 'color 0.2s, border-color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#c01010';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#c01010';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#484838';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#6a6858';
            }}
          >
            ✕ FORFEIT
          </button>
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SpectatorPanel() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '16px',
        background: '#f0f0e0',
        border: '3px solid #282820',
        borderRadius: '4px',
        boxShadow: '2px 2px 0 rgba(0,0,0,0.3)',
      }}
    >
      <span style={{ fontSize: '18px' }}>👁</span>
      <span style={{ fontFamily: "'VT323', monospace", fontSize: '22px', color: '#484838', letterSpacing: '0.04em' }}>
        Spectating — read only
      </span>
    </div>
  );
}

function WaitingPanel() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '16px',
        background: '#f0f0e0',
        border: '3px solid #282820',
        borderRadius: '4px',
        boxShadow: '2px 2px 0 rgba(0,0,0,0.3)',
      }}
    >
      <div
        style={{
          width: '16px',
          height: '16px',
          border: '3px solid #b0a890',
          borderTopColor: '#282820',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          flexShrink: 0,
        }}
      />
      <span style={{ fontFamily: "'VT323', monospace", fontSize: '22px', color: '#484838', letterSpacing: '0.04em' }}>
        Waiting for opponent...
      </span>
    </div>
  );
}

function getActive(battle: BattleDoc, playerId: string): BattlePokemon | null {
  const me = battle.players.find((p) => p.id === playerId);
  if (!me) return null;
  return me.team.find((p) => p.instanceId === me.activePokemonId) ?? null;
}

function getOppActive(battle: BattleDoc, playerId: string): BattlePokemon | null {
  const opp = battle.players.find((p) => p.id !== playerId);
  if (!opp) return null;
  return opp.team.find((p) => p.instanceId === opp.activePokemonId) ?? null;
}
