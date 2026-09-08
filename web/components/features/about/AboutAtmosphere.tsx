'use client';

import React from 'react';
import Image from 'next/image';
import { useTheme } from '@/components/providers';
import { AtmosphericMist } from '@/components/features/mist';
import type { AboutAtmosphereProps } from './types';

export const AboutAtmosphere: React.FC<AboutAtmosphereProps> = ({
  backdropUrl = '/images/about/about-backdrop.jpg',
  backdropOpacity = 0.85,
  enableMist = true,
  className = '',
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-0 pointer-events-none select-none overflow-hidden bg-bg-base transition-colors duration-500 ${className}`}
    >
      {/* Background Mountain Backdrop Image */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isDark ? 'opacity-25 mix-blend-luminosity' : 'opacity-85'
        }`}
        style={{ opacity: isDark ? 0.3 : backdropOpacity }}
      >
        <Image
          src={backdropUrl}
          alt="Himalayan mountainous terrain and atmospheric mist"
          fill
          priority
          sizes="100vw"
          className="object-cover object-right-top md:object-center"
        />
      </div>

      {/* Subtle Central Contrast Radial Vignette (Keeps Headline & Cards Pristine) */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          isDark
            ? 'bg-radial from-[#0b1c15]/60 via-[#0b1c15]/85 to-[#0b1c15]'
            : 'bg-radial from-white/70 via-[#edf3ef]/60 to-transparent'
        }`}
      />

      {/* Top & Bottom Bleed Gradients */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-bg-base via-bg-base/80 to-transparent" />
      <div className="absolute bottom-0 inset-x-0 h-56 bg-gradient-to-t from-bg-base via-bg-base/90 to-transparent" />

      {/* Atmospheric Mist Fog (Only active in Light Mode to preserve Daylight Sage aesthetic) */}
      {enableMist && !isDark && (
        <AtmosphericMist
          baseOpacity={0.42}
          imageUrl="/atmospheric-mist-transparent.png"
          className="pointer-events-none"
        />
      )}
    </div>
  );
};
