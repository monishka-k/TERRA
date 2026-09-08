'use client';

import React from 'react';

export interface BackscatterGaugeProps {
  currentDb?: number; // range -25.0 to 5.0 dB
  className?: string;
}

export const BackscatterGauge: React.FC<BackscatterGaugeProps> = ({
  currentDb = -4.2,
  className = '',
}) => {
  // Map currentDb from [-25, 5] to [0, 100]%
  const clampedDb = Math.min(Math.max(currentDb, -25.0), 5.0);
  const positionPercent = ((clampedDb - (-25.0)) / (5.0 - (-25.0))) * 100;

  return (
    <div className={`space-y-1.5 select-none ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-bold tracking-widest text-gov-bg/60 dark:text-cream/60 uppercase">
          Backscatter Intensity (dB)
        </span>
        <span className="text-[10px] font-mono font-bold text-gov-bg dark:text-cream">
          {clampedDb.toFixed(1)} dB
        </span>
      </div>

      {/* Horizontal SAR Intensity Gradient Bar */}
      <div className="relative h-2 w-full rounded-sm overflow-hidden bg-gov-bg/15 dark:bg-gov-bg-light/15">
        <div
          className="h-full w-full"
          style={{
            background: 'linear-gradient(to right, #10b981 0%, #d49a45 50%, #b9433f 100%)',
          }}
        />
        {/* Dynamic Needle Marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_4px_rgba(255,255,255,0.9)] -translate-x-1/2 transition-all duration-300"
          style={{ left: `${positionPercent}%` }}
        />
      </div>

      {/* Tiers & Min/Max Indicators */}
      <div className="flex items-center justify-between text-[8px] font-mono text-gov-bg/60 dark:text-cream/60">
        <span>LOW</span>
        <span>MEDIUM</span>
        <span>HIGH</span>
      </div>
      <div className="flex items-center justify-between text-[8px] font-mono text-gov-bg/40 dark:text-cream/40">
        <span>-25.0 dB</span>
        <span>5.0 dB</span>
      </div>
    </div>
  );
};

export default BackscatterGauge;
