import type { ReactNode } from 'react';

export interface LeftPanelProps {
  children: ReactNode;
  /** Panel width in pixels. */
  width?: number;
  className?: string;
  classNames?: {
    root?: string;
    scroll?: string;
  };
}

export const LeftPanel = ({ children, width = 300, className = '', classNames = {} }: LeftPanelProps) => (
  <aside
    style={{ width }}
    className={[
      'flex shrink-0 flex-col border-r border-line bg-surface-0',
      classNames.root ?? '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <div className={['flex-1 overflow-y-auto p-3', classNames.scroll ?? ''].join(' ')}>{children}</div>
  </aside>
);
