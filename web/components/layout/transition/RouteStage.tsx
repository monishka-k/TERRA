'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, M3_DURATION, M3_EASE } from '@/lib/motion/m3';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { useRouteTransition } from './RouteTransitionContext';

export interface RouteStageProps {
  children: React.ReactNode;
  /** Rendered element. Pages are full-viewport, so `main` is the usual choice. */
  as?: 'main' | 'div' | 'section';
  /** Extra classes on the stage root. */
  className?: string;
  /** Skip the cold-mount entrance (the transition reveal still plays). */
  disableEntrance?: boolean;
}

/**
 * Wraps a page root so the transition system can find and animate it.
 *
 * On a mount that follows a container transform, the provider drives the
 * reveal and this stays out of the way. On a cold mount — first load, or
 * browser back/forward, neither of which goes through `startTransition` — it
 * plays a short entrance of its own so those navigations do not snap.
 */
export const RouteStage: React.FC<RouteStageProps> = ({
  children,
  as: Element = 'main',
  className = '',
  disableEntrance = false,
}) => {
  const stageRef = useRef<HTMLElement>(null);
  const { isTransitioning } = useRouteTransition();
  const prefersReducedMotion = usePrefersReducedMotion();

  // Captured on the first render of this mount: a stage that arrived through a
  // container transform must leave the entrance to the provider, which is
  // already animating the surface away over the top of it.
  const ownsEntrance = useRef(!isTransitioning);

  useGSAP(
    () => {
      const stage = stageRef.current;
      if (!stage || !ownsEntrance.current || disableEntrance || prefersReducedMotion) return;

      gsap.fromTo(
        stage,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: M3_DURATION.medium4,
          ease: M3_EASE.decelerate,
          // Drop the inline transform once settled: a lingering `transform` on
          // `.route-stage` makes it the containing block for `position: fixed`
          // descendants (the globe canvas, the header), trapping them inside the
          // full-height scroll page instead of the viewport.
          clearProps: 'transform',
        }
      );
    },
    { scope: stageRef }
  );

  return (
    <Element ref={stageRef as React.Ref<never>} className={`route-stage ${className}`}>
      {children}
    </Element>
  );
};
