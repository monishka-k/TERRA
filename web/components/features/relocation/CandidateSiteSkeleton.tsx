export interface CandidateSiteSkeletonProps {
  /** Placeholder cards to render while sites load. */
  cards?: number;
  className?: string;
  classNames?: {
    root?: string;
    card?: string;
  };
}

/** Loading placeholder matching CandidateSiteCard's footprint. */
export const CandidateSiteSkeleton = ({
  cards = 3,
  className = '',
  classNames = {},
}: CandidateSiteSkeletonProps) => (
  <div
    aria-hidden
    className={['flex flex-col gap-3', classNames.root ?? '', className].filter(Boolean).join(' ')}
  >
    {Array.from({ length: cards }, (_, index) => (
      <div
        key={index}
        className={[
          'h-[260px] animate-pulse rounded-xl border border-line/40 bg-surface-1/40',
          classNames.card ?? '',
        ].join(' ')}
      />
    ))}
  </div>
);
