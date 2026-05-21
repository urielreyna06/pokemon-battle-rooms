import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/react';
import { getMe } from '../lib/api';

export function useSubscription() {
  const { isSignedIn, getToken } = useAuth();
  const [isShinySubscriber, setIsShinySubscriber] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!isSignedIn) {
      setIsShinySubscriber(false);
      setIsLoaded(true);
      return;
    }
    getToken()
      .then((token) => (token ? getMe(token) : null))
      .then((data) => setIsShinySubscriber(data?.isShinySubscriber ?? false))
      .catch(() => setIsShinySubscriber(false))
      .finally(() => setIsLoaded(true));
  }, [isSignedIn, getToken]);

  return { isShinySubscriber, isLoaded };
}
