export function ForfeitModal({ onConfirm, onCancel }: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '24px',
      }}
    >
      <div
        style={{
          background: '#0a0818',
          border: '3px solid #e84028',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '300px',
          width: '100%',
          boxShadow: '0 0 40px rgba(232,64,40,0.25), 0 8px 0 #000',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '28px', marginBottom: '10px' }}>🏳️</div>
        <h3
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '10px',
            color: '#f0e8d0',
            letterSpacing: '0.06em',
            marginBottom: '10px',
          }}
        >
          FORFEIT?
        </h3>
        <p
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: '18px',
            color: '#5b4a5e',
            marginBottom: '20px',
            lineHeight: 1.4,
          }}
        >
          Are you sure you want to forfeit? This will give the win to your opponent.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              background: '#2a1f2e',
              color: '#f0e8d0',
              border: '3px solid #14101a',
              borderRadius: '8px',
              padding: '10px',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '7px',
              cursor: 'pointer',
              boxShadow: '0 3px 0 #14101a',
              letterSpacing: '0.06em',
            }}
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              background: '#8b1a12',
              color: '#f0e8d0',
              border: '3px solid #14101a',
              borderRadius: '8px',
              padding: '10px',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '7px',
              cursor: 'pointer',
              boxShadow: '0 3px 0 #14101a',
              letterSpacing: '0.06em',
            }}
          >
            FORFEIT
          </button>
        </div>
      </div>
    </div>
  );
}
