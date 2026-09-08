'use client';

import React, { useState } from 'react';
import { HazardTypeLegend } from './HazardTypeLegend';
import { IncidentTrendSparkline } from './IncidentTrendSparkline';
import { BackscatterGauge } from './BackscatterGauge';

export interface TelemetrySidebarProps {
  currentBackscatterDb?: number;
  currentIncidents?: number;
  onSelectHazard?: (hazardId: string) => void;
  className?: string;
}

export const TelemetrySidebar: React.FC<TelemetrySidebarProps> = ({
  currentBackscatterDb = -6.4,
  currentIncidents = 68,
  onSelectHazard,
  className = '',
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`p-3 rounded-xl bg-gov-surface-light/90 dark:bg-gov-surface/90 backdrop-blur-md border border-gov-bg/15 dark:border-gov-bg-light/15 shadow-xl transition-all duration-200 select-none ${
        isCollapsed ? 'w-10 overflow-hidden' : 'w-56 sm:w-64'
      } ${className}`}
    >
      {/* Header toggle */}
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-gov-bg/10 dark:border-gov-bg-light/10">
        {!isCollapsed && (
          <div className="flex items-center space-x-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-gov-bg/70 dark:text-cream/70">
            <span className="w-1.5 h-1.5 rounded-full bg-gov-amber" />
            <span>Telemetry Ingestion</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-gov-bg/50 dark:text-cream/50 hover:text-gov-bg dark:hover:text-cream transition-colors cursor-pointer ml-auto"
          title={isCollapsed ? 'Expand Telemetry Panel' : 'Collapse Telemetry Panel'}
        >
          <span className="material-symbols-outlined text-sm">
            {isCollapsed ? 'chevron_left' : 'chevron_right'}
          </span>
        </button>
      </div>

      {!isCollapsed && (
        <div className="space-y-4">
          {/* 1. Hazard Types Breakdown */}
          <HazardTypeLegend onSelectHazard={onSelectHazard} />

          <div className="border-t border-gov-bg/10 dark:border-gov-bg-light/10" />

          {/* 2. 30-Day Incident Sparkline */}
          <IncidentTrendSparkline currentIncidents={currentIncidents} />

          <div className="border-t border-gov-bg/10 dark:border-gov-bg-light/10" />

          {/* 3. SAR Backscatter Intensity Meter */}
          <BackscatterGauge currentDb={currentBackscatterDb} />
        </div>
      )}
    </aside>
  );
};

export default TelemetrySidebar;
