import React, { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
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

  const [battle, setBattle] = useState<BattleDoc | null>(null);
  const [phase, setPhase] = useState<Phase>('menu');
  const phaseRef = useRef<Phase>('menu'); // mirror of phase for use in closures
  const [anim, setAnim] = useState<AnimState>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const prevLogLen = useRef(0);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep phaseRef in sync with phase state
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Polling ─────────────────────────────────────────────────────────────────
  function startPolling(ms: number) {
    if (pollInterval.current) clearInterval(pollInterval.current);
    pollInterval.current = setInterval(async () => {
      try {
        const { battle: b } = await api.getBattle(code);
        handleBattleUpdate(b);
      } catch { /* ignore transient errors */ }
    }, ms);
  }

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
      if (pollInterval.current) clearInterval(pollInterval.current);
    } else {
      const myState = b.players.find((p) => p.id === playerId);
      const hasActed = !!myState?.selectedAction;
      if (hasActed) {
        setPhase('busy');
      } else if (phaseRef.current === 'busy') {
        // New turn started, back to menu
        setPhase('menu');
      }
    }
  }

  useEffect(() => {
    // Initial fetch
    api.getBattle(code).then(({ battle: b }) => {
      prevLogLen.current = b.battleLog.length;
      setBattle(b);
      if (b.status === 'finished') {
        setPhase('finished');
      }
    }).catch(() => {});

    startPolling(1500);
    return () => { if (pollInterval.current) clearInterval(pollInterval.current); };
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
      // Speed up polling for one cycle
      startPolling(500);
      setTimeout(() => startPolling(1500), 2000);
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
  const canAct = phase === 'menu' && battle?.status === 'active';
  const iWon = battle?.status === 'finished' && battle.winnerPlayerId === playerId;

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
        background: 'linear-gradient(180deg, #1a0838 0%, #08060e 40%, #08060e 100%)',
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
        <VictoryOverlay won={iWon} winnerName={battle.winnerPlayerId === myState?.id ? myState?.id : oppState?.id} />
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
        </div>

        {/* My sprite (bottom-left) */}
        <div style={{ position: 'absolute', bottom: '10px', left: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <PokemonSprite
            spriteUrl={myActive?.spriteUrl ?? ''}
            name={myActive?.name ?? ''}
            size="lg"
            animating={anim?.target === 'me' ? anim.type : null}
            isBack
          />
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
            color: '#2a1f2e',
            letterSpacing: '0.06em',
          }}
        >
          Turn {battle.turn}
        </div>
      </div>

      {/* ── My Pokémon info ───────────────────────────────────────────────────── */}
      <div style={{ padding: '0 16px', flexShrink: 0 }}>
        {myState && myActive && (
          <MyInfo pokemon={myActive} player={myState} />
        )}
      </div>

      {/* ── Battle log ───────────────────────────────────────────────────────── */}
      <div style={{ padding: '8px 16px', flexShrink: 0 }}>
        <BattleLog entries={battle.battleLog} maxVisible={6} />
      </div>

      {/* ── Action panel ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '8px 16px 16px', flexShrink: 0 }}>
        {phase === 'finished' ? null : phase === 'switch' ? (
          <SwitchMenu
            player={myState!}
            canAct={canAct}
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
        background: '#14101a',
        border: '3px solid #2a1f2e',
        borderRadius: '4px',
        padding: '10px 12px',
        boxShadow: '0 4px 0 #000',
      }}
    >
      {/* Name + types row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: "'Silkscreen', monospace",
            fontSize: '13px',
            color: '#f8efd1',
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
        background: '#14101a',
        border: '3px solid #2a1f2e',
        borderRadius: '4px',
        padding: '10px 12px',
        boxShadow: '0 4px 0 #000',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: "'Silkscreen', monospace",
            fontSize: '13px',
            color: '#f8efd1',
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
    <div>
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
          borderRadius: '4px',
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
  onSwitch,
  onCancel,
}: {
  player: BattlePlayerState;
  canAct: boolean;
  onSwitch: (instanceId: string) => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: '#f8efd1', letterSpacing: '0.06em' }}>
          SWITCH TO:
        </span>
        <button
          onClick={onCancel}
          style={{
            background: '#2a1f2e',
            color: '#f0e8d0',
            border: '2px solid #14101a',
            borderRadius: '4px',
            padding: '5px 10px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '6px',
            cursor: 'pointer',
            boxShadow: '0 2px 0 #14101a',
          }}
        >
          ✕ CANCEL
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {player.team.map((p) => {
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
                borderRadius: '4px',
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

function WaitingPanel() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '16px',
        background: '#14101a',
        border: '3px solid #2a1f2e',
        borderRadius: '4px',
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

function VictoryOverlay({ won, winnerName }: { won: boolean; winnerName?: string }) {
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
      <div style={{ fontSize: '64px', lineHeight: 1 }}>{won ? '🏆' : '😔'}</div>
      <h2
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '18px',
          color: won ? '#f8b830' : '#e84028',
          textAlign: 'center',
          letterSpacing: '0.06em',
          textShadow: '3px 3px 0 #14101a',
          margin: 0,
        }}
      >
        {won ? 'YOU WIN!' : 'YOU LOSE!'}
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
        {won
          ? 'All opponent Pokémon have fainted!'
          : 'All your Pokémon have fainted...'}
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
