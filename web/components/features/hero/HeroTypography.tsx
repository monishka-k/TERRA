'use client';

import React from 'react';

export interface HeroTypographyProps {
  /** First headline word */
  line1?: string;
  /** Second headline word */
  line2?: string;
  /** Third headline word */
  line3?: string;
  /** Tagline line 1 */
  tagline1?: string;
  /** Tagline line 2 (accent colored) */
  tagline2?: string;
  /** Description paragraph text */
  description?: string;
  /** Custom root className */
  className?: string;
}

export const HeroTypography: React.FC<HeroTypographyProps> = ({
  line1 = 'THE',
  line2 = 'DEAD',
  line3 = 'ZONE',
  tagline1 = 'Change the World',
  tagline2 = 'Live Safely!',
  description = 'National Disaster Red Zone Decision Support & Autonomous Resettlement Routing Engine.',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-start select-none ${className}`}>
      {/* Monumental Condensed Grotesque Headline */}
      <h1 className="hero-headline flex flex-col font-sans font-black text-6xl sm:text-8xl lg:text-[8rem] tracking-tight leading-[0.88] text-m3-on-surface mb-5 drop-shadow-xs">
        <span className="hero-word-line inline-block">{line1}</span>
        <span className="hero-word-line inline-block">{line2}</span>
        <span className="hero-word-line inline-block">{line3}</span>
      </h1>

      {/* Expressive Tagline */}
      <div className="hero-tagline mb-3">
        <h2 className="font-sans text-2xl sm:text-4xl lg:text-[2.65rem] font-extrabold tracking-tight leading-tight text-m3-on-surface">
          <span className="block">{tagline1}</span>
          <span className="block text-m3-accent-foliage">{tagline2}</span>
        </h2>
      </div>

      {/* Descriptive Mission Text */}
      <p className="hero-description text-sm sm:text-base text-m3-on-surface-variant font-sans max-w-md leading-relaxed mb-6">
        {description}
      </p>
    </div>
  );
};
