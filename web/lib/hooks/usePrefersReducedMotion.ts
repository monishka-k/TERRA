'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** The server cannot know the preference; assume motion is allowed and correct on hydration. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Tracks the user's reduced-motion preference (FR-10.7).
 *
 * `useSyncExternalStore` rather than an effect: `matchMedia` is external state, so this
 * reads it during render without the extra mount-time re-render an effect would cause.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
