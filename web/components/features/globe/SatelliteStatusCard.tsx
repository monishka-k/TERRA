'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, M3_DURATION, M3_EASE, type M3AnimationConfig } from '@/lib/motion/m3';
import { INTRO_TIMINGS } from '@/lib/motion/introSequence';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

export interface SatelliteStatusCardProps {
  /** Geographic region label */
  region?: React.ReactNode;
  /** Status subtitle */
  subtitle?: React.ReactNode;
  /** Live indicator label */
  statusText?: React.ReactNode;
  /** Material Symbols ligature for the leading badge */
  icon?: string;
  /** Custom root className */
  className?: string;
  /** Granular styling overrides */
  classNames?: {
    card?: string;
    iconWrapper?: string;
    region?: string;
    subtitle?: string;
  };
  /** Entrance and hover animation overrides */
  animation?: M3AnimationConfig;
}

export const SatelliteStatusCard: React.FC<SatelliteStatusCardProps> = ({
  region = 'India Subcontinent',
  subtitle = 'Live Satellite View',
  statusText = 'Live',
  icon = 'satellite_alt',
  className = '',
  classNames = {},
  animation = {},
}) => {
  const containerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const {
    disabled: animationDisabled = false,
    duration = M3_DURATION.long2,
    delay = INTRO_TIMINGS.statusCard,
  } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      const card = containerRef.current?.querySelector<HTMLElement>('.status-card-body');
      if (!card || !animate) return;

      gsap.fromTo(
        card,
        { opacity: 0, y: 20, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration, delay, ease: M3_EASE.decelerate }
      );

      const enter = () =>
        gsap.to(card, { scale: 1.02, duration: M3_DURATION.short4, ease: M3_EASE.emphasized });
      const leave = () =>
        gsap.to(card, { scale: 1, duration: M3_DURATION.medium2, ease: M3_EASE.standard });

      card.addEventListener('mouseenter', enter);
      card.addEventListener('mouseleave', leave);
      return () => {
        card.removeEventListener('mouseenter', enter);
        card.removeEventListener('mouseleave', leave);
      };
    },
    { scope: containerRef, dependencies: [animate, duration, delay] }
  );

  return (
    <aside
      ref={containerRef}
      className={`fixed bottom-6 right-6 sm:bottom-10 sm:right-10 z-30 pointer-events-auto select-none ${className}`}
      aria-label="Satellite telemetry status"
    >
      <div
        className={`status-card-body m3-status-card rounded-full pl-2 pr-5 py-2 flex items-center gap-3.5 ${classNames.card ?? ''}`}
      >
        {/* Left Circular Satellite Icon Badge */}
        <div
          className={`w-9 h-9 rounded-full bg-m3-dock-inverse text-m3-primary flex items-center justify-center shrink-0 ${classNames.iconWrapper ?? ''}`}
        >
          <span className="material-symbols-outlined text-[19px]">{icon}</span>
        </div>

        {/* Center Text Information */}
        <div className="flex flex-col">
          <span
            className={`font-sans font-bold text-xs leading-snug tracking-tight text-m3-on-surface ${classNames.region ?? ''}`}
          >
            {region}
          </span>
          <span
            className={`font-sans text-[11px] leading-none text-m3-on-surface-variant ${classNames.subtitle ?? ''}`}
          >
            {subtitle}
          </span>
        </div>

        {/* Right Live Indicator */}
        <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-m3-outline-variant">
          <span className="w-2 h-2 rounded-full bg-safe animate-ping" />
          <span className="font-sans font-semibold text-xs text-safe">{statusText}</span>
        </div>
      </div>
    </aside>
  );
};
