import { Link } from '@tanstack/react-router';
import { useSubscription } from '../hooks/useSubscription';

export function SubscriptionStatus() {
  const { isShinySubscriber, isLoaded } = useSubscription();

  if (!isLoaded) {
    return <span className="subscription-status loading">Loading...</span>;
  }

  if (isShinySubscriber) {
    return (
      <Link to="/pricing" className="subscription-status active" style={{ textDecoration: 'none' }}>
        ✨ Shiny Subscriber
      </Link>
    );
  }

  return (
    <Link to="/pricing" className="subscription-status inactive" style={{ textDecoration: 'none' }}>
      Free Plan ▶
    </Link>
  );
}
