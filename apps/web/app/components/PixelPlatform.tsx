import React from 'react';
import type { SceneType } from '../lib/types';

interface PixelPlatformProps {
  scene?: SceneType;
  /** Width of the platform in px */
  width?: number;
  /** Whether this is the opponent's (top/smaller) platform */
  isOpponent?: boolean;
}

const PLATFORM_COLORS: Record<SceneType, { base: string; edge: string; top: string }> = {
  cave:   { base: '#3a2a3a', edge: '#14101a', top: '#5a4a5e' },
  grass:  { base: '#4a6830', edge: '#2a3818', top: '#6a8840' },
  water:  { base: '#2a4878', edge: '#142038', top: '#4a6898' },
  sunset: { base: '#784828', edge: '#381808', top: '#986848' },
};

export function PixelPlatform({
  scene = 'cave',
  width = 160,
  isOpponent = false,
}: PixelPlatformProps) {
  const colors = PLATFORM_COLORS[scene];
  const height = isOpponent ? 18 : 24;
  // Opponent platform is narrower
  const w = isOpponent ? width * 0.75 : width;
  const rx = 8; // horizontal radius of ellipse

  return (
    <svg
      width={w}
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      style={{ imageRendering: 'pixelated', display: 'block' }}
    >
      {/* Platform body */}
      <ellipse
        cx={w / 2}
        cy={height / 2 + 3}
        rx={w / 2 - 2}
        ry={height / 2}
        fill={colors.base}
        stroke={colors.edge}
        strokeWidth="2"
      />
      {/* Top highlight strip */}
      <ellipse
        cx={w / 2}
        cy={height / 2}
        rx={w / 2 - 6}
        ry={height / 2 - 4}
        fill={colors.top}
      />
      {/* Center shine */}
      <ellipse
        cx={w / 2 - w * 0.1}
        cy={height / 2 - 2}
        rx={w * 0.12}
        ry={3}
        fill="rgba(255,255,255,0.15)"
      />
    </svg>
  );
}
