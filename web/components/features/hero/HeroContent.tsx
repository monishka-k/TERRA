'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, M3_DURATION, M3_EASE, type M3AnimationConfig } from '@/lib/motion/m3';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { INTRO_TIMINGS } from '@/lib/motion/introSequence';
import { ObservationBadge } from './ObservationBadge';
import { HeroTypography } from './HeroTypography';
import { CommandPortalCta } from './CommandPortalCta';

export interface HeroContentProps {
  /** Target link for the command portal (default '/login') */
  portalHref?: string;
  /** Callback to reveal the login / command portal */
  onEnterPortal?: () => void;
  /** Custom root className */
  className?: string;
  /**
   * Entrance overrides. `delay` shifts the whole sequence; the internal beats
   * keep their relative spacing from INTRO_TIMINGS.
   */
  animation?: M3AnimationConfig;
}

export const HeroContent: React.FC<HeroContentProps> = ({
  portalHref = '/login',
  onEnterPortal,
  className = '',
  animation = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, delay = INTRO_TIMINGS.heroBadge } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!containerRef.current) return;

      // Reduced motion still needs the final state applied, because every beat
      // below animates *from* opacity 0.
      if (!animate) {
        gsap.set(
          ['.hero-badge-wrap', '.hero-word-line', '.hero-tagline', '.hero-description', '.hero-cta-wrap'],
          { clearProps: 'all' }
        );
        return;
      }

      const tl = gsap.timeline({ delay, defaults: { ease: M3_EASE.emphasized } });

      tl.fromTo(
        '.hero-badge-wrap',
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: M3_DURATION.extraLong2, ease: M3_EASE.decelerate }
      )
        .fromTo(
          '.hero-word-line',
          { y: 45, opacity: 0 },
          { y: 0, opacity: 1, duration: M3_DURATION.extraLong2, stagger: 0.12 },
          '-=0.35'
        )
        .fromTo(
          '.hero-tagline',
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: M3_DURATION.long2 },
          '-=0.3'
        )
        .fromTo(
          '.hero-description',
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: M3_DURATION.long2 },
          '-=0.3'
        )
        .fromTo(
          '.hero-cta-wrap',
          { y: 25, opacity: 0, scale: 0.94 },
          { y: 0, opacity: 1, scale: 1, duration: M3_DURATION.extraLong2, ease: M3_EASE.decelerate },
          '-=0.2'
        );
    },
    { scope: containerRef, dependencies: [animate, delay] }
  );

  return (
    <div
      ref={containerRef}
      className={`relative z-10 w-full h-full flex flex-col justify-between pt-24 pb-8 sm:pb-12 px-6 sm:px-12 lg:px-20 pointer-events-none ${className}`}
    >
      {/* Upper Content Column */}
      <div className="max-w-xl flex flex-col items-start pt-4 sm:pt-8">
        {/* Status observation badge */}
        <div className="hero-badge-wrap mb-4 sm:mb-6 pointer-events-auto">
          <ObservationBadge />
        </div>

        {/* Monumental Typography & Mission Description */}
        <HeroTypography />

        {/* Primary Command Portal CTA Button */}
        <div className="hero-cta-wrap pointer-events-auto">
          <CommandPortalCta href={portalHref} onClick={onEnterPortal} />
        </div>
      </div>
    </div>
  );
};
