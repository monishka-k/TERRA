'use client';

import React from 'react';

export interface SarOverpassBadgeProps {
  overpassId?: string;
  region?: string;
  isLive?: boolean;
  className?: string;
}

export const SarOverpassBadge: React.FC<SarOverpassBadgeProps> = ({
  overpassId = 'WAYANAD_S1A_RTC_2024',
  region = 'INDIA',
  isLive = true,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center space-x-3 px-3 py-1.5 rounded-lg bg-gov-surface-light/90 dark:bg-gov-surface/90 border border-gov-bg/15 dark:border-gov-bg-light/15 text-xs font-mono select-none ${className}`}
    >
      <div>
        <div className="text-[10px] font-bold tracking-widest text-gov-bg/70 dark:text-cream/70 uppercase">
          Satellite SAR Overpass
        </div>
        <div className="text-[11px] font-semibold text-gov-bg dark:text-cream tracking-tight">
          {region} <span className="text-gov-bg/40 dark:text-cream/40">|</span> {overpassId}
        </div>
      </div>

      {isLive && (
        <div className="flex items-center space-x-1.5 pl-2.5 border-l border-gov-bg/15 dark:border-gov-bg-light/15 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-emerald opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-emerald" />
          </span>
          <span className="text-[10px] font-bold text-accent-emerald tracking-widest uppercase">
            Live
          </span>
        </div>
      )}
    </div>
  );
};

export default SarOverpassBadge;
