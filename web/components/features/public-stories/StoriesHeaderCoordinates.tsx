'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export interface StoriesHeaderCoordinatesProps {
  /** Latitude display string */
  latitude: string;
  /** Longitude display string */
  longitude: string;
  /** Target link for Government Official portal (default '/gov') */
  govHref?: string;
  /** Target link for returning to landing overview (default '/') */
  overviewHref?: string;
  /** Optional callback to switch to Government Official Portal */
  onSwitchToGovPortal?: () => void;
  /** Optional callback to return to landing overview */
  onBackToOverview?: () => void;
  /** Custom root className */
  className?: string;
}

export const StoriesHeaderCoordinates: React.FC<StoriesHeaderCoordinatesProps> = ({
  latitude = 'N 28° 36\' 23.047"',
  longitude = 'E 77° 12\' 23.906"',
  govHref = '/gov',
  overviewHref = '/',
  onSwitchToGovPortal,
  onBackToOverview,
  className = '',
}) => {
  const coordRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!coordRef.current) return;
    gsap.fromTo(
      coordRef.current,
      { opacity: 0.4, scale: 0.98 },
      { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' }
    );
  }, { dependencies: [latitude, longitude] });

  return (
    <div
      className={`w-full flex items-center justify-between pointer-events-auto select-none ${className}`}
    >
      {/* Left Action Buttons: Overview, Switch to Gov, Theme Toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onBackToOverview ? (
          <button
            type="button"
            onClick={onBackToOverview}
            className="text-xs font-mono tracking-wider text-ink-muted hover:text-ink dark:text-cream/70 dark:hover:text-cream px-3 py-1.5 rounded-lg bg-surface-1/80 hover:bg-surface-2 dark:bg-black/20 dark:hover:bg-black/40 border border-line dark:border-cream/10 transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Overview</span>
          </button>
        ) : (
          <Link
            href={overviewHref}
            className="text-xs font-mono tracking-wider text-ink-muted hover:text-ink dark:text-cream/70 dark:hover:text-cream px-3 py-1.5 rounded-lg bg-surface-1/80 hover:bg-surface-2 dark:bg-black/20 dark:hover:bg-black/40 border border-line dark:border-cream/10 transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Overview</span>
          </Link>
        )}

        {onSwitchToGovPortal ? (
          <button
            type="button"
            onClick={onSwitchToGovPortal}
            className="text-xs font-mono tracking-wider text-m3-accent-foliage hover:opacity-80 px-3 py-1.5 rounded-lg bg-surface-1/90 hover:bg-surface-2 dark:bg-[#162522]/70 dark:hover:bg-[#162522] border border-line hover:border-citron dark:border-[#a3e635]/30 dark:hover:border-[#a3e635] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm backdrop-blur-md"
          >
            <span className="material-symbols-outlined text-sm">verified_user</span>
            <span>Official Hex Map</span>
          </button>
        ) : (
          <Link
            href={govHref}
            className="text-xs font-mono tracking-wider text-m3-accent-foliage hover:opacity-80 px-3 py-1.5 rounded-lg bg-surface-1/90 hover:bg-surface-2 dark:bg-[#162522]/70 dark:hover:bg-[#162522] border border-line hover:border-citron dark:border-[#a3e635]/30 dark:hover:border-[#a3e635] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm backdrop-blur-md"
          >
            <span className="material-symbols-outlined text-sm">verified_user</span>
            <span>Official Hex Map</span>
          </Link>
        )}

        <ThemeToggle variant="button" size="sm" showLabel={false} />
      </div>

      {/* Top Right Monospace Coordinates Readout */}
      <div
        ref={coordRef}
        className="text-right font-mono text-xs sm:text-sm tracking-wider text-cream/80 leading-snug"
      >
        <div>{latitude}</div>
        <div>{longitude}</div>
      </div>
    </div>
  );
};

export default StoriesHeaderCoordinates;
