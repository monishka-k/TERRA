import type { ReactNode } from 'react';

export interface ErrorStateProps {
  title?: ReactNode;
  message: ReactNode;
  /** Machine-readable error code from the API envelope. */
  code?: string | null;
  requestId?: string | null;
  actionSlot?: ReactNode;
  className?: string;
  classNames?: {
    root?: string;
    title?: string;
    message?: string;
    meta?: string;
  };
}

export const ErrorState = ({
  title = 'Could not load data',
  message,
  code,
  requestId,
  actionSlot,
  className = '',
  classNames = {},
}: ErrorStateProps) => (
  <div
    role="alert"
    className={[
      'flex flex-col gap-2 rounded-lg border border-critical/40 bg-critical/8 px-3.5 py-3',
      classNames.root ?? '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <p className={['text-xs font-semibold text-critical', classNames.title ?? ''].join(' ')}>{title}</p>
    <p className={['text-[11px] leading-relaxed text-ink-muted', classNames.message ?? ''].join(' ')}>
      {message}
    </p>
    {(code || requestId) && (
      <p className={['font-mono text-[10px] text-ink-faint', classNames.meta ?? ''].join(' ')}>
        {code}
        {code && requestId ? ' · ' : ''}
        {requestId}
      </p>
    )}
    {actionSlot}
  </div>
);
