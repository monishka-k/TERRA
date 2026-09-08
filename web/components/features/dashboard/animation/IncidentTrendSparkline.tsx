'use client';

import React from 'react';

export interface IncidentTrendSparklineProps {
  currentIncidents?: number;
  className?: string;
}

export const IncidentTrendSparkline: React.FC<IncidentTrendSparklineProps> = ({
  currentIncidents = 68,
  className = '',
}) => {
  // Sparkline normalized coordinates for a 30-day incident trajectory
  // (x: 0 to 120, y: 0 to 40, inverted where y=0 is 100 and y=40 is 0)
  const points = [
    { x: 5, y: 32 },
    { x: 18, y: 26 },
    { x: 30, y: 30 },
    { x: 42, y: 15 },
    { x: 55, y: 12 },
    { x: 68, y: 22 },
    { x: 80, y: 18 },
    { x: 92, y: 14 },
    { x: 105, y: 20 },
    { x: 115, y: 16 },
  ];

  const svgPath = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x},${pt.y}`, '');

  return (
    <div className={`space-y-1 select-none ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-bold tracking-widest text-gov-bg/60 dark:text-cream/60 uppercase">
          Incident Trend (30 Days)
        </span>
        <span className="text-[10px] font-mono font-bold text-gov-amber">
          {currentIncidents} Ev
        </span>
      </div>

      <div className="relative pt-1">
        {/* SVG Sparkline Graph */}
        <svg viewBox="0 0 120 40" className="w-full h-10 overflow-visible">
          {/* Subtle grid line */}
          <line x1="0" y1="20" x2="120" y2="20" stroke="currentColor" strokeDasharray="2 2" className="text-gov-bg/15 dark:text-cream/15" />
          
          {/* Filled Area Gradient */}
          <defs>
            <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d49a45" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#d49a45" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <path
            d={`${svgPath} L 115,38 L 5,38 Z`}
            fill="url(#trend-grad)"
          />

          {/* Main Trend Line */}
          <path
            d={svgPath}
            fill="none"
            stroke="#d49a45"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Latest Telemetry Live Node */}
          <circle cx="115" cy="16" r="3" fill="#d49a45" className="animate-pulse" />
          <circle cx="115" cy="16" r="5" fill="none" stroke="#d49a45" strokeWidth="0.8" opacity="0.6" />
        </svg>

        {/* X-Axis Labels */}
        <div className="flex items-center justify-between text-[8px] font-mono text-gov-bg/50 dark:text-cream/50 mt-0.5">
          <span>-30d</span>
          <span>-15d</span>
          <span className="text-gov-amber font-bold">NOW</span>
        </div>
      </div>
    </div>
  );
};

export default IncidentTrendSparkline;
