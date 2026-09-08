'use client';

import React from 'react';
import type { AboutMetadataMarkingsProps } from './types';

export const AboutMetadataMarkings: React.FC<AboutMetadataMarkingsProps> = ({
  latitude = '34.0522° N',
  longitude = '118.2437° W',
  editorialPillars = ['PEOPLE', 'PLACES', 'POSSIBILITIES'],
  className = '',
}) => {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none select-none z-[2] overflow-hidden ${className}`}
    >
      {/* Background Topographic Contour Lines SVG */}
      <svg
        className="absolute inset-0 w-full h-full text-text-muted/20 dark:text-white/10 opacity-40 dark:opacity-20"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        <path
          d="M-100,180 C150,140 280,260 500,200 C720,140 900,220 1200,160 C1500,100 1800,240 2100,180"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 6"
        />
        <path
          d="M-80,260 C200,220 350,340 600,280 C850,220 1050,310 1350,250 C1650,190 1900,320 2200,260"
          stroke="currentColor"
          strokeWidth="0.8"
        />
        <path
          d="M-50,380 C180,310 400,440 700,360 C1000,280 1200,400 1500,330 C1800,260 2050,390 2300,320"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeDasharray="2 8"
        />
        <path
          d="M-120,520 C220,440 460,580 800,490 C1140,400 1380,530 1700,450 C2020,370 2200,500 2400,430"
          stroke="currentColor"
          strokeWidth="0.7"
        />
      </svg>

      {/* Left Geospatial Crosshair and Coordinate Markings */}
      <div className="absolute left-6 sm:left-10 lg:left-14 top-48 sm:top-56 hidden md:flex flex-col items-start gap-3">
        {/* Subtle Crosshair Reticle */}
        <div className="relative w-8 h-8 flex items-center justify-center text-text-muted/60 dark:text-white/30">
          <div className="absolute w-full h-[1px] bg-current" />
          <div className="absolute h-full w-[1px] bg-current" />
          <div className="w-3 h-3 rounded-full border border-current opacity-70" />
        </div>

        {/* Formatted Coordinates */}
        <div className="font-mono text-[10.5px] tracking-[0.2em] text-text-muted/80 dark:text-neutral-400 font-medium flex flex-col gap-0.5">
          <span>{latitude}</span>
          <span>{longitude}</span>
        </div>
      </div>

      {/* Right Spaced Metadata Column */}
      <div className="absolute right-6 sm:right-10 lg:right-14 top-52 sm:top-60 hidden md:flex flex-col items-end gap-2.5">
        <div className="font-mono text-[10.5px] tracking-[0.28em] text-text-muted/80 dark:text-neutral-400 font-medium flex flex-col items-end gap-1">
          {editorialPillars.map((pillar) => (
            <span key={pillar}>{pillar}</span>
          ))}
        </div>

        {/* Fine Underline with Tick Mark */}
        <div className="relative w-20 h-[1px] bg-text-muted/40 dark:bg-white/20 mt-1">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-emerald-500/80" />
        </div>
      </div>
    </div>
  );
};
