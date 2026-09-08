'use client';

import { SectionHeader } from '@/components/common/SectionHeader';
import { LOW_CONFIDENCE_HATCH_COLOR } from '@/lib/map/constants';
import { formatScore } from '@/lib/map/format';

import { LegendSwatch } from './LegendSwatch';

export interface ConfidenceHatchKeyProps {
  /** Raw confidence maximum for the layer (the normalisation divisor). */
  confidenceCeiling: number;
  /** Cut applied to normalised confidence. */
  threshold: number;
  /** Number of cells currently hatched. */
  hatchedCount?: number;
  observationCeiling?: number;
  className?: string;
  classNames?: {
    root?: string;
    header?: string;
    note?: string;
  };
}

/**
 * Explains the confidence hatch and, critically, the normalisation behind it.
 *
 * The raw ceiling is surfaced because it is the surprising number: the Barpeta flood layer
 * peaks at 0.167, so a reader who assumes confidence is already on [0,1] would conclude the
 * whole layer is untrustworthy when in fact every cell is equally well observed.
 */
export const ConfidenceHatchKey = ({
  confidenceCeiling,
  threshold,
  hatchedCount,
  observationCeiling = 30,
  className = '',
  classNames = {},
}: ConfidenceHatchKeyProps) => {
  const impliedScenes = Math.round(confidenceCeiling * observationCeiling);

  return (
    <div className={['flex flex-col gap-2', classNames.root ?? '', className].filter(Boolean).join(' ')}>
      <SectionHeader title="Confidence" className={classNames.header} />
      <LegendSwatch
        color={LOW_CONFIDENCE_HATCH_COLOR}
        shape="hatch"
        label={`Below ${formatScore(threshold, 2)} normalised`}
        meta={hatchedCount !== undefined ? hatchedCount.toLocaleString() : undefined}
        title="Hatched cells are provisional (FR-9.3)."
      />
      <p className={['text-[10px] leading-snug text-ink-faint', classNames.note ?? ''].join(' ')}>
        Raw confidence peaks at {formatScore(confidenceCeiling, 3)} across this layer — about{' '}
        {impliedScenes} valid observations against a {observationCeiling}-scene ceiling. Values are
        normalised against that maximum, so the hatch marks cells that are weak{' '}
        <em>relative to this dataset</em>.
      </p>
    </div>
  );
};
