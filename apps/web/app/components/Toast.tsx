import React, { useEffect, useState } from 'react';
import type { ToastState } from '../lib/types';

interface ToastProps {
  toast: ToastState;
  onDismiss: () => void;
  /** Auto-dismiss after ms (default 3000, 0 = no auto-dismiss) */
  duration?: number;
}

const KIND_STYLES: Record<NonNullable<ToastState>['kind'] & string, { bg: string; border: string; icon: string }> = {
  error:   { bg: '#e02828', border: '#901818', icon: '✖' },
  warn:    { bg: '#f8b830', border: '#b88018', icon: '⚠' },
  success: { bg: '#5fc63a', border: '#2f8a18', icon: '✔' },
  info:    { bg: '#3878c8', border: '#1a4888', icon: 'ℹ' },
};

export function Toast({ toast, onDismiss, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) { setVisible(false); return; }
    // Trigger enter animation
    const t1 = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss
    if (duration > 0) {
      const t2 = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300); // Wait for exit animation
      }, duration);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    return () => clearTimeout(t1);
  }, [toast, duration, onDismiss]);

  if (!toast) return null;

  const kind = toast.kind ?? 'info';
  const s = KIND_STYLES[kind] ?? KIND_STYLES.info;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : '20px'})`,
        opacity: visible ? 1 : 0,
        transition: 'transform 0.25s ease, opacity 0.25s ease',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: s.bg,
          border: `3px solid ${s.border}`,
          borderRadius: '4px',
          padding: '8px 14px',
          boxShadow: `0 4px 0 ${s.border}, 0 6px 20px rgba(0,0,0,0.5)`,
          minWidth: '200px',
          maxWidth: '360px',
          pointerEvents: 'auto',
        }}
      >
        {/* Icon */}
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '10px',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {s.icon}
        </span>

        {/* Message */}
        <span
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: '20px',
            color: '#fff',
            textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
            letterSpacing: '0.02em',
            flex: 1,
          }}
        >
          {toast.msg}
        </span>

        {/* Close button */}
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.7)',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '8px',
            padding: '0 0 0 4px',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
