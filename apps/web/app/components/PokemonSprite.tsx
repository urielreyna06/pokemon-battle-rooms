import React, { useState } from 'react';

interface PokemonSpriteProps {
  spriteUrl: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  animating?: 'shake' | 'flash' | 'faint' | null;
  /** If true, render back sprite (player's own Pokémon) */
  isBack?: boolean;
}

const SIZE_MAP = { sm: 80, md: 112, lg: 144 };

/** Pixel silhouette fallback shown while sprite loads */
function PixelSilhouette({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: 'rgba(255,255,255,0.05)',
        border: '2px solid rgba(255,255,255,0.1)',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        imageRendering: 'pixelated',
      }}
    >
      {/* Simple pixel art silhouette - 3x3 grid pattern */}
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16">
        <rect x="5" y="1" width="6" height="6" fill="rgba(255,255,255,0.15)" />
        <rect x="3" y="7" width="10" height="6" fill="rgba(255,255,255,0.15)" />
        <rect x="3" y="13" width="4" height="2" fill="rgba(255,255,255,0.15)" />
        <rect x="9" y="13" width="4" height="2" fill="rgba(255,255,255,0.15)" />
      </svg>
    </div>
  );
}

export function PokemonSprite({
  spriteUrl,
  name,
  size = 'md',
  animating = null,
  isBack = false,
}: PokemonSpriteProps) {
  const px = SIZE_MAP[size];
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Map animation prop to CSS animation class
  let animStyle: React.CSSProperties = {};
  if (animating === 'shake') {
    animStyle = { animation: 'shake 0.5s ease' };
  } else if (animating === 'flash') {
    animStyle = { animation: 'flashWhite 0.4s ease' };
  } else if (animating === 'faint') {
    animStyle = { animation: 'faintFall 0.6s ease forwards' };
  }

  if (error || !spriteUrl) {
    return <PixelSilhouette size={px} />;
  }

  return (
    <div style={{ position: 'relative', width: px, height: px }}>
      {!loaded && <PixelSilhouette size={px} />}
      <img
        // Key on animating so re-mount restarts animation
        key={`${spriteUrl}-${animating}`}
        src={spriteUrl}
        alt={name}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{
          position: loaded ? 'static' : 'absolute',
          top: 0,
          left: 0,
          width: px,
          height: px,
          imageRendering: 'pixelated',
          objectFit: 'contain',
          display: loaded ? 'block' : 'none',
          // Back sprites scale up slightly (they're naturally smaller)
          transform: isBack ? 'scale(1.15)' : 'scale(1)',
          transformOrigin: 'bottom center',
          ...animStyle,
        }}
      />
    </div>
  );
}
