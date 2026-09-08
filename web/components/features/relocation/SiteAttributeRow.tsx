import type { ReactNode } from 'react';

export interface SiteAttributeRowProps {
  items: { label: ReactNode; value: ReactNode; hint?: string }[];
  className?: string;
  classNames?: {
    root?: string;
    item?: string;
    label?: string;
    value?: string;
  };
}

/** Compact attribute strip for a site's physical screening facts. */
export const SiteAttributeRow = ({
  items,
  className = '',
  classNames = {},
}: SiteAttributeRowProps) => (
  <div
    className={['flex flex-wrap gap-x-4 gap-y-1', classNames.root ?? '', className].filter(Boolean).join(' ')}
  >
    {items.map((item, index) => (
      <div
        key={index}
        title={item.hint}
        className={['flex items-baseline gap-1', classNames.item ?? ''].join(' ')}
      >
        <span className={['text-[10px] text-ink-faint', classNames.label ?? ''].join(' ')}>
          {item.label}
        </span>
        <span
          className={['font-mono text-[11px] tabular-nums text-ink', classNames.value ?? ''].join(' ')}
        >
          {item.value}
        </span>
      </div>
    ))}
  </div>
);
