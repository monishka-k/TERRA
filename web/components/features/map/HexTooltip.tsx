'use client';

import { CoverageStatusPill } from '@/components/common/StatusPill';
import type { HazardCell } from '@/lib/api/types';
import { normaliseConfidence, renderClassFor } from '@/lib/map/colorScale';
import { formatH3, formatPercent, formatScore } from '@/lib/map/format';

export interface HexTooltipProps {
  cell: HazardCell;
  /** Cursor position in canvas pixels. */
  x: number;
  y: number;
  confidenceCeiling: number;
  className?: string;
  classNames?: {
    root?: string;
    header?: string;
    score?: string;
    row?: string;
  };
}

const RENDER_CLASS_COPY: Record<string, string> = {
  hard_zero: 'Safe by terrain — excluded by the HAND/slope rule.',
  no_coverage: 'Not observed. The 0.00 is a fill, not a measurement.',
};

/** Cursor-following readout for the hovered hexagon. */
export const HexTooltip = ({
  cell,
  x,
  y,
  confidenceCeiling,
  className = '',
  classNames = {},
}: HexTooltipProps) => {
  const renderClass = renderClassFor(cell);
  const note = RENDER_CLASS_COPY[renderClass];

  return (
    <div
      style={{ left: x + 14, top: y + 14 }}
      className={[
        'pointer-events-none absolute z-30 w-56 rounded-md border border-line bg-panel/95 p-2.5 shadow-xl backdrop-blur-md',
        classNames.root ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={['flex items-center justify-between gap-2', classNames.header ?? ''].join(' ')}>
        <span className="font-mono text-[10px] text-ink-faint">{formatH3(cell.h3)}</span>
        <CoverageStatusPill flag={cell.quality_flag} />
      </div>

      <div className={['mt-1.5 font-mono text-lg leading-none text-ink', classNames.score ?? ''].join(' ')}>
        {formatScore(cell.susceptibility)}
      </div>

      <div className={['mt-2 flex flex-col gap-1', classNames.row ?? ''].join(' ')}>
        <div className="flex justify-between text-[10px]">
          <span className="text-ink-faint">Confidence</span>
          <span className="font-mono text-ink-muted">
            {formatPercent(normaliseConfidence(cell.confidence, confidenceCeiling))}
          </span>
        </div>
        {cell.hard_zero_fraction !== null ? (
          <div className="flex justify-between text-[10px]">
            <span className="text-ink-faint">Hard-zero area</span>
            <span className="font-mono text-ink-muted">{formatPercent(cell.hard_zero_fraction)}</span>
          </div>
        ) : null}
      </div>

      {note ? <p className="mt-2 text-[10px] leading-snug text-ink-faint">{note}</p> : null}
    </div>
  );
};
