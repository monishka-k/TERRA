'use client';

import React from 'react';

export interface ObservationBadgeProps {
  /** Primary label text */
  label?: string;
  /** Secondary subtitle / mode */
  sublabel?: string;
  /** Status dot colour. Any CSS colour; defaults to the theme's safe token. */
  statusColor?: string;
  /** Custom root className */
  className?: string;
}

export const ObservationBadge: React.FC<ObservationBadgeProps> = ({
  label = 'PLANETARY OBSERVATION',
  sublabel = 'REAL-TIME SAR MESH',
  statusColor = 'var(--safe)',
  className = '',
}) => {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-m3-surface-container-lowest/70 backdrop-blur-md border border-m3-outline-variant text-[11px] font-sans font-semibold tracking-wider text-m3-on-surface-variant shadow-m3-1 select-none ${className}`}
    >
      <span
        className="w-2 h-2 rounded-full animate-pulse shrink-0"
        style={{ backgroundColor: statusColor }}
      />
      <span className="uppercase">
        {label} <span className="text-m3-outline font-normal">·</span> {sublabel}
      </span>
    </div>
  );
};
