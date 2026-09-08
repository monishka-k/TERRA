'use client';

import { MetricCard } from '@/components/common/MetricCard';
import { ErrorState } from '@/components/common/ErrorState';
import { ScreeningGradeNotice } from '@/components/common/ScreeningGradeNotice';
import { useHazardCellDetail } from '@/lib/hooks/useHazardCellDetail';
import type { HazardType } from '@/lib/api/types';

import { CoverageNotice } from './CoverageNotice';
import { DossierEmptyState } from './DossierEmptyState';
import { DossierHeader } from './DossierHeader';
import { DossierSkeleton } from './DossierSkeleton';
import { DriverBreakdown } from './DriverBreakdown';

export interface CellDossierProps {
  /** Selected H3 index, or null for the empty state. */
  h3: string | null;
  hazardType?: HazardType;
  /** PRZ threshold used to colour the score card. */
  przThreshold?: number;
  className?: string;
  classNames?: {
    root?: string;
    metrics?: string;
  };
}

/**
 * Right-panel dossier for the selected cell.
 *
 * Owns its own fetch so the map does not have to re-render when a selection loads;
 * every child below it is presentational.
 */
export const CellDossier = ({
  h3,
  hazardType = 'riverine_flood',
  przThreshold = 0.85,
  className = '',
  classNames = {},
}: CellDossierProps) => {
  const { detail, isLoading, error } = useHazardCellDetail(h3, hazardType);

  if (!h3) return <DossierEmptyState className={className} />;
  if (isLoading) return <DossierSkeleton className={className} />;
  if (error) {
    return (
      <ErrorState
        title="Cell unavailable"
        message={error.message}
        code={error.code}
        requestId={error.requestId}
        className={className}
      />
    );
  }
  if (!detail) return <DossierEmptyState className={className} />;

  const scoreVariant =
    detail.quality_flag === 'no_coverage'
      ? 'default'
      : detail.susceptibility >= przThreshold
        ? 'critical'
        : detail.susceptibility >= 0.58
          ? 'warning'
          : 'safe';

  return (
    <div
      className={['flex flex-col gap-3.5', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      <DossierHeader detail={detail} />

      <CoverageNotice flag={detail.quality_flag} />

      <div className={['grid grid-cols-2 gap-2', classNames.metrics ?? ''].join(' ')}>
        <MetricCard
          label="Susceptibility"
          value={detail.susceptibility}
          numericValue={detail.susceptibility}
          formatNumeric={(v) => v.toFixed(3)}
          variant={scoreVariant}
          description={
            detail.quality_flag === 'no_coverage'
              ? 'Filled, not measured.'
              : `PRZ threshold ${przThreshold.toFixed(2)}`
          }
        />
        <MetricCard
          label="Confidence"
          value={detail.confidence_normalised}
          numericValue={detail.confidence_normalised}
          formatNumeric={(v) => `${Math.round(v * 100)}%`}
          variant="info"
          description={`Raw ${detail.confidence.toFixed(3)}, normalised against the layer ceiling.`}
        />
        <MetricCard
          className="col-span-2"
          label="Est. Population"
          value={
            detail.population !== null && detail.population !== undefined
              ? Math.round(detail.population).toLocaleString()
              : '0'
          }
          numericValue={detail.population ?? 0}
          formatNumeric={(v) => Math.round(v).toLocaleString()}
          variant={detail.population && detail.population > 500 ? 'warning' : 'default'}
          description="WorldPop 100m constrained sum across hexagon"
        />
      </div>

      {detail.drivers ? <DriverBreakdown drivers={detail.drivers} /> : null}

      <ScreeningGradeNotice notice={detail.screening_grade} className="rounded-md border-t-0 border" />
    </div>
  );
};
