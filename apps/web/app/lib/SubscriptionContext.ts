import { createContext, useContext } from 'react';

export const SubscriptionContext = createContext<{ isShinySubscriber: boolean }>({
  isShinySubscriber: false,
});

export function useIsShinySubscriber(): boolean {
  return useContext(SubscriptionContext).isShinySubscriber;
}
