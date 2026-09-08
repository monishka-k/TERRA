import { MetricCardSkeleton } from '@/components/common/MetricCardSkeleton';

export interface DossierSkeletonProps {
  /** Number of placeholder driver rows. */
  rows?: number;
  className?: string;
}

/** Placeholder matching CellDossier's structure while the detail request is in flight. */
export const DossierSkeleton = ({ rows = 6, className = '' }: DossierSkeletonProps) => (
  <div aria-busy className={['flex flex-col gap-3', className].filter(Boolean).join(' ')}>
    <div className="flex flex-col gap-2">
      <div className="h-4 w-28 animate-pulse rounded bg-line" />
      <div className="h-2 w-40 animate-pulse rounded bg-line" />
    </div>
    <div className="grid grid-cols-2 gap-2">
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton className="col-span-2" />
    </div>
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex flex-col gap-1">
          <div className="flex justify-between">
            <div className="h-2 w-24 animate-pulse rounded bg-line" />
            <div className="h-2 w-10 animate-pulse rounded bg-line" />
          </div>
          <div className="h-0.5 w-full rounded-full bg-line" />
        </div>
      ))}
    </div>
  </div>
);
