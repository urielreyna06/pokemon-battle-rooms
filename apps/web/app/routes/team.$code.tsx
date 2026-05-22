import React, { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useApi } from '../hooks/useApi';
import { TypeBadge } from '../components/TypeBadge';
import { Toast } from '../components/Toast';
import type { ToastState, PokemonType } from '../lib/types';
import type { PokemonDoc } from '@pokemon-battle/shared';

export const Route = createFileRoute('/team/$code')({
  component: TeamSelectPage,
});

const PAGE_SIZE = 30;

function TeamSelectPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const api = useApi();
  const stored = sessionStorage.getItem(`player_${code}`);
  const { playerId } = stored
    ? (JSON.parse(stored) as { playerId: string })
    : { playerId: null };

  const [allPokemon, setAllPokemon] = useState<PokemonDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [toast, setToast] = useState<ToastState>(null);

  // Once confirmed, poll until battle starts
  useEffect(() => {
    if (!confirmed) return;
    let timer: ReturnType<typeof setInterval>;

    async function poll() {
      try {
        const data = await api.getRoomState(code);
        if (data.room.status === 'battling' && data.battle) {
          clearInterval(timer);
          navigate({ to: '/battle/$code', params: { code } });
        }
      } catch { /* ignore */ }
    }

    poll();
    timer = setInterval(poll, 1500);
    return () => clearInterval(timer);
  }, [confirmed, code, navigate]);

  useEffect(() => {
    loadPokemon(0);
  }, [search, typeFilter]);

  async function loadPokemon(newOffset: number) {
    setLoading(true);
    try {
      const data = await api.getPokemon(
        PAGE_SIZE,
        newOffset,
        search.trim() || undefined,
        typeFilter || undefined
      );
      setAllPokemon((prev) => newOffset === 0 ? data.pokemon : [...prev, ...data.pokemon]);
      setTotal(data.total);
      setOffset(newOffset + PAGE_SIZE);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'Load error', kind: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function togglePokemon(id: number) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 6) {
        setToast({ msg: 'Max 6 Pokémon!', kind: 'warn' });
        return prev;
      }
      return [...prev, id];
    });
  }

  async function handleConfirm() {
    if (selected.length < 1) {
      setToast({ msg: 'Select at least 1 Pokémon!', kind: 'warn' });
      return;
    }
    setSubmitting(true);
    try {
      await api.submitTeam(code, playerId!, selected);
      await api.setReady(code, playerId!);
      setConfirmed(true);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'Submit error', kind: 'error' });
      setSubmitting(false);
    }
  }

  const filtered = allPokemon;

  const selectedPokemon = allPokemon.filter((p) => selected.includes(p.pokedexId));

  // ── Waiting screen ───────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #08060e 0%, #1a0f2e 50%, #08060e 100%)',
          padding: '24px',
          gap: '24px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid #2a1f2e',
            borderTopColor: '#e84028',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <h2 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', color: '#f8efd1', textAlign: 'center', letterSpacing: '0.06em' }}>
          TEAM LOCKED IN!
        </h2>
        <p style={{ fontFamily: "'VT323', monospace", fontSize: '22px', color: '#5b4a5e', textAlign: 'center' }}>
          Waiting for opponent to pick their team...
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {selectedPokemon.map((p) => (
            <div key={p.pokedexId} style={{ textAlign: 'center' }}>
              <img src={p.spriteUrl} alt={p.name} style={{ width: '64px', height: '64px', imageRendering: 'pixelated', display: 'block' }} />
              <span style={{ fontFamily: "'VT323', monospace", fontSize: '16px', color: '#f0e8d0', textTransform: 'capitalize' }}>{p.name}</span>
            </div>
          ))}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Team selection screen ─────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #08060e 0%, #1a0f2e 50%, #08060e 100%)',
        paddingBottom: '80px',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#14101a',
          borderBottom: '3px solid #2a1f2e',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: '#f8efd1', letterSpacing: '0.06em' }}>
            CHOOSE YOUR TEAM
          </span>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: '18px', color: '#5b4a5e', marginTop: '2px' }}>
            Room {code} • Select up to 6
          </div>
        </div>
        <div
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '14px',
            color: selected.length === 6 ? '#5fc63a' : '#f0e8d0',
            letterSpacing: '0.06em',
            minWidth: '40px',
            textAlign: 'right',
          }}
        >
          {selected.length}/6
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Selected team preview */}
        {selected.length > 0 && (
          <div
            style={{
              background: '#14101a',
              border: '3px solid #2a1f2e',
              borderRadius: '4px',
              padding: '12px',
              marginBottom: '16px',
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            {selectedPokemon.map((p, idx) => (
              <div
                key={p.pokedexId}
                onClick={() => togglePokemon(p.pokedexId)}
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: '6px',
                  background: '#1a0f1e',
                  border: '2px solid #e84028',
                  borderRadius: '4px',
                }}
                title="Click to remove"
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    background: '#e84028',
                    color: '#fff',
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '6px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #14101a',
                    zIndex: 1,
                  }}
                >
                  {idx + 1}
                </div>
                <img src={p.spriteUrl} alt={p.name} style={{ width: '48px', height: '48px', imageRendering: 'pixelated', display: 'block' }} />
                <span style={{ fontFamily: "'VT323', monospace", fontSize: '14px', color: '#f0e8d0', textTransform: 'capitalize', display: 'block' }}>
                  {p.name.slice(0, 8)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <input
          style={{
            display: 'block',
            width: '100%',
            background: '#1a0f1e',
            border: '3px solid #2a1f2e',
            borderRadius: '4px',
            padding: '10px 12px',
            color: '#f0e8d0',
            fontFamily: "'VT323', monospace",
            fontSize: '20px',
            outline: 'none',
            marginBottom: '12px',
            boxSizing: 'border-box',
          }}
          placeholder="Search Pokémon..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Type filter chips */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: '14px', color: '#5b4a5e', marginBottom: '8px' }}>
            Types:
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setTypeFilter('')}
              style={{
                background: typeFilter === '' ? '#e84028' : '#2a1f2e',
                color: typeFilter === '' ? '#fff' : '#f0e8d0',
                border: '2px solid #14101a',
                borderRadius: '4px',
                padding: '6px 12px',
                fontFamily: "'VT323', monospace",
                fontSize: '12px',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.1s',
              }}
            >
              All
            </button>
            {['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
                style={{
                  background: typeFilter === type ? '#e84028' : '#2a1f2e',
                  color: typeFilter === type ? '#fff' : '#f0e8d0',
                  border: '2px solid #14101a',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontFamily: "'VT323', monospace",
                  fontSize: '12px',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.1s',
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Pokémon grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: '8px',
          }}
        >
          {filtered.map((p) => {
            const isSelected = selected.includes(p.pokedexId);
            const selIdx = isSelected ? selected.indexOf(p.pokedexId) + 1 : null;
            return (
              <div
                key={p.pokedexId}
                onClick={() => togglePokemon(p.pokedexId)}
                style={{
                  position: 'relative',
                  background: isSelected ? '#1a0f1e' : '#14101a',
                  border: `3px solid ${isSelected ? '#e84028' : '#2a1f2e'}`,
                  borderRadius: '4px',
                  padding: '8px 6px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  boxShadow: isSelected ? '0 0 10px rgba(232,64,40,0.3)' : '0 3px 0 #000',
                  transition: 'border-color 0.1s, box-shadow 0.1s',
                }}
              >
                {selIdx && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      background: '#e84028',
                      color: '#fff',
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: '6px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #14101a',
                    }}
                  >
                    {selIdx}
                  </div>
                )}
                <img
                  src={p.spriteUrl}
                  alt={p.name}
                  style={{ width: '72px', height: '72px', imageRendering: 'pixelated', display: 'block', margin: '0 auto' }}
                />
                <div
                  style={{
                    fontFamily: "'VT323', monospace",
                    fontSize: '16px',
                    color: '#f0e8d0',
                    textTransform: 'capitalize',
                    marginTop: '4px',
                    letterSpacing: '0.02em',
                  }}
                >
                  {p.name.replace(/-/g, ' ')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '3px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {p.types.map((t) => (
                    <TypeBadge key={t} type={t as PokemonType} size="xs" />
                  ))}
                </div>
                {/* Dex number */}
                <div style={{ fontFamily: "'VT323', monospace", fontSize: '13px', color: '#2a1f2e', marginTop: '2px' }}>
                  #{String(p.pokedexId).padStart(3, '0')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Load more */}
        {offset < total && !search && !typeFilter && (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              onClick={() => loadPokemon(offset)}
              disabled={loading}
              style={{
                background: '#2a1f2e',
                color: '#f0e8d0',
                border: '3px solid #14101a',
                borderRadius: '4px',
                padding: '10px 20px',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '7px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 3px 0 #14101a',
                opacity: loading ? 0.6 : 1,
                letterSpacing: '0.06em',
              }}
            >
              {loading ? 'LOADING...' : `LOAD MORE (${total - offset} left)`}
            </button>
          </div>
        )}
      </div>

      {/* Sticky confirm bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#14101a',
          borderTop: '3px solid #2a1f2e',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          zIndex: 20,
        }}
      >
        <span
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: '20px',
            color: '#5b4a5e',
            letterSpacing: '0.04em',
          }}
        >
          {selected.length} selected
        </span>
        <button
          onClick={handleConfirm}
          disabled={selected.length < 1 || submitting}
          style={{
            background: selected.length > 0 ? '#e84028' : '#2a1f2e',
            color: '#fff',
            border: '3px solid #14101a',
            borderRadius: '4px',
            padding: '10px 20px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '8px',
            cursor: selected.length > 0 && !submitting ? 'pointer' : 'not-allowed',
            boxShadow: '0 3px 0 #14101a',
            opacity: selected.length > 0 && !submitting ? 1 : 0.5,
            letterSpacing: '0.06em',
            textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
          }}
        >
          {submitting ? '▶ LOCKING IN...' : '⚔ LOCK IN TEAM!'}
        </button>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
