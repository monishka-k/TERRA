'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { SectionHeader } from '@/components/common/SectionHeader';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import type { FloodDrivers } from '@/lib/api/types';
import { clamp01 } from '@/lib/map/colorScale';
import { formatDegrees, formatMetres, formatPercent, formatScore } from '@/lib/map/format';

import { DriverMetricRow } from './DriverMetricRow';

export interface DriverBreakdownProps {
  drivers: FloodDrivers;
  title?: string;
  /** HAND normalisation ceiling used for the inline bar (the pipeline's P99 clip). */
  handClipMetres?: number;
  className?: string;
  classNames?: {
    root?: string;
    header?: string;
    list?: string;
  };
  animation?: {
    disabled?: boolean;
    stagger?: number;
    duration?: number;
  };
}

/**
 * Physical drivers behind the score, in the order the pipeline combines them.
 *
 * `S_f = 0.5·F + 0.5·(1 − clip(HAND/P99))`, so inundation frequency and HAND are the two
 * terms that actually move the number; slope and cropland are context — slope only acts as
 * a hard-zero gate, and cropland is exposure rather than hazard.
 */
export const DriverBreakdown = ({
  drivers,
  title = 'Why this score',
  handClipMetres = 12,
  className = '',
  classNames = {},
  animation = {},
}: DriverBreakdownProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, stagger = 0.04, duration = 0.35 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!animate) return;
      gsap.from('[data-driver-row]', {
        y: 8,
        opacity: 0,
        duration,
        stagger,
        ease: 'power2.out',
      });
    },
    { scope: rootRef, dependencies: [drivers, animate, duration, stagger] },
  );

  const handFraction =
    drivers.mean_hand_m === null ? null : clamp01(1 - drivers.mean_hand_m / handClipMetres);

  return (
    <div
      ref={rootRef}
      className={['flex flex-col gap-2.5', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      <SectionHeader
        title={title}
        description="S_f = 0.5·F + 0.5·(1 − HAND/P99)"
        className={classNames.header}
      />

      <div className={['flex flex-col gap-2.5', classNames.list ?? ''].join(' ')}>
        <DriverMetricRow
          label="Inundation frequency (F)"
          value={formatScore(drivers.mean_inundation_frequency)}
          fraction={drivers.mean_inundation_frequency}
          variant="accent"
          hint="Share of Sentinel-1 scenes in which this cell read as water, after permanent water removal."
        />
        <DriverMetricRow
          label="Mean HAND"
          value={formatMetres(drivers.mean_hand_m)}
          fraction={handFraction}
          variant="accent"
          hint="Height Above Nearest Drainage. Lower means closer to the drainage network, hence more susceptible."
        />
        <DriverMetricRow
          label="Min HAND"
          value={formatMetres(drivers.min_hand_m)}
          hint="Lowest point in the cell relative to drainage."
        />
        <DriverMetricRow
          label="Mean slope"
          value={formatDegrees(drivers.mean_slope_deg)}
          hint="Above 15° the cell is hard-zeroed by FR-3.17."
          variant="muted"
        />
        <DriverMetricRow
          label="Cropland fraction"
          value={formatPercent(drivers.mean_cropland_fraction, 1)}
          fraction={drivers.mean_cropland_fraction}
          variant="muted"
          hint="ESA WorldCover class 40. Agricultural exposure, not hazard."
        />
        <DriverMetricRow
          label="Peak pixel score"
          value={formatScore(drivers.max_susceptibility)}
          fraction={drivers.max_susceptibility}
          hint="Highest single-pixel susceptibility inside the cell — a mean can hide a hot channel."
        />
        <DriverMetricRow
          label="Valid pixel coverage"
          value={formatPercent(drivers.valid_pixel_fraction, 1)}
          fraction={drivers.valid_pixel_fraction}
          variant="muted"
          hint="Share of the cell with valid raster data. Below 50% the cell is flagged low coverage."
        />
        <DriverMetricRow
          label="Hard-zero area"
          value={formatPercent(drivers.hard_zero_fraction, 1)}
          fraction={drivers.hard_zero_fraction}
          variant="muted"
          hint="Share excluded by HAND > 30 m or slope > 15°."
        />
      </div>
    </div>
  );
};
