import type { ReactNode } from 'react';

export interface RightPanelProps {
  children: ReactNode;
  width?: number;
  className?: string;
  classNames?: {
    root?: string;
    scroll?: string;
  };
}

export const RightPanel = ({ children, width = 340, className = '', classNames = {} }: RightPanelProps) => (
  <aside
    style={{ width }}
    className={[
      'flex shrink-0 flex-col border-l border-line bg-surface-0',
      classNames.root ?? '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <div className={['flex-1 overflow-y-auto p-3', classNames.scroll ?? ''].join(' ')}>{children}</div>
  </aside>
);
