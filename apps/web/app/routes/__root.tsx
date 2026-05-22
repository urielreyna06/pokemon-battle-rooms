// SPA puro — sin SSR, sin HeadContent/Scripts de servidor
// El <head> lo maneja index.html directamente
import React from 'react';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/react';
import { SubscriptionContext } from '../lib/SubscriptionContext';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionStatus } from '../components/SubscriptionStatus';

// ── Auth gate — shown while Clerk is loading or user is signed out ─────────
function AuthGate() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #08060e 0%, #1a0f2e 50%, #08060e 100%)',
        gap: '24px',
        padding: '24px',
      }}
    >
      <h1
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '14px',
          color: '#f8efd1',
          letterSpacing: '0.06em',
          textShadow: '2px 2px 0 #14101a',
          margin: 0,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        POKÉMON<br />
        <span style={{ color: '#e84028' }}>BATTLE ROOMS</span>
      </h1>

      <p
        style={{
          fontFamily: "'VT323', monospace",
          fontSize: '20px',
          color: '#5b4a5e',
          margin: 0,
          textAlign: 'center',
        }}
      >
        Sign in to start battling
      </p>

      <SignInButton mode="modal">
        <button
          style={{
            background: '#e84028',
            color: '#fff',
            border: '3px solid #14101a',
            borderRadius: '4px',
            padding: '14px 28px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '10px',
            cursor: 'pointer',
            boxShadow: '0 4px 0 #14101a',
            textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
            letterSpacing: '0.08em',
          }}
        >
          ▶ SIGN IN
        </button>
      </SignInButton>
    </div>
  );
}

function RootLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isShinySubscriber } = useSubscription();

  // While Clerk is initializing, show nothing (avoids flash)
  if (!isLoaded) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#08060e',
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
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not signed in — show the auth gate instead of the app
  if (!isSignedIn) {
    return <AuthGate />;
  }

  return (
    <SubscriptionContext.Provider value={{ isShinySubscriber }}>
      <header
        style={{
          position: 'fixed', top: 0, right: 0, zIndex: 1000,
          padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        <SignedIn>
          <SubscriptionStatus />
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </header>
      <Outlet />
    </SubscriptionContext.Provider>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
