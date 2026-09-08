'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, M3_DURATION, M3_EASE, type M3AnimationConfig } from '@/lib/motion/m3';
import { INTRO_TIMINGS } from '@/lib/motion/introSequence';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { useTheme } from '@/components/providers';
import { QuickControlFab } from './QuickControlFab';

export interface FloatingQuickControlsProps {
  /** Whether auto-rotation is currently active */
  isAutoRotating?: boolean;
  /** Callback to toggle auto-rotation */
  onToggleRotation?: () => void;
  /** Callback to focus camera onto India / primary hazard beacon */
  onFocusHazard?: () => void;
  /** Custom root className */
  className?: string;
  /** Entrance animation overrides */
  animation?: M3AnimationConfig;
}

export const FloatingQuickControls: React.FC<FloatingQuickControlsProps> = ({
  isAutoRotating = true,
  onToggleRotation,
  onFocusHazard,
  className = '',
  animation = {},
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const containerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const isLight = resolvedTheme === 'light';
  const {
    disabled: animationDisabled = false,
    duration = M3_DURATION.long2,
    delay = INTRO_TIMINGS.fabRail,
  } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!animate) return;
      gsap.fromTo(
        '.quick-control-fab',
        { opacity: 0, x: 24, scale: 0.8 },
        {
          opacity: 1,
          x: 0,
          scale: 1,
          duration,
          delay,
          stagger: 0.06,
          ease: M3_EASE.decelerate,
        }
      );
    },
    { scope: containerRef, dependencies: [animate, duration, delay] }
  );

  return (
    <aside
      ref={containerRef}
      className={`fixed right-6 sm:right-10 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3.5 pointer-events-auto select-none ${className}`}
      aria-label="Spatial Quick Controls"
    >
      <QuickControlFab
        icon={isLight ? 'wb_sunny' : 'nightlight'}
        label={isLight ? 'Switch to Dark Forest Mode' : 'Switch to Daylight Sage Mode'}
        onClick={toggleTheme}
        disableAnimation={!animate}
      />

      <QuickControlFab
        icon="my_location"
        label="Focus Camera on India Disaster Red Zone"
        onClick={onFocusHazard}
        classNames={{ icon: 'group-hover:text-critical transition-colors' }}
        disableAnimation={!animate}
      />

      <QuickControlFab
        icon="sync"
        label={isAutoRotating ? 'Pause Globe Auto-Rotation' : 'Resume Globe Auto-Rotation'}
        onClick={onToggleRotation}
        isActive={isAutoRotating}
        className={isAutoRotating ? 'text-m3-on-surface' : 'text-m3-on-surface-variant opacity-80'}
        classNames={{
          icon: `transition-transform duration-500 ease-m3-standard ${isAutoRotating ? 'rotate-180' : ''
            }`,
        }}
        disableAnimation={!animate}
      />
    </aside>
  );
};
