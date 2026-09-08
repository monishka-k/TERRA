'use client';

import React from 'react';
import { StatusPill } from '@/components/common/status-pill';

export interface StreamPillProps {
  /** Label */
  label?: string;
  /** Custom root className */
  className?: string;
}

export const StreamPill: React.FC<StreamPillProps> = ({
  label = 'Sentinel-1 Telemetry Stream',
  className = '',
}) => {
  return (
    <div className={`fixed top-20 left-4 sm:left-20 z-20 pointer-events-auto ${className}`}>
      <StatusPill label={label} prefix="✦ ::" live variant="emerald" />
    </div>
  );
};
