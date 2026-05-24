import React, { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useApi } from '../hooks/useApi';
import { PixelEmblem } from '../components/PixelEmblem';
import { Toast } from '../components/Toast';
import type { ToastState } from '../lib/types';

export const Route = createFileRoute('/')({
  component: HomePage,
});

const INPUT_STYLE: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: '#0d0b16',
  border: '3px solid #2a1f2e',
  borderRadius: '4px',
  padding: '10px 12px',
  color: '#f0e8d0',
  fontFamily: "'Press Start 2P', monospace",
  fontSize: '9px',
  letterSpacing: '0.05em',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const BTN_PRIMARY: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: '#e84028',
  color: '#fff',
  border: '3px solid #14101a',
  borderRadius: '4px',
  padding: '12px',
  fontFamily: "'Press Start 2P', monospace",
  fontSize: '9px',
  letterSpacing: '0.08em',
  cursor: 'pointer',
  boxShadow: '0 4px 0 #14101a, inset 0 1px 0 rgba(255,255,255,0.3)',
  textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
  transition: 'transform 0.08s, box-shadow 0.08s',
  textAlign: 'center',
};

const BTN_SECONDARY: React.CSSProperties = {
  ...BTN_PRIMARY,
  background: '#2a1f2e',
  color: '#f0e8d0',
  width: 'auto',
  padding: '12px 16px',
  boxShadow: '0 4px 0 #14101a',
  textShadow: 'none',
};

const HOW_STEPS = [
  {
    num: '01',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect x="3" y="6" width="22" height="16" rx="2" fill="#2a1f2e" stroke="#5b4a5e" strokeWidth="1.5" />
        <line x1="3" y1="11" x2="25" y2="11" stroke="#5b4a5e" strokeWidth="1.5" />
        <rect x="7" y="14" width="6" height="5" rx="1" fill="#e84028" opacity="0.8" />
        <rect x="15" y="14" width="6" height="5" rx="1" fill="#2e7cd4" opacity="0.8" />
      </svg>
    ),
    title: 'Create a Room',
    desc: 'Generate a 6-character code and share it with your opponent.',
  },
  {
    num: '02',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <circle cx="14" cy="14" r="9" fill="#2a1f2e" stroke="#5b4a5e" strokeWidth="1.5" />
        <path d="M5 14 Q14 5 23 14" fill="#e84028" opacity="0.7" />
        <circle cx="14" cy="14" r="3" fill="#f0e8d0" stroke="#14101a" strokeWidth="1.5" />
        <line x1="14" y1="11" x2="14" y2="17" stroke="#14101a" strokeWidth="1.5" />
      </svg>
    ),
    title: 'Pick Your Team',
    desc: 'Choose up to 6 Pokémon from the full Pokédex. Stats are 100% authentic.',
  },
  {
    num: '03',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M6 22 L14 6 L22 22 Z" fill="#2a1f2e" stroke="#5b4a5e" strokeWidth="1.5" />
        <circle cx="14" cy="15" r="3" fill="#e84028" opacity="0.85" />
        <line x1="8" y1="19" x2="20" y2="19" stroke="#5b4a5e" strokeWidth="1" opacity="0.5" />
      </svg>
    ),
    title: 'Battle!',
    desc: 'Real damage formulas, type matchups, PP, and turn order. First to KO all 6 wins.',
  },
];

function HomePage() {
  const navigate = useNavigate();
  const api = useApi();
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState<'create' | 'join' | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  function showError(msg: string) {
    setToast({ msg, kind: 'error' });
  }

  async function handleCreate() {
    if (!playerName.trim()) { showError('Enter your name first!'); return; }
    setLoading('create');
    try {
      const { code } = await api.createRoom();
      const { playerId } = await api.joinRoom(code, playerName.trim());
      sessionStorage.setItem(`player_${code}`, JSON.stringify({ playerId, playerName: playerName.trim() }));
      navigate({ to: '/lobby/$code', params: { code } });
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  async function handleJoin() {
    if (!playerName.trim() || !joinCode.trim()) {
      showError('Enter your name and room code!');
      return;
    }
    setLoading('join');
    try {
      const code = joinCode.trim().toUpperCase();
      const { playerId } = await api.joinRoom(code, playerName.trim());
      sessionStorage.setItem(`player_${code}`, JSON.stringify({ playerId, playerName: playerName.trim() }));
      navigate({ to: '/lobby/$code', params: { code } });
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#07050d', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes scan {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.15; }
          50%       { opacity: 0.30; }
        }
        .landing-input:focus { border-color: #e84028 !important; }
      `}</style>

      {/* ── Arena hero ─────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          flex: '0 0 auto',
          background: 'radial-gradient(ellipse 90% 70% at 50% 0%, #1d2b1a 0%, #111828 35%, #07050d 100%)',
          paddingBottom: '48px',
        }}
      >
        {/* Scanline overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Arena floor glow */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            height: '80px',
            background: 'radial-gradient(ellipse, rgba(232,64,40,0.18) 0%, transparent 70%)',
            animation: 'pulse-glow 3s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '48px 24px 0',
            textAlign: 'center',
            gap: '0',
          }}
        >
          {/* Emblem */}
          <div style={{ marginBottom: '16px', filter: 'drop-shadow(0 0 12px rgba(232,64,40,0.5))' }}>
            <PixelEmblem size={52} color="#e84028" />
          </div>

          {/* Title */}
          <h1
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 'clamp(12px, 3vw, 18px)',
              color: '#f8efd1',
              letterSpacing: '0.06em',
              lineHeight: 1.6,
              margin: 0,
              textShadow: '2px 2px 0 #14101a, 0 0 20px rgba(248,239,209,0.1)',
            }}
          >
            POKÉMON
            <br />
            <span style={{ color: '#e84028', textShadow: '2px 2px 0 #14101a, 0 0 16px rgba(232,64,40,0.4)' }}>
              BATTLE ROOMS
            </span>
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: '22px',
              color: '#7a6880',
              marginTop: '12px',
              letterSpacing: '0.06em',
            }}
          >
            1v1 online battles — real moves, real damage, real data
          </p>

          {/* VS badge */}
          <div
            style={{
              marginTop: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ width: '60px', height: '2px', background: 'linear-gradient(90deg, transparent, #e84028)' }} />
            <span
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '14px',
                color: '#e84028',
                textShadow: '0 0 10px rgba(232,64,40,0.6)',
                letterSpacing: '0.1em',
              }}
            >
              VS
            </span>
            <div style={{ width: '60px', height: '2px', background: 'linear-gradient(90deg, #2e7cd4, transparent)' }} />
          </div>
        </div>
      </div>

      {/* ── Battle card ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '0 16px 32px',
          marginTop: '-24px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '400px',
            background: '#100d1a',
            border: '3px solid #2a1f2e',
            borderRadius: '6px',
            padding: '24px',
            boxShadow: '0 8px 0 #000, 0 16px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(232,64,40,0.1)',
          }}
        >
          <label
            style={{
              display: 'block',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '7px',
              color: '#5b4a5e',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            Your Name
          </label>
          <input
            className="landing-input"
            data-testid="pb-player-name"
            style={INPUT_STYLE}
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            maxLength={16}
          />

          <div style={{ margin: '20px 0', borderTop: '2px solid #1e1828' }} />

          <button
            data-testid="pb-create-room"
            style={{ ...BTN_PRIMARY, opacity: loading ? 0.7 : 1 }}
            onClick={handleCreate}
            disabled={!!loading}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(3px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 0 #14101a, inset 0 1px 0 rgba(255,255,255,0.3)';
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = '';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = BTN_PRIMARY.boxShadow as string;
            }}
          >
            {loading === 'create' ? '▶ CREATING...' : '▶ CREATE ROOM'}
          </button>

          <p
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: '18px',
              color: '#3d2e44',
              textAlign: 'center',
              margin: '12px 0',
              letterSpacing: '0.1em',
            }}
          >
            — or join existing room —
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              className="landing-input"
              data-testid="pb-join-code"
              style={{
                ...INPUT_STYLE,
                flex: 1,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                textAlign: 'center',
              }}
              placeholder="ROOM CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={6}
            />
            <button
              data-testid="pb-join-room"
              style={{ ...BTN_SECONDARY, opacity: loading ? 0.7 : 1 }}
              onClick={handleJoin}
              disabled={!!loading}
            >
              {loading === 'join' ? '...' : 'JOIN'}
            </button>
          </div>
        </div>
      </div>

      {/* ── How It Works ────────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: '2px solid #1a1428',
          borderBottom: '2px solid #1a1428',
          background: '#0b0916',
          padding: '32px 16px',
        }}
      >
        <h2
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '8px',
            color: '#3d2e44',
            letterSpacing: '0.12em',
            textAlign: 'center',
            textTransform: 'uppercase',
            marginBottom: '24px',
          }}
        >
          How It Works
        </h2>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '16px',
            maxWidth: '760px',
            margin: '0 auto',
          }}
        >
          {HOW_STEPS.map((step) => (
            <div
              key={step.num}
              style={{
                flex: '1 1 200px',
                maxWidth: '220px',
                background: '#100d1a',
                border: '2px solid #1e1828',
                borderRadius: '6px',
                padding: '20px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '7px',
                  color: '#e84028',
                  letterSpacing: '0.1em',
                  opacity: 0.6,
                }}
              >
                {step.num}
              </div>
              {step.icon}
              <div
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '7px',
                  color: '#c8b8d8',
                  letterSpacing: '0.06em',
                  lineHeight: 1.6,
                }}
              >
                {step.title}
              </div>
              <div
                style={{
                  fontFamily: "'VT323', monospace",
                  fontSize: '16px',
                  color: '#5b4a5e',
                  lineHeight: 1.4,
                  letterSpacing: '0.02em',
                }}
              >
                {step.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature pills ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '10px',
          padding: '20px 16px',
          background: '#07050d',
        }}
      >
        {[
          '⚔ Real damage formula',
          '✦ Type matchups',
          '● PP tracking',
          '↔ Switch anytime',
          '⏱ 45s turn timer',
          '★ Shiny Pokémon',
        ].map((feat) => (
          <span
            key={feat}
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: '16px',
              color: '#4a3850',
              border: '1px solid #1e1828',
              borderRadius: '4px',
              padding: '4px 10px',
              letterSpacing: '0.04em',
            }}
          >
            {feat}
          </span>
        ))}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: 'auto',
          borderTop: '2px solid #12101a',
          padding: '16px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '6px',
            color: '#2a1f2e',
            letterSpacing: '0.08em',
          }}
        >
          v1.0 · UTP FISC 2025
        </span>
        <span style={{ color: '#2a1f2e', fontSize: '6px' }}>·</span>
        <span
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: '14px',
            color: '#2a1f2e',
            letterSpacing: '0.04em',
          }}
        >
          Pokémon data © The Pokémon Company · not affiliated
        </span>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
