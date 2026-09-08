'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { HotspotData } from './types';

export interface HotspotTooltipProps {
  /** Active hotspot data to display */
  spot: HotspotData | null;
  /** Screen position { x, y } */
  position: { x: number; y: number } | null;
  /** Callback when "View Action Plan" button is clicked */
  onViewPlan: (spot: HotspotData) => void;
}

export const HotspotTooltip: React.FC<HotspotTooltipProps> = ({
  spot,
  position,
  onViewPlan,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isVisible = !!spot && !!position;

  useGSAP(() => {
    if (!tooltipRef.current) return;

    if (isVisible) {
      gsap.to(tooltipRef.current, {
        opacity: 1,
        scale: 1,
        duration: 0.25,
        ease: 'back.out(1.2)',
        overwrite: 'auto',
      });
    } else {
      gsap.to(tooltipRef.current, {
        opacity: 0,
        scale: 0.95,
        duration: 0.2,
        ease: 'power2.in',
        overwrite: 'auto',
      });
    }
  }, { scope: tooltipRef, dependencies: [isVisible] });

  if (!spot || !position) return null;

  return (
    <div
      ref={tooltipRef}
      style={{
        left: `${Math.min(position.x + 15, typeof window !== 'undefined' ? window.innerWidth - 240 : 800)}px`,
        top: `${Math.min(position.y + 15, typeof window !== 'undefined' ? window.innerHeight - 150 : 600)}px`,
        opacity: 0,
        transform: 'scale(0.95)',
      }}
      className="fixed z-30 pointer-events-auto"
    >
      <div className="glass-card p-3 rounded-xl border border-citron/40 shadow-2xl min-w-[200px]">
        <div className="flex items-center justify-between text-[11px] font-mono text-citron mb-1">
          <span>{spot.type}</span>
          <span className="text-text-muted font-mono">
            {spot.lat.toFixed(1)}°N, {spot.lon.toFixed(1)}°E
          </span>
        </div>
        <div className="font-display font-bold text-text-primary text-sm">{spot.name}</div>
        <div className="text-xs text-text-secondary mt-1">{spot.desc}</div>
        <button
          onClick={() => onViewPlan(spot)}
          className="mt-2.5 w-full py-1 text-[11px] font-semibold bg-citron/20 text-citron border border-citron/40 rounded-lg hover:bg-citron/30 transition-all flex items-center justify-center gap-1 cursor-pointer"
        >
          <span>View Action Plan</span>
          <span className="material-symbols-outlined text-xs">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};
