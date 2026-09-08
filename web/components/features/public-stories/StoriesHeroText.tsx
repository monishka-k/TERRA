'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface StoriesHeroTextProps {
  /** Optional custom category pill / super-title */
  category?: string;
  /** Active zone label e.g. North, South */
  activeZoneLabel?: string;
  /** Dynamic short summary of the active region */
  summary?: string;
  /** Custom root className */
  className?: string;
  /** Granular style overrides */
  classNames?: {
    root?: string;
    category?: string;
    title?: string;
    description?: string;
  };
}

export const StoriesHeroText: React.FC<StoriesHeroTextProps> = ({
  category = 'VEOLA STORIES',
  activeZoneLabel = 'North',
  summary = 'Frontline climate hazard red zones, lived community experiences, and environmental intelligence across India\'s fragile terrains.',
  className = '',
  classNames = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;
    gsap.fromTo(
      containerRef.current.children,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: 'power3.out' }
    );
  }, { scope: containerRef });

  useGSAP(() => {
    if (!textRef.current) return;
    gsap.fromTo(
      textRef.current,
      { opacity: 0.3, y: 6 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );
  }, { dependencies: [activeZoneLabel, summary] });

  return (
    <div
      ref={containerRef}
      className={`max-w-md select-none pointer-events-auto ${classNames.root || ''} ${className}`}
    >
      {/* Category Monospace Subtitle */}
      <div
        className={`text-[11px] font-mono tracking-[0.25em] text-cream/60 uppercase mb-4 ${
          classNames.category || ''
        }`}
      >
        {category}
      </div>

      {/* Main Display Headline with Lime Accent */}
      <h1
        className={`font-sans text-4xl sm:text-5xl lg:text-6xl font-normal text-cream tracking-tight leading-[1.1] mb-6 ${
          classNames.title || ''
        }`}
      >
        Discover{' '}
        <span className="text-m3-accent-foliage font-medium transition-colors duration-300">
          stories
        </span>
        <br />
        across India
      </h1>

      {/* Region Context Paragraph */}
      <p
        ref={textRef}
        className={`text-sm sm:text-base text-cream/70 leading-relaxed font-sans font-light tracking-wide ${
          classNames.description || ''
        }`}
      >
        {summary}
      </p>
    </div>
  );
};

export default StoriesHeroText;
