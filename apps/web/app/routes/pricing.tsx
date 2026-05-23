import { useState, useEffect, useRef } from 'react';
import { useAuth, SignInButton } from '@clerk/react';
import { createFileRoute } from '@tanstack/react-router';
import { createCheckoutSession } from '../lib/api';
import { useApi } from '../hooks/useApi';

export const Route = createFileRoute('/pricing')({ component: PricingPage });

const searchParams =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const SUCCESS_PARAM = searchParams.get('success') === 'true';
const CANCELED_PARAM = searchParams.get('canceled') === 'true';

function PricingPage() {
  const { isSignedIn, getToken } = useAuth();
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [subLoaded, setSubLoaded] = useState(false);
  // When returning from Stripe with ?success=true, poll until webhook confirms
  const [confirming, setConfirming] = useState(SUCCESS_PARAM);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial subscription status
  useEffect(() => {
    if (!isSignedIn) { setSubLoaded(true); return; }
    api.getBattle('__status__').catch(() => null); // warm auth
    getToken()
      .then((token) => token ? fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }) : null)
      .then((r) => r?.ok ? r.json() : null)
      .then((data: { isShinySubscriber?: boolean } | null) => {
        setIsSubscriber(data?.isShinySubscriber ?? false);
      })
      .catch(() => {})
      .finally(() => setSubLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  // Poll for subscription confirmation after Stripe redirect
  useEffect(() => {
    if (!SUCCESS_PARAM || !isSignedIn || !subLoaded) return;
    if (isSubscriber) { setConfirming(false); return; }

    let attempts = 0;
    const MAX = 15; // 15 × 2s = 30s max wait

    pollRef.current = setInterval(() => {
      attempts++;
      getToken()
        .then((token) => token ? fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }) : null)
        .then((r) => r?.ok ? r.json() : null)
        .then((data: { isShinySubscriber?: boolean } | null) => {
          if (data?.isShinySubscriber) {
            setIsSubscriber(true);
            setConfirming(false);
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (attempts >= MAX) {
            setConfirming(false);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        })
        .catch(() => {
          if (attempts >= MAX) {
            setConfirming(false);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        });
    }, 2000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, subLoaded, isSubscriber]);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const { url } = await createCheckoutSession(token);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pricing-page">
      <div className="pricing-hero">
        <h1>Unlock Shiny Pokémon</h1>
        <p>Subscribe for $5/month to unlock shiny variants in battle and the Pokédex.</p>
      </div>

      {SUCCESS_PARAM && (
        <div className="alert alert-success" style={{ textAlign: 'center', fontSize: '1.1rem', padding: '1.2rem 2rem' }}>
          {confirming
            ? '⏳ Payment confirmed! Activating your Shiny subscription…'
            : isSubscriber
            ? '✨ Subscription activated! Shiny Pokémon are now unlocked.'
            : '✅ Payment received. Subscription will activate shortly — refresh if needed.'}
        </div>
      )}
      {CANCELED_PARAM && (
        <div className="alert alert-info">
          Checkout canceled. You can subscribe anytime.
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="pricing-cards">
        <div className="pricing-card">
          <h2>Free</h2>
          <p className="price">$0 / month</p>
          <ul>
            <li>Full battle system</li>
            <li>All Pokémon</li>
            <li>Multiplayer rooms</li>
          </ul>
          <button disabled className="btn btn-secondary">
            Current Plan
          </button>
        </div>

        <div className="pricing-card pricing-card--featured">
          <h2>Shiny Hunter</h2>
          <p className="price">$5 / month</p>
          <ul>
            <li>Everything in Free</li>
            <li>Shiny sprites in Pokédex</li>
            <li>5% shiny encounter chance in battle</li>
            <li>Exclusive shiny badge</li>
          </ul>

          {!subLoaded ? (
            <button disabled className="btn btn-primary">Loading...</button>
          ) : !isSignedIn ? (
            <SignInButton mode="modal">
              <button className="btn btn-primary">Sign in to Subscribe</button>
            </SignInButton>
          ) : isSubscriber ? (
            <button disabled className="btn btn-success">
              ✨ Already Subscribed
            </button>
          ) : confirming ? (
            <button disabled className="btn btn-primary">
              ⏳ Activating…
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? 'Redirecting...' : 'Subscribe — $5/mo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PricingPage;
