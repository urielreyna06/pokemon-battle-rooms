import { useSubscription } from '../hooks/useSubscription';

export function SubscriptionStatus() {
  const { isShinySubscriber, isLoaded } = useSubscription();

  if (!isLoaded) {
    return <span className="subscription-status loading">Loading...</span>;
  }

  return (
    <span className={`subscription-status ${isShinySubscriber ? 'active' : 'inactive'}`}>
      {isShinySubscriber ? '✨ Shiny Subscriber' : 'Free Plan'}
    </span>
  );
}
