'use client';

import { MetricCard } from '@/components/common/MetricCard';
import { MetricCardSkeleton } from '@/components/common/MetricCardSkeleton';
import { SectionHeader } from '@/components/common/SectionHeader';
import type { HazardLayerResponse } from '@/lib/api/types';

export interface LayerStatsPanelProps {
  layer: HazardLayerResponse | null;
  isLoading?: boolean;
  title?: string;
  className?: string;
  classNames?: {
    root?: string;
    grid?: string;
  };
}

/** Headline counts for the active layer, sourced from the response envelope. */
export const LayerStatsPanel = ({
  layer,
  isLoading = false,
  title = 'Layer',
  className = '',
  classNames = {},
}: LayerStatsPanelProps) => {
  if (isLoading || !layer) {
    return (
      <div className={['flex flex-col gap-2', className].filter(Boolean).join(' ')}>
        <SectionHeader title={title} />
        <div className="grid grid-cols-2 gap-2">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      </div>
    );
  }

  const przCount = layer.cells.filter(
    (cell) => cell.susceptibility >= layer.legend.prz_susceptibility_threshold,
  ).length;

  return (
    <div className={['flex flex-col gap-2', classNames.root ?? '', className].filter(Boolean).join(' ')}>
      <SectionHeader
        title={title}
        description={`${layer.model_version} · resolution ${layer.res}`}
      />
      <div className={['grid grid-cols-2 gap-2', classNames.grid ?? ''].join(' ')}>
        <MetricCard
          label="Cells"
          value={layer.count}
          numericValue={layer.count}
          formatNumeric={(v) => Math.round(v).toLocaleString()}
        />
        <MetricCard
          label="PRZ candidates"
          value={przCount}
          numericValue={przCount}
          formatNumeric={(v) => Math.round(v).toLocaleString()}
          variant={przCount > 0 ? 'critical' : 'default'}
          description={`≥ ${layer.legend.prz_susceptibility_threshold.toFixed(2)} (FR-3.9)`}
        />
        <MetricCard
          label="Median score"
          value={layer.legend.breaks[1] ?? 0}
          numericValue={layer.legend.breaks[1] ?? 0}
          formatNumeric={(v) => v.toFixed(3)}
          description="P50 of the layer"
        />
        <MetricCard
          label="No data"
          value={layer.coverage.no_coverage}
          numericValue={layer.coverage.no_coverage}
          formatNumeric={(v) => Math.round(v).toLocaleString()}
          variant={layer.coverage.no_coverage > 0 ? 'warning' : 'default'}
          description="Zero-score by fill, not measurement"
        />
      </div>
    </div>
  );
};
