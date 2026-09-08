'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

export interface MapControlBarProps {
  children: ReactNode;
  /** Corner the bar is docked to. */
  position?: 'top-left' | 'top-right';
  className?: string;
  classNames?: {
    root?: string;
  };
  animation?: {
    disabled?: boolean;
    duration?: number;
  };
}

const POSITION_CLASSES: Record<NonNullable<MapControlBarProps['position']>, string> = {
  'top-left': 'left-3 top-3',
  'top-right': 'right-3 top-3',
};

/** Floating glass panel docked over the map canvas. */
export const MapControlBar = ({
  children,
  position = 'top-right',
  className = '',
  classNames = {},
  animation = {},
}: MapControlBarProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, duration = 0.45 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!animate) return;
      gsap.from(rootRef.current, {
        y: -10,
        opacity: 0,
        duration,
        ease: 'power3.out',
      });
    },
    { scope: rootRef, dependencies: [animate, duration] },
  );

  return (
    <div
      ref={rootRef}
      className={[
        'pointer-events-auto absolute z-10 w-56 rounded-lg border border-line bg-panel/92 p-3 shadow-lg backdrop-blur-md',
        POSITION_CLASSES[position],
        classNames.root ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
};
