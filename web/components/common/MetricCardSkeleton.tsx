export interface MetricCardSkeletonProps {
  className?: string;
  classNames?: {
    root?: string;
    label?: string;
    value?: string;
  };
}

/** Placeholder matching MetricCard's footprint so panels do not reflow on load. */
export const MetricCardSkeleton = ({ className = '', classNames = {} }: MetricCardSkeletonProps) => (
  <div
    aria-hidden
    className={[
      'animate-pulse rounded-lg border border-line bg-surface-1 p-3',
      classNames.root ?? '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <div className={['h-2 w-16 rounded bg-line', classNames.label ?? ''].join(' ')} />
    <div className={['mt-2.5 h-5 w-20 rounded bg-line', classNames.value ?? ''].join(' ')} />
  </div>
);
