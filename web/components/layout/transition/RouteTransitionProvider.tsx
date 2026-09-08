'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { gsap, M3_DURATION, M3_EASE } from '@/lib/motion/m3';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { RouteTransitionContext } from './RouteTransitionContext';

export interface RouteTransitionProviderProps {
  children: React.ReactNode;
  /** Duration of the expand half, in seconds. */
  exitDuration?: number;
  /** Duration of the reveal half, in seconds. */
  enterDuration?: number;
  /**
   * How long to wait for the destination to report ready before revealing
   * anyway. Prevents a slow route from leaving an opaque panel on screen.
   */
  failsafeMs?: number;
  /** Disable the transform; navigation still works, it just cuts. */
  disabled?: boolean;
}

type Phase = 'idle' | 'exiting' | 'awaiting' | 'entering';

/** Radius the surface starts at — the pill shape of the origin control. */
const PILL_RADIUS = 9999;

/**
 * Drives the Material 3 container transform across an App Router navigation.
 *
 * The transform is split in half around `router.push`: the surface grows from
 * the clicked control to full bleed, the router swaps underneath while the
 * screen is covered, and the destination's `RouteStage` triggers the reveal.
 * That is what hides the route change — there is no frame where a half-built
 * page is visible.
 */
export const RouteTransitionProvider: React.FC<RouteTransitionProviderProps> = ({
  children,
  exitDuration = M3_DURATION.long2,
  enterDuration = M3_DURATION.medium4,
  failsafeMs = 1200,
  disabled = false,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const prefersReducedMotion = usePrefersReducedMotion();

  const surfaceRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>('idle');
  const failsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const clearFailsafe = useCallback(() => {
    if (failsafeRef.current) {
      clearTimeout(failsafeRef.current);
      failsafeRef.current = null;
    }
  }, []);

  const settle = useCallback(() => {
    const surface = surfaceRef.current;
    if (surface) {
      surface.dataset.active = 'false';
      gsap.set(surface, { opacity: 0 });
    }
    phaseRef.current = 'idle';
    setIsTransitioning(false);
  }, []);

  /** The reveal half: uncover the destination and settle its content in. */
  const reveal = useCallback(
    (stage: HTMLElement | null) => {
      clearFailsafe();
      const surface = surfaceRef.current;
      if (!surface) {
        settle();
        return;
      }
      phaseRef.current = 'entering';

      const duration = prefersReducedMotion ? 0.12 : enterDuration;
      const timeline = gsap.timeline({ onComplete: settle });

      timeline.to(surface, {
        opacity: 0,
        duration,
        ease: M3_EASE.decelerate,
      }, 0);

      if (stage && !prefersReducedMotion) {
        timeline.fromTo(
          stage,
          { opacity: 0, scale: 1.02, y: 8 },
          // clearProps drops the inline transform once settled: a lingering
          // `transform` on `.route-stage` makes it the containing block for
          // `position: fixed` descendants, trapping them in the scroll page.
          { opacity: 1, scale: 1, y: 0, duration, ease: M3_EASE.decelerate, clearProps: 'transform' },
          0
        );
      } else if (stage) {
        gsap.set(stage, { opacity: 1, clearProps: 'transform' });
      }
    },
    [clearFailsafe, enterDuration, prefersReducedMotion, settle]
  );

  /**
   * The destination page has committed once `pathname` changes, so the reveal
   * is driven from here rather than handed off by the incoming `RouteStage`.
   * Keeping the tween in the provider matters: created inside a child's
   * `useGSAP` scope it would join that child's gsap context and be reverted
   * the moment the child re-ran its effects.
   */
  useEffect(() => {
    if (phaseRef.current !== 'awaiting') return;
    reveal(document.querySelector<HTMLElement>('.route-stage'));
  }, [pathname, reveal]);

  const startTransition = useCallback(
    (originEl: HTMLElement | null, href: string) => {
      const surface = surfaceRef.current;
      if (disabled || !surface || phaseRef.current !== 'idle' || href === pathname) {
        if (href !== pathname) router.push(href);
        return;
      }

      phaseRef.current = 'exiting';
      setIsTransitioning(true);

      const stage = document.querySelector<HTMLElement>('.route-stage');
      const bounds = originEl?.getBoundingClientRect();

      surface.dataset.active = 'true';

      const handoff = () => {
        phaseRef.current = 'awaiting';
        router.push(href);
        clearFailsafe();
        failsafeRef.current = setTimeout(() => {
          reveal(document.querySelector<HTMLElement>('.route-stage'));
        }, failsafeMs);
      };

      if (prefersReducedMotion || !bounds) {
        gsap.set(surface, { top: 0, left: 0, width: '100vw', height: '100vh', borderRadius: 0 });
        gsap.to(surface, { opacity: 1, duration: 0.12, onComplete: handoff });
        return;
      }

      // Park the surface exactly over the control that was clicked. The rect
      // already accounts for any GSAP hover scale on the origin.
      gsap.set(surface, {
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
        borderRadius: PILL_RADIUS,
        opacity: 1,
      });

      const timeline = gsap.timeline({ onComplete: handoff });

      timeline.to(surface, {
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        borderRadius: 0,
        duration: exitDuration,
        ease: M3_EASE.accelerate,
      }, 0);

      if (stage) {
        timeline.to(stage, {
          opacity: 0,
          scale: 0.96,
          duration: M3_DURATION.medium2,
          ease: M3_EASE.accelerate,
        }, 0);
      }
    },
    [
      clearFailsafe,
      disabled,
      exitDuration,
      failsafeMs,
      pathname,
      prefersReducedMotion,
      reveal,
      router,
    ]
  );

  useEffect(() => clearFailsafe, [clearFailsafe]);

  return (
    <RouteTransitionContext.Provider
      value={{ startTransition, isTransitioning }}
    >
      {children}
      <div
        ref={surfaceRef}
        aria-hidden
        data-active="false"
        className="m3-morph-surface bg-m3-surface-container-low"
      />
    </RouteTransitionContext.Provider>
  );
};
