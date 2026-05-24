import React, { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useApi } from '../hooks/useApi';
import { PixelEmblem } from '../components/PixelEmblem';
import { Toast } from '../components/Toast';
import type { ToastState } from '../lib/types';
import type { RoomStateResponse } from '@pokemon-battle/shared';

export const Route = createFileRoute('/lobby/$code')({
  component: LobbyPage,
});

function LobbyPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const api = useApi();
  const stored = sessionStorage.getItem(`player_${code}`);
  const { playerId } = stored ? (JSON.parse(stored) as { playerId: string }) : { playerId: null };

  const [state, setState] = useState<RoomStateResponse | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [copied, setCopied] = useState(false);

  // Poll every 2 seconds — navigate to team select when 2 players are in
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function poll() {
      try {
        const data = await api.getRoomState(code);
        setState(data);
        if (data.room.players.length === 2) {
          clearInterval(timer);
          navigate({ to: '/team/$code', params: { code } });
        }
      } catch (err) {
        setToast({ msg: err instanceof Error ? err.message : 'Poll error', kind: 'warn' });
      }
    }

    poll();
    timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, [code, navigate]);

  function copyCode() {
    navigator.clipboard.writeText(code).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const room = state?.room;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #08060e 0%, #1a0f2e 50%, #08060e 100%)',
        padding: '24px 16px',
        gap: '28px',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <PixelEmblem size={40} color="#e84028" />
        <h2
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '11px',
            color: '#f8efd1',
            marginTop: '10px',
            letterSpacing: '0.06em',
            textShadow: '2px 2px 0 #14101a',
          }}
        >
          WAITING ROOM
        </h2>
        <p
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: '20px',
            color: '#5b4a5e',
            marginTop: '6px',
          }}
        >
          Share your code to invite an opponent
        </p>
      </div>

      {/* Main card */}
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#14101a',
          border: '4px solid #2a1f2e',
          borderRadius: '6px',
          padding: '24px',
          boxShadow: '0 8px 0 #000',
        }}
      >
        {/* Room code display */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '7px',
              color: '#5b4a5e',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            Room Code
          </p>
          <div
            data-testid="pb-room-code"
            onClick={copyCode}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '28px',
              color: '#e84028',
              letterSpacing: '0.3em',
              cursor: 'pointer',
              padding: '12px',
              background: '#1a0f1e',
              border: '3px solid #2a1f2e',
              borderRadius: '4px',
              display: 'inline-block',
              minWidth: '220px',
              textAlign: 'center',
              textShadow: '2px 2px 0 #14101a',
              userSelect: 'none',
              transition: 'background 0.1s',
            }}
            title="Click to copy"
          >
            {code}
          </div>
          <div style={{ marginTop: '10px' }}>
            <button
              onClick={copyCode}
              style={{
                background: copied ? '#5fc63a' : '#2a1f2e',
                color: '#f0e8d0',
                border: '2px solid #14101a',
                borderRadius: '4px',
                padding: '6px 14px',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '7px',
                cursor: 'pointer',
                letterSpacing: '0.06em',
                boxShadow: '0 2px 0 #14101a',
                transition: 'background 0.2s',
              }}
            >
              {copied ? '✔ COPIED!' : '📋 COPY'}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '2px solid #2a1f2e', margin: '16px 0' }} />

        {/* Players list */}
        <div>
          <p
            data-testid="pb-lobby-status"
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '7px',
              color: '#5b4a5e',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            Players ({room?.players.length ?? 0}/2)
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(room?.players ?? []).map((p, i) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: '#1a0f1e',
                  border: '2px solid #2a1f2e',
                  borderRadius: '4px',
                }}
              >
                <span
                  style={{
                    fontFamily: "'VT323', monospace",
                    fontSize: '22px',
                    color: '#f0e8d0',
                    letterSpacing: '0.04em',
                  }}
                >
                  {i === 0 ? '👑 ' : '⚔ '}
                  {p.name}
                  {p.id === playerId && (
                    <span style={{ color: '#5b4a5e', fontSize: '16px' }}> (you)</span>
                  )}
                </span>
                <span
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '7px',
                    color: '#5fc63a',
                    letterSpacing: '0.06em',
                  }}
                >
                  ✔ IN
                </span>
              </div>
            ))}

            {/* Waiting slot */}
            {(room?.players.length ?? 0) < 2 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  background: '#1a0f1e',
                  border: '2px dashed #2a1f2e',
                  borderRadius: '4px',
                }}
              >
                {/* Spinner */}
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid #2a1f2e',
                    borderTopColor: '#e84028',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: "'VT323', monospace",
                    fontSize: '20px',
                    color: '#5b4a5e',
                    letterSpacing: '0.04em',
                  }}
                >
                  Waiting for opponent...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hint */}
      <p
        style={{
          fontFamily: "'VT323', monospace",
          fontSize: '18px',
          color: '#2a1f2e',
          textAlign: 'center',
        }}
      >
        Both players will be redirected automatically
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
