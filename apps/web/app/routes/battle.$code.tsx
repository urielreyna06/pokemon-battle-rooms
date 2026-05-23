import React, { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from '@clerk/react';
import { useApi } from '../hooks/useApi';
import { HPBar } from '../components/HPBar';
import { PokemonSprite } from '../components/PokemonSprite';
import { MoveButton } from '../components/MoveButton';
import { BattleLog } from '../components/BattleLog';
import { BallRow } from '../components/BallRow';
import { StatusBadge } from '../components/StatusBadge';
import { TypeBadge } from '../components/TypeBadge';
import { Toast } from '../components/Toast';
import type { ToastState, PokemonType, StatusType } from '../lib/types';
import type {
  BattleDoc,
  BattlePokemon,
  BattlePlayerState,
  Action,
} from '@pokemon-battle/shared';

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001';
const TURN_TIMEOUT_S = 60;

export const Route = createFileRoute('/battle/$code')({
  component: BattlePage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'menu' | 'fight' | 'switch' | 'busy' | 'finished';
type AnimTarget = 'me' | 'opp';
type AnimType = 'shake' | 'flash' | 'faint';
type AnimState = { target: AnimTarget; type: AnimType } | null;

// ─── Battle page ──────────────────────────────────────────────────────────────

function BattlePage() {
  const { code } = Route.useParams();
  const api = useApi();
  const stored = sessionStorage.getItem(`player_${code}`);
  const { playerId } = stored
    ? (JSON.parse(stored) as { playerId: string })
    : { playerId: '' };

  const { getToken, userId } = useAuth();
  const [battle, setBattle] = useState<BattleDoc | null>(null);
  const [phase, setPhase] = useState<Phase>('menu');
  const phaseRef = useRef<Phase>('menu'); // mirror of phase for use in closures
  const [anim, setAnim] = useState<AnimState>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [timeLeft, setTimeLeft] = useState(TURN_TIMEOUT_S);
  const [forcedSwitch, setForcedSwitch] = useState(false);
  const prevLogLen = useRef(0);
  const evtSource = useRef<EventSource | null>(null);
  const autoSubmitRef = useRef<() => void>(() => {});

  // Keep phaseRef in sync with phase state
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  function handleBattleUpdate(b: BattleDoc) {
    setBattle((prev) => {
      // Detect new log entries and trigger animations
      if (b.battleLog.length > prevLogLen.current) {
        const newEntries = b.battleLog.slice(prevLogLen.current);
        prevLogLen.current = b.battleLog.length;
        const myActive = getActive(b, playerId);
        const oppActive = getOppActive(b, playerId);
        for (const entry of newEntries) {
          const lower = entry.toLowerCase();
          if (myActive && lower.includes(myActive.name.toLowerCase()) && lower.includes('damage')) {
            triggerAnim('me', 'shake');
          } else if (oppActive && lower.includes(oppActive.name.toLowerCase()) && lower.includes('damage')) {
            triggerAnim('opp', 'flash');
          }
          if (myActive && (lower.includes(`${myActive.name.toLowerCase()} fainted`) || lower.includes(`${myActive.name.toLowerCase()} se debilitó`))) {
            triggerAnim('me', 'faint');
          }
        }
      }
      return b;
    });

    // Update phase based on battle status
    if (b.status === 'finished') {
      setPhase('finished');
      evtSource.current?.close();
    } else {
      if (b.turnStartedAt) {
        const elapsed = Math.floor((Date.now() - new Date(b.turnStartedAt).getTime()) / 1000);
        setTimeLeft(Math.max(0, TURN_TIMEOUT_S - elapsed));
      }
      const myState = b.players.find((p) => p.id === playerId);
      const hasActed = !!myState?.selectedAction;
      if (hasActed) {
        setPhase('busy');
      } else if (phaseRef.current === 'busy') {
        // New turn started, back to menu
        setForcedSwitch(false);
        setPhase('menu');
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (cancelled || !token) return;
      const url = `${API_BASE}/battle/${code}/events?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      evtSource.current = es;
      es.addEventListener('battle', (e: MessageEvent) => {
        const b: BattleDoc = JSON.parse(e.data);
        if (prevLogLen.current === 0) prevLogLen.current = b.battleLog.length;
        handleBattleUpdate(b);
      });
      es.onerror = () => { /* SSE auto-reconnects */ };
    })();
    return () => {
      cancelled = true;
      evtSource.current?.close();
      evtSource.current = null;
    };
  }, [code]);

  function triggerAnim(target: AnimTarget, type: AnimType) {
    setAnim({ target, type });
    setTimeout(() => setAnim(null), 700);
  }

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

  // ── Derived state ────────────────────────────────────────────────────────────
  const myState = battle?.players.find((p) => p.id === playerId);
  const oppState = battle?.players.find((p) => p.id !== playerId);
  const myActive = myState && getActive(battle!, playerId);
  const oppActive = oppState && getOppActive(battle!, playerId);
  const isSpectator = !!battle && !!userId && !battle.players.some(p => p.id === userId);
  const canAct = !isSpectator && phase === 'menu' && battle?.status === 'active';
  const iWon = !isSpectator && battle?.status === 'finished' && battle.winnerPlayerId === playerId;
  const spectatorP1 = isSpectator ? battle?.players[0] : undefined;
  const spectatorP2 = isSpectator ? battle?.players[1] : undefined;
  const spectatorP1Active = spectatorP1
    ? spectatorP1.team.find(p => p.instanceId === spectatorP1.activePokemonId) ?? null
    : null;
  const spectatorP2Active = spectatorP2
    ? spectatorP2.team.find(p => p.instanceId === spectatorP2.activePokemonId) ?? null
    : null;

  // ── Turn timer ───────────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (isSpectator || phase !== 'menu' || battle?.status !== 'active') return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(id); autoSubmitRef.current(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, battle?.status]);

  if (!battle) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08060e' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #2a1f2e', borderTopColor: '#e84028', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #1a3a1a 0%, #2d4a1e 20%, #1b2838 60%, #0a0a12 100%)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        maxWidth: '480px',
        margin: '0 auto',
        position: 'relative',
      }}
    >
      {/* ── Victory / Defeat overlay ──────────────────────────────────────────── */}
      {phase === 'finished' && (
        <VictoryOverlay
          won={iWon}
          isSpectator={isSpectator}
          winnerPlayerId={battle.winnerPlayerId}
          players={battle.players}
        />
      )}

      {/* ── Top: opponent info ───────────────────────────────────────────────── */}
      <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
        {oppState && oppActive && (
          <OpponentInfo
            pokemon={oppActive}
            player={oppState}
            anim={anim?.target === 'opp' ? anim.type : null}
          />
        )}
      </div>

      {/* ── Battle scene (sprites + platforms) ──────────────────────────────── */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          minHeight: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          overflow: 'hidden',
        }}
      >
        {/* Opponent sprite (top-right) */}
        <div style={{ position: 'absolute', top: '10px', right: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <PokemonSprite
            spriteUrl={oppActive?.spriteUrl ?? ''}
            name={oppActive?.name ?? ''}
            size="md"
            animating={anim?.target === 'opp' ? anim.type : null}
          />
          <div style={{
            width: '80px', height: '16px',
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.4) 0%, transparent 70%)',
            margin: '-8px auto 0',
          }} />
        </div>

        {/* My sprite (bottom-left) */}
        <div style={{ position: 'absolute', bottom: '10px', left: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <PokemonSprite
            spriteUrl={(isSpectator ? spectatorP2Active : myActive)?.spriteUrl ?? ''}
            name={(isSpectator ? spectatorP2Active : myActive)?.name ?? ''}
            size="lg"
            animating={anim?.target === 'me' ? anim.type : null}
            isBack
          />
          <div style={{
            width: '80px', height: '16px',
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.4) 0%, transparent 70%)',
            margin: '-8px auto 0',
          }} />
        </div>

        {/* Turn counter center */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '7px',
            color: '#f0e8d0',
            letterSpacing: '0.06em',
          }}
        >
          Turn {battle.turn}
          {phase === 'menu' && battle.status === 'active' && (
            <div style={{ color: timeLeft <= 10 ? '#e84028' : '#5b4a5e', marginTop: '2px' }}>
              {timeLeft}s
            </div>
          )}
        </div>
      </div>

      {/* ── My Pokémon info ───────────────────────────────────────────────────── */}
      <div style={{ padding: '0 16px', flexShrink: 0 }}>
        {isSpectator && spectatorP2 && spectatorP2Active ? (
          <MyInfo pokemon={spectatorP2Active} player={spectatorP2} />
        ) : myState && myActive ? (
          <MyInfo pokemon={myActive} player={myState} />
        ) : null}
      </div>

      {/* ── Battle log ───────────────────────────────────────────────────────── */}
      <div style={{ padding: '8px 16px', flexShrink: 0 }}>
        <BattleLog entries={battle.battleLog} maxVisible={6} />
      </div>

      {/* ── Action panel ─────────────────────────────────────────────────────── */}
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

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OpponentInfo({ pokemon, player, anim }: { pokemon: BattlePokemon; player: BattlePlayerState; anim: AnimType | null }) {
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
      {/* Name + types row */}
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
      {/* HP bar */}
      <HPBar current={pokemon.currentHp} max={pokemon.maxHp} width="100%" />
      {/* Ball row (opponent's team) */}
      <div style={{ marginTop: '6px' }}>
        <BallRow
          team={player.team}
          activePokemonId={player.activePokemonId}
          mirror
        />
      </div>
    </div>
  );
}

function MyInfo({ pokemon, player }: { pokemon: BattlePokemon; player: BattlePlayerState }) {
  return (
    <div
      style={{
        background: 'rgba(10, 8, 20, 0.95)',
        border: '3px solid #2a1f2e',
        borderTop: '2px solid #2a1f3a',
        borderRadius: '8px',
        padding: '10px 12px',
        boxShadow: '0 4px 0 #000',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
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
      <HPBar current={pokemon.currentHp} max={pokemon.maxHp} showNumeric width="100%" />
      <div style={{ marginTop: '6px' }}>
        <BallRow
          team={player.team}
          activePokemonId={player.activePokemonId}
        />
      </div>
    </div>
  );
}

function FightPanel({
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
        borderTop: '2px solid rgba(255,255,255,0.1)',
        paddingTop: '8px',
      }}
    >
      {/* Turn status banner */}
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
      {/* 2x2 move grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        {pokemon.moves.map((move) => (
          <MoveButton
            key={move.id}
            move={move}
            disabled={!canAct}
            onClick={() => onMove(move.id)}
          />
        ))}
      </div>
      {/* Switch button */}
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

function SwitchMenu({
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
  // Filter team: for forced switch show only alive non-active; for voluntary show all alive except active
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

function SpectatorPanel() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '16px',
        background: 'rgba(10, 8, 20, 0.90)',
        border: '3px solid #2a1f2e',
        borderRadius: '8px',
        boxShadow: '0 4px 0 #000',
      }}
    >
      <span style={{ fontSize: '18px' }}>👁</span>
      <span style={{ fontFamily: "'VT323', monospace", fontSize: '22px', color: '#5b4a5e', letterSpacing: '0.04em' }}>
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
        background: 'rgba(10, 8, 20, 0.90)',
        border: '3px solid #2a1f2e',
        borderRadius: '8px',
        boxShadow: '0 4px 0 #000',
      }}
    >
      <div
        style={{
          width: '16px',
          height: '16px',
          border: '3px solid #2a1f2e',
          borderTopColor: '#e84028',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          flexShrink: 0,
        }}
      />
      <span style={{ fontFamily: "'VT323', monospace", fontSize: '22px', color: '#5b4a5e', letterSpacing: '0.04em' }}>
        Waiting for opponent...
      </span>
    </div>
  );
}

function VictoryOverlay({ won, isSpectator, winnerPlayerId, players }: {
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
      <p
        style={{
          fontFamily: "'VT323', monospace",
          fontSize: '22px',
          color: '#5b4a5e',
          textAlign: 'center',
          margin: 0,
        }}
      >
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
