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
  background: '#1a0f1e',
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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #08060e 0%, #1a0f2e 50%, #08060e 100%)',
        padding: '24px 16px',
        gap: '32px',
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <PixelEmblem size={48} color="#e84028" />
        </div>
        <h1
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '14px',
            color: '#f8efd1',
            letterSpacing: '0.06em',
            lineHeight: 1.5,
            margin: 0,
            textShadow: '2px 2px 0 #14101a',
          }}
        >
          POKÉMON
        </h1>
        <h2
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '10px',
            color: '#e84028',
            letterSpacing: '0.1em',
            margin: '6px 0 0',
            textShadow: '1px 1px 0 #14101a',
          }}
        >
          BATTLE ROOMS
        </h2>
        <p
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: '20px',
            color: '#5b4a5e',
            marginTop: '8px',
            letterSpacing: '0.04em',
          }}
        >
          1v1 battles — real Pokémon data
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: '#14101a',
          border: '4px solid #2a1f2e',
          borderRadius: '6px',
          padding: '24px',
          boxShadow: '0 8px 0 #000, 0 12px 32px rgba(0,0,0,0.6)',
        }}
      >
        {/* Name input */}
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
          style={INPUT_STYLE}
          placeholder="Ash Ketchum"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          maxLength={16}
        />

        {/* Divider */}
        <div style={{ margin: '20px 0', borderTop: '2px solid #2a1f2e' }} />

        {/* Create room */}
        <button
          style={{
            ...BTN_PRIMARY,
            opacity: loading ? 0.7 : 1,
          }}
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

        {/* Or separator */}
        <p
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: '18px',
            color: '#5b4a5e',
            textAlign: 'center',
            margin: '12px 0',
            letterSpacing: '0.1em',
          }}
        >
          — or join existing room —
        </p>

        {/* Join code + button */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            style={{
              ...INPUT_STYLE,
              flex: 1,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              textAlign: 'center',
            }}
            placeholder="ABC123"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            maxLength={6}
          />
          <button
            style={{
              ...BTN_SECONDARY,
              opacity: loading ? 0.7 : 1,
            }}
            onClick={handleJoin}
            disabled={!!loading}
          >
            {loading === 'join' ? '...' : 'JOIN'}
          </button>
        </div>
      </div>

      {/* Version note */}
      <p
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '6px',
          color: '#2a1f2e',
          letterSpacing: '0.08em',
        }}
      >
        v1.0 — UTP FISC 2025
      </p>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
