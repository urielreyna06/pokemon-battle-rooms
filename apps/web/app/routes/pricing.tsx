import { useState } from 'react';
import { useAuth, SignInButton } from '@clerk/react';
import { createFileRoute } from '@tanstack/react-router';
import { createCheckoutSession, getSubscriptionStatus } from '../lib/api';
import { useSubscription } from '../hooks/useSubscription';

export const Route = createFileRoute('/pricing')({ component: PricingPage });

function PricingPage() {
  const { isSignedIn, getToken } = useAuth();
  const { isShinySubscriber, isLoaded } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchParams = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';

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

      {success && (
        <div className="alert alert-success">
          Subscription activated! Shiny Pokémon are now unlocked.
        </div>
      )}
      {canceled && (
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
            <li>All 151 Pokémon</li>
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

          {!isLoaded ? (
            <button disabled className="btn btn-primary">Loading...</button>
          ) : !isSignedIn ? (
            <SignInButton mode="modal">
              <button className="btn btn-primary">Sign in to Subscribe</button>
            </SignInButton>
          ) : isShinySubscriber ? (
            <button disabled className="btn btn-success">
              ✨ Already Subscribed
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
