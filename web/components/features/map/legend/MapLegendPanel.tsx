'use client';

import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { Button } from '@/components/ui/Button';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import type { HazardLayerCoverage, HazardLayerLegend } from '@/lib/api/types';

import { ConfidenceHatchKey } from './ConfidenceHatchKey';
import { CoverageLegend } from './CoverageLegend';
import { QuantileLegend } from './QuantileLegend';

export interface MapLegendPanelProps {
  legend: HazardLayerLegend;
  coverage: HazardLayerCoverage;
  /** Cells currently drawn with the confidence hatch. */
  hatchedCount?: number;
  confidenceThreshold: number;
  title?: string;
  defaultCollapsed?: boolean;
  className?: string;
  classNames?: {
    root?: string;
    body?: string;
  };
  animation?: {
    disabled?: boolean;
    duration?: number;
  };
}

/** Legend stack docked over the map: ramp classes, zero-score classes, confidence key. */
export const MapLegendPanel = ({
  legend,
  coverage,
  hatchedCount,
  confidenceThreshold,
  title = 'Legend',
  defaultCollapsed = false,
  className = '',
  classNames = {},
  animation = {},
}: MapLegendPanelProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, duration = 0.35 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      const node = bodyRef.current;
      if (!node) return;
      if (!animate) {
        gsap.set(node, { height: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1 });
        return;
      }
      gsap.to(node, {
        height: collapsed ? 0 : 'auto',
        opacity: collapsed ? 0 : 1,
        duration,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    },
    { scope: rootRef, dependencies: [collapsed, animate, duration] },
  );

  return (
    <div
      ref={rootRef}
      className={[
        'pointer-events-auto absolute bottom-8 left-3 z-10 w-60 rounded-lg border border-line bg-panel/92 p-3 shadow-lg backdrop-blur-md',
        classNames.root ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          {title}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="!h-5 !px-1.5"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
        >
          {collapsed ? 'Show' : 'Hide'}
        </Button>
      </div>

      <div ref={bodyRef} className={['overflow-hidden', classNames.body ?? ''].join(' ')}>
        <div className="flex flex-col gap-3.5 pt-3">
          <QuantileLegend
            breaks={legend.breaks}
            domain={legend.domain as number[]}
            quantiles={legend.quantiles}
            description="Classed on quantiles — the scores cluster too tightly for an even ramp."
          />
          <CoverageLegend coverage={coverage} />
          <ConfidenceHatchKey
            confidenceCeiling={legend.confidence_ceiling}
            threshold={confidenceThreshold}
            hatchedCount={hatchedCount}
          />
        </div>
      </div>
    </div>
  );
};
