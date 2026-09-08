'use client';

import React from 'react';
import { TOP_LEVEL_METRICS } from './demoData';

export interface TelemetryMetricItem {
  id: string;
  label: string;
  value: string;
  unit?: string;
  change?: string;
  variant?: 'crimson' | 'ochre' | 'terracotta' | 'moss' | 'default';
  hint?: string;
}

export interface GovTelemetryMetricsProps {
  metrics?: TelemetryMetricItem[];
  className?: string;
  onMetricClick?: (metricId: string) => void;
}

const DEFAULT_METRICS: TelemetryMetricItem[] = [
  {
    id: 'active_alerts',
    label: 'ACTIVE ALERTS',
    value: TOP_LEVEL_METRICS.activeAlerts.toString().padStart(2, '0'),
    variant: 'crimson',
    hint: '5 Critical, 13 High'
  },
  {
    id: 'priority_habitations',
    label: 'PRIORITY HABITATIONS',
    value: TOP_LEVEL_METRICS.priorityHabitations.toString().padStart(2, '0'),
    variant: 'terracotta',
    hint: 'Immediate review required'
  },
  {
    id: 'population_exposed',
    label: 'POPULATION EXPOSED',
    value: TOP_LEVEL_METRICS.populationExposed,
    variant: 'ochre',
    hint: 'Across 11 active AOI sectors'
  },
  {
    id: 'relocation_reviews',
    label: 'RELOCATION REVIEWS',
    value: TOP_LEVEL_METRICS.relocationReviews.toString().padStart(2, '0'),
    variant: 'moss',
    hint: '3 under active review'
  }
];

export const GovTelemetryMetrics: React.FC<GovTelemetryMetricsProps> = ({
  metrics = DEFAULT_METRICS,
  className = '',
  onMetricClick
}) => {
  return (
    <div
      className={`grid grid-cols-2 md:grid-cols-4 gap-2.5 px-4 py-2.5 bg-gov-bg-light/90 dark:bg-gov-bg/90 backdrop-blur-md border-b border-gov-bg/10 dark:border-gov-bg-light/10 transition-colors duration-200 z-10 ${className}`}
    >
      {metrics.map((m) => {
        const valueColor =
          m.variant === 'crimson'
            ? 'text-gov-red'
            : m.variant === 'terracotta'
            ? 'text-gov-orange'
            : m.variant === 'ochre'
            ? 'text-gov-amber'
            : m.variant === 'moss'
            ? 'text-gov-green'
            : 'text-gov-bg dark:text-cream';

        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onMetricClick?.(m.id)}
            className="flex flex-col text-left px-3 py-1.5 rounded-md bg-gov-surface-light/60 dark:bg-gov-surface/60 border border-gov-bg/8 dark:border-gov-bg-light/8 hover:border-gov-bg/20 dark:hover:border-gov-bg-light/20 hover:bg-gov-surface-light/90 dark:hover:bg-gov-surface-hover/80 transition-all duration-150 group cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-semibold tracking-wider text-gov-bg/60 dark:text-cream/60 uppercase">
                {m.label}
              </span>
              {m.variant === 'crimson' && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gov-red opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gov-red"></span>
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span
                className={`text-xl font-bold tracking-tight font-serif ${valueColor}`}
                style={{ fontFamily: 'Fraunces, Georgia, serif' }}
              >
                {m.value}
              </span>
              {m.unit && (
                <span className="text-[11px] text-gov-bg/50 dark:text-cream/50 font-mono">
                  {m.unit}
                </span>
              )}
              {m.hint && (
                <span className="text-[10px] text-gov-bg/40 dark:text-cream/40 font-mono truncate ml-auto hidden lg:inline-block">
                  {m.hint}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default GovTelemetryMetrics;
