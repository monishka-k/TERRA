'use client';

import { useCallback, useRef } from 'react';
import { gsap, M3_DURATION, M3_EASE } from '@/lib/motion/m3';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

export interface UseRippleOptions {
  /** Skip ripple creation entirely. */
  disabled?: boolean;
  /** Override the expansion duration, in seconds. */
  duration?: number;
  /** Peak opacity of the ripple. M3 uses 12% for the pressed state. */
  opacity?: number;
}

export interface UseRippleResult {
  /** Attach to the element that clips the ripple (`.m3-ripple-layer`). */
  layerRef: React.RefObject<HTMLSpanElement | null>;
  /** Call from a pointer-down handler to spawn a ripple at the cursor. */
  spawn: (event: React.PointerEvent<HTMLElement>) => void;
}

/**
 * Material 3 pressed-state ripple, driven by GSAP.
 *
 * The circle is sized to reach the furthest corner from the press point so the
 * fill always covers the host, then expands from 0 while fading out. Reduced
 * motion suppresses it: the underlying `.m3-state-layer` hover tint still
 * communicates interactivity without the travelling animation.
 */
export function useRipple(options: UseRippleOptions = {}): UseRippleResult {
  const { disabled = false, duration = M3_DURATION.long2, opacity = 0.12 } = options;
  const layerRef = useRef<HTMLSpanElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const spawn = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const layer = layerRef.current;
      if (!layer || disabled || prefersReducedMotion) return;

      const bounds = layer.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      // Radius that still covers the corner furthest from the press point.
      const radius = Math.hypot(
        Math.max(x, bounds.width - x),
        Math.max(y, bounds.height - y)
      );

      const circle = document.createElement('span');
      circle.style.cssText = [
        'position:absolute',
        'border-radius:9999px',
        'background-color:currentColor',
        'pointer-events:none',
        `width:${radius * 2}px`,
        `height:${radius * 2}px`,
        `left:${x - radius}px`,
        `top:${y - radius}px`,
      ].join(';');
      layer.appendChild(circle);

      gsap.fromTo(
        circle,
        { scale: 0, opacity },
        {
          scale: 1,
          opacity: 0,
          duration,
          ease: M3_EASE.standard,
          onComplete: () => circle.remove(),
        }
      );
    },
    [disabled, duration, opacity, prefersReducedMotion]
  );

  return { layerRef, spawn };
}
