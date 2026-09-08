import type { ReactNode } from 'react';

export interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Slot for controls aligned to the right of the title. */
  actionSlot?: ReactNode;
  className?: string;
  classNames?: {
    root?: string;
    title?: string;
    description?: string;
    action?: string;
  };
}

export const SectionHeader = ({
  title,
  description,
  actionSlot,
  className = '',
  classNames = {},
}: SectionHeaderProps) => (
  <div className={['flex flex-col gap-0.5', classNames.root ?? '', className].filter(Boolean).join(' ')}>
    <div className="flex items-center justify-between gap-2">
      <h2
        className={[
          'text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted',
          classNames.title ?? '',
        ].join(' ')}
      >
        {title}
      </h2>
      {actionSlot ? <span className={classNames.action}>{actionSlot}</span> : null}
    </div>
    {description ? (
      <p className={['text-[10px] leading-snug text-ink-faint', classNames.description ?? ''].join(' ')}>
        {description}
      </p>
    ) : null}
  </div>
);
