'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import type { AboutHeroProps } from './types';

export const AboutHero: React.FC<AboutHeroProps> = ({
  eyebrow = 'ABOUT SETU-DRR',
  headline = (
    <>
      Building safer decisions
      <br />
      for a changing world.
    </>
  ),
  description = 'We turn complex disaster data into clear, actionable decisions — helping communities prepare, adapt, and find safer places to call home.',
  className = '',
  classNames = {},
  animation = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const {
    disabled: animationDisabled = false,
    delay = 0.2,
    duration = 0.8,
  } = animation;
  const shouldAnimate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!shouldAnimate) return;

      const tl = gsap.timeline({ delay });

      tl.fromTo(
        '.about-hero-eyebrow',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }
      )
        .fromTo(
          '.about-hero-headline',
          { y: 28, opacity: 0 },
          { y: 0, opacity: 1, duration, ease: 'power3.out' },
          '-=0.4'
        )
        .fromTo(
          '.about-hero-description',
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' },
          '-=0.45'
        );
    },
    { scope: containerRef, dependencies: [shouldAnimate, delay, duration] }
  );

  return (
    <div
      ref={containerRef}
      className={`relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-10 sm:pb-14 select-none ${className} ${
        classNames.root ?? ''
      }`}
    >
      {/* Tracked Uppercase Eyebrow Pill */}
      <div
        className={`about-hero-eyebrow inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-1/70 dark:bg-forest-surface/70 border border-line/60 dark:border-white/10 backdrop-blur-md mb-6 shadow-sm ${
          classNames.eyebrow ?? ''
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
        <span className="text-[11px] font-mono tracking-[0.25em] text-text-secondary dark:text-emerald-400/90 font-medium">
          {eyebrow}
        </span>
      </div>

      {/* Primary Bold Editorial Headline */}
      <h1
        className={`about-hero-headline text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-extrabold tracking-tight text-ink dark:text-text-primary leading-[1.08] mb-6 drop-shadow-sm ${
          classNames.headline ?? ''
        }`}
      >
        {headline}
      </h1>

      {/* Clear Authoritative Supporting Description */}
      <p
        className={`about-hero-description max-w-2xl text-base sm:text-lg leading-relaxed text-text-secondary dark:text-neutral-300 font-normal ${
          classNames.description ?? ''
        }`}
      >
        {description}
      </p>
    </div>
  );
};
