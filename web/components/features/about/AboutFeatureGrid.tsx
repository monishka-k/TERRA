'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { AboutFeatureCard } from './AboutFeatureCard';
import type { AboutFeatureGridProps, AboutFeatureCardData } from './types';

export const CANONICAL_ABOUT_CARDS: AboutFeatureCardData[] = [
  {
    index: '01',
    category: 'OUR MISSION',
    title: 'From data to preparedness.',
    description:
      'We harness Earth observation, AI, and geospatial intelligence to anticipate risk, support faster decisions, and reduce disaster impact.',
    imageSrc: '/images/about/mission.png',
    imageAlt: 'Geospatial satellite terrain monitoring with target coordinates',
    actionLabel: 'A SAFER TOMORROW',
    actionHref: '/stories',
  },
  {
    index: '02',
    category: 'OUR INTELLIGENCE',
    title: 'Clarity when it matters most.',
    description:
      'We transform real-time and historical data into mapped insights, risk assessments, and resettlement guidance — so decision-makers can act with confidence.',
    imageSrc: '/images/about/intelligence.png',
    imageAlt: 'Himalayan valley risk analysis showing hazard zones and priority polygons',
    actionLabel: 'SEE HOW IT WORKS',
    actionHref: '/workspace',
  },
  {
    index: '03',
    category: 'HUMAN IMPACT',
    title: 'People at the center.',
    description:
      'Our work supports governments, communities, and vulnerable populations with tools for safer, more resilient futures.',
    imageSrc: '/images/about/human-impact.png',
    imageAlt: 'Vulnerable mountain community amidst mist and protective terrain',
    actionLabel: 'REAL STORIES',
    actionHref: '/stories',
  },
];

export const AboutFeatureGrid: React.FC<AboutFeatureGridProps> = ({
  cards = CANONICAL_ABOUT_CARDS,
  onCardAction,
  className = '',
  animation = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const {
    disabled: animationDisabled = false,
    delay = 0.45,
    stagger = 0.12,
  } = animation;
  const shouldAnimate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!shouldAnimate) return;

      gsap.fromTo(
        '.about-feature-card',
        { y: 36, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.75,
          stagger,
          ease: 'power2.out',
          delay,
        }
      );
    },
    { scope: containerRef, dependencies: [shouldAnimate, delay, stagger] }
  );

  return (
    <section
      ref={containerRef}
      aria-label="Core Pillars of SETU-DRR"
      className={`relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28 ${className}`}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
        {cards.map((card) => (
          <AboutFeatureCard
            key={card.index}
            data={card}
            onActionClick={onCardAction}
          />
        ))}
      </div>
    </section>
  );
};
