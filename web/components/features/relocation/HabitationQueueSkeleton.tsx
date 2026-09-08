export interface HabitationQueueSkeletonProps {
  /** Placeholder rows to render while the queue loads. */
  rows?: number;
  className?: string;
  classNames?: {
    root?: string;
    row?: string;
  };
}

/** Loading placeholder matching HabitationQueueRow's footprint, to avoid layout shift. */
export const HabitationQueueSkeleton = ({
  rows = 6,
  className = '',
  classNames = {},
}: HabitationQueueSkeletonProps) => (
  <div
    aria-hidden
    className={['flex flex-col gap-1.5', classNames.root ?? '', className].filter(Boolean).join(' ')}
  >
    {Array.from({ length: rows }, (_, index) => (
      <div
        key={index}
        className={[
          'h-[58px] animate-pulse rounded-lg border border-line/40 bg-surface-1/40',
          classNames.row ?? '',
        ].join(' ')}
      />
    ))}
  </div>
);
