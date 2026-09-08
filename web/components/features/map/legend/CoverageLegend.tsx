'use client';

import { SectionHeader } from '@/components/common/SectionHeader';
import type { HazardLayerCoverage } from '@/lib/api/types';
import { HARD_ZERO_COLOR, NO_COVERAGE_OUTLINE_COLOR } from '@/lib/map/constants';

import { LegendSwatch } from './LegendSwatch';

export interface CoverageLegendProps {
  coverage: HazardLayerCoverage;
  title?: string;
  className?: string;
  classNames?: {
    root?: string;
    header?: string;
    list?: string;
  };
}

/**
 * Legend for the two non-ramp classes.
 *
 * Both carry susceptibility 0.00 and they mean opposite things, so they are named
 * explicitly rather than folded into the bottom of the colour ramp.
 */
export const CoverageLegend = ({
  coverage,
  title = 'Zero-score cells',
  className = '',
  classNames = {},
}: CoverageLegendProps) => (
  <div className={['flex flex-col gap-2', classNames.root ?? '', className].filter(Boolean).join(' ')}>
    <SectionHeader
      title={title}
      description="A 0.00 score means two different things. The map keeps them apart."
      className={classNames.header}
    />
    <div className={['flex flex-col gap-1', classNames.list ?? ''].join(' ')}>
      <LegendSwatch
        color={HARD_ZERO_COLOR}
        label="Safe by terrain"
        meta="FR-3.17"
        title="Excluded by the hard-zero rule: HAND above 30 m or slope above 15°. Measured and genuinely not floodable."
      />
      <LegendSwatch
        color={NO_COVERAGE_OUTLINE_COLOR}
        shape="outline"
        label="No data"
        meta={coverage.no_coverage.toLocaleString()}
        title="No valid raster pixels. The 0.00 score is a fill from apply_quality_flags(), not a measurement."
      />
    </div>
  </div>
);
