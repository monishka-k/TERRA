'use client';

import React from 'react';

export interface GovRiskLegendProps {
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const GovRiskLegend: React.FC<GovRiskLegendProps> = ({
  className = '',
  isCollapsed = false,
  onToggleCollapse
}) => {
  return (
    <div
      className={`bg-gov-bg-light/95 dark:bg-gov-bg/95 backdrop-blur-md rounded-lg border border-gov-bg/15 dark:border-gov-bg-light/15 shadow-md p-2.5 text-xs select-none transition-all duration-200 z-10 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-[10px] font-bold tracking-wider text-gov-bg/70 dark:text-cream/70 uppercase">
          Risk Status
        </span>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="text-[10px] text-gov-bg/40 dark:text-cream/40 hover:text-gov-bg dark:hover:text-cream"
          >
            {isCollapsed ? '+' : '–'}
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="flex flex-col gap-1.5">
          {/* PERMANENT RED ZONE */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-gov-red shadow-xs shrink-0 flex items-center justify-center">
              <span className="w-1 h-1 bg-white/60 rounded-full"></span>
            </span>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-gov-bg dark:text-cream">
                Permanent Red Zone
              </span>
              <span className="text-[9px] text-gov-bg/50 dark:text-cream/50 font-mono">
                Long-term unsuitable
              </span>
            </div>
          </div>

          {/* ACTIVE ALERT */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-gov-orange shadow-xs shrink-0 relative">
              <span className="animate-ping absolute inset-0 rounded-xs bg-gov-orange opacity-60"></span>
            </span>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-gov-bg dark:text-cream">
                Active Alert
              </span>
              <span className="text-[9px] text-gov-bg/50 dark:text-cream/50 font-mono">
                Currently unsafe (evacuate)
              </span>
            </div>
          </div>

          {/* FORECAST ALERT */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-gov-amber shadow-xs shrink-0"></span>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-gov-bg dark:text-cream">
                Forecast Alert
              </span>
              <span className="text-[9px] text-gov-bg/50 dark:text-cream/50 font-mono">
                Risk breach within 72h
              </span>
            </div>
          </div>

          {/* MONITORED / LOW RISK */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-gov-sage/60 border border-gov-sage shrink-0"></span>
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-gov-bg/80 dark:text-cream/80">
                Monitored / Low Risk
              </span>
              <span className="text-[9px] text-gov-bg/50 dark:text-cream/50 font-mono">
                Normal telemetry
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GovRiskLegend;
