import React from 'react';

interface DialogueBoxProps {
  children: React.ReactNode;
  /** Show the blinking ▼ arrow to indicate more text */
  showArrow?: boolean;
  /** Additional inline styles for the container */
  style?: React.CSSProperties;
}

/** Retro dialogue box with pixel-art border and optional blink arrow */
export function DialogueBox({ children, showArrow = false, style }: DialogueBoxProps) {
  return (
    <div
      style={{
        position: 'relative',
        background: '#f8efd1',
        border: '4px solid #14101a',
        borderRadius: '6px',
        padding: '12px 14px',
        boxShadow: '0 4px 0 #14101a, inset 0 2px 0 rgba(255,255,255,0.6)',
        // Inner highlight border
        outline: '2px solid #8b7340',
        outlineOffset: '2px',
        ...style,
      }}
    >
      {/* Corner pixel accents */}
      <div style={{ position: 'absolute', top: 2, left: 2, width: 4, height: 4, background: '#14101a' }} />
      <div style={{ position: 'absolute', top: 2, right: 2, width: 4, height: 4, background: '#14101a' }} />
      <div style={{ position: 'absolute', bottom: 2, left: 2, width: 4, height: 4, background: '#14101a' }} />
      <div style={{ position: 'absolute', bottom: 2, right: 2, width: 4, height: 4, background: '#14101a' }} />

      {/* Content */}
      <div
        style={{
          fontFamily: "'VT323', monospace",
          fontSize: '22px',
          color: '#14101a',
          lineHeight: 1.3,
          letterSpacing: '0.02em',
        }}
      >
        {children}
      </div>

      {/* Blink arrow */}
      {showArrow && (
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            right: 10,
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '10px',
            color: '#14101a',
            animation: 'blink 0.8s step-end infinite',
          }}
        >
          ▼
        </div>
      )}
    </div>
  );
}
