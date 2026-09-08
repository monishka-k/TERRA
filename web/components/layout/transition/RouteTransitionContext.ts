'use client';

import { createContext, useContext } from 'react';

export interface RouteTransitionContextValue {
  /** Play the container transform out of `originEl`, then navigate to `href`. */
  startTransition: (originEl: HTMLElement | null, href: string) => void;
  /** True from the moment a transition starts until the reveal finishes. */
  isTransitioning: boolean;
}

export const RouteTransitionContext = createContext<RouteTransitionContextValue | null>(null);

/** Access the route transition controller. Throws outside the provider. */
export function useRouteTransition(): RouteTransitionContextValue {
  const context = useContext(RouteTransitionContext);
  if (!context) {
    throw new Error('useRouteTransition must be used within a RouteTransitionProvider');
  }
  return context;
}
