import type { ReactNode } from 'react';

export interface ThreePanelLayoutProps {
  header?: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  /** Persistent notice rail pinned to the bottom (screening grade, attribution). */
  footer?: ReactNode;
  className?: string;
  classNames?: {
    root?: string;
    body?: string;
  };
}

/** App shell: header, three columns, persistent footer notice (PRD §6.11). */
export const ThreePanelLayout = ({
  header,
  left,
  center,
  right,
  footer,
  className = '',
  classNames = {},
}: ThreePanelLayoutProps) => (
  <div
    className={['flex h-dvh flex-col overflow-hidden bg-surface-0 text-ink', classNames.root ?? '', className]
      .filter(Boolean)
      .join(' ')}
  >
    {header}
    <div className={['flex min-h-0 flex-1', classNames.body ?? ''].join(' ')}>
      {left}
      {center}
      {right}
    </div>
    {footer}
  </div>
);
