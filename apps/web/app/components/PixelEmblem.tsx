import React from 'react';

interface PixelEmblemProps {
  size?: number;
  color?: string;
}

/** Pixel-art Pokéball SVG used in headers and decorative elements */
export function PixelEmblem({ size = 24, color = '#e84028' }: PixelEmblemProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ imageRendering: 'pixelated', display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* Outer ring */}
      <circle cx="16" cy="16" r="15" fill="#14101a" />

      {/* Top half */}
      <path d="M2 16 A14 14 0 0 1 30 16 Z" fill={color} />

      {/* Bottom half */}
      <path d="M2 16 A14 14 0 0 0 30 16 Z" fill="#f0f0f0" />

      {/* Center band */}
      <rect x="2" y="14" width="28" height="4" fill="#14101a" />

      {/* Center button outer */}
      <circle cx="16" cy="16" r="5" fill="#14101a" />
      {/* Center button inner */}
      <circle cx="16" cy="16" r="3.5" fill="#f0f0f0" />
      {/* Center button highlight */}
      <circle cx="16" cy="16" r="2" fill="#c8c8c8" />

      {/* Shine */}
      <ellipse cx="10" cy="9" rx="3" ry="2" fill="rgba(255,255,255,0.3)" />
    </svg>
  );
}
