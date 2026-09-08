export interface MapSkeletonProps {
  label?: string;
  className?: string;
  classNames?: {
    root?: string;
    grid?: string;
    label?: string;
  };
}

/** Loading placeholder shaped like the map canvas, so the shell does not jump. */
export const MapSkeleton = ({
  label = 'Loading hazard layer…',
  className = '',
  classNames = {},
}: MapSkeletonProps) => (
  <div
    aria-busy
    className={[
      'absolute inset-0 z-20 flex items-center justify-center bg-surface-0/85 backdrop-blur-[2px]',
      classNames.root ?? '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <div className="flex flex-col items-center gap-3">
      <div
        aria-hidden
        className={['h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent', classNames.grid ?? ''].join(' ')}
      />
      <p className={['text-[11px] text-ink-muted', classNames.label ?? ''].join(' ')}>{label}</p>
    </div>
  </div>
);
