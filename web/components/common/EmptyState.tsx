import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Slot for a recovery action such as a retry button. */
  actionSlot?: ReactNode;
  className?: string;
  classNames?: {
    root?: string;
    icon?: string;
    title?: string;
    description?: string;
  };
}

export const EmptyState = ({
  title,
  description,
  icon,
  actionSlot,
  className = '',
  classNames = {},
}: EmptyStateProps) => (
  <div
    className={[
      'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line px-4 py-8 text-center',
      classNames.root ?? '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {icon ? <span className={['text-ink-faint', classNames.icon ?? ''].join(' ')}>{icon}</span> : null}
    <p className={['text-xs font-medium text-ink-muted', classNames.title ?? ''].join(' ')}>{title}</p>
    {description ? (
      <p className={['max-w-[34ch] text-[10px] leading-relaxed text-ink-faint', classNames.description ?? ''].join(' ')}>
        {description}
      </p>
    ) : null}
    {actionSlot}
  </div>
);
