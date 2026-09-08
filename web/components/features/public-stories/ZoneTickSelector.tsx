'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ZoneId } from './storyData';

export interface ZoneTickSelectorProps {
  /** Currently selected zone */
  selectedZone: ZoneId;
  /** Callback when zone changes */
  onSelectZone: (zone: ZoneId) => void;
  /** Custom root className */
  className?: string;
}

const ZONES: ZoneId[] = ['North', 'West', 'Central', 'East', 'South'];

export const ZoneTickSelector: React.FC<ZoneTickSelectorProps> = ({
  selectedZone,
  onSelectZone,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTickRef = useRef<HTMLDivElement>(null);

  const selectedIndex = ZONES.indexOf(selectedZone);

  useGSAP(() => {
    if (!activeTickRef.current) return;
    const targetY = selectedIndex * 42 + 4;
    gsap.to(activeTickRef.current, {
      y: targetY,
      duration: 0.35,
      ease: 'power3.out',
    });
  }, { dependencies: [selectedIndex] });

  return (
    <div
      ref={containerRef}
      className={`select-none pointer-events-auto flex flex-col items-end ${className}`}
    >
      {/* Title */}
      <span className="text-[10px] sm:text-xs font-mono tracking-[0.2em] text-cream/50 uppercase mb-4">
        CHOOSE ZONE
      </span>

      {/* Zones list with ruler */}
      <div className="relative flex items-center gap-3">
        {/* Zone Names */}
        <div className="flex flex-col gap-3.5 text-right">
          {ZONES.map((zone) => {
            const isSelected = zone === selectedZone;
            return (
              <button
                key={zone}
                type="button"
                onClick={() => onSelectZone(zone)}
                onMouseEnter={() => onSelectZone(zone)}
                className={`text-sm sm:text-base font-sans tracking-wide transition-all duration-200 cursor-pointer h-7 flex items-center justify-end px-2 rounded-md ${
                  isSelected
                    ? 'text-cream font-medium scale-105'
                    : 'text-cream/50 hover:text-cream/80 hover:translate-x-[-2px]'
                }`}
              >
                {zone}
              </button>
            );
          })}
        </div>

        {/* Vertical Tick-Mark Ruler */}
        <div className="relative h-[210px] w-4 flex flex-col justify-between py-1">
          {/* Subtle vertical spine line */}
          <div className="absolute top-1 bottom-1 right-[2px] w-[1px] bg-cream/15" />

          {/* Individual ruler ticks */}
          {Array.from({ length: 26 }).map((_, i) => (
            <div
              key={i}
              className={`h-[1px] ml-auto ${
                i % 5 === 0 ? 'w-3 bg-cream/35' : 'w-1.5 bg-cream/15'
              }`}
            />
          ))}

          {/* Active Highlight Notch */}
          <div
            ref={activeTickRef}
            className="absolute top-0 right-0 w-3.5 h-[2px] bg-[#a3e635] shadow-[0_0_8px_#a3e635] transition-transform"
          />
        </div>
      </div>
    </div>
  );
};

export default ZoneTickSelector;
