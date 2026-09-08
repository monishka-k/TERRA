import type { ReactNode } from 'react';

export interface DriverMetricRowProps {
  label: ReactNode;
  value: ReactNode;
  /** Optional [0,1] fill showing where the value sits in its range. */
  fraction?: number | null;
  /** Explains what the metric is and where it comes from. */
  hint?: string;
  variant?: 'default' | 'accent' | 'muted';
  className?: string;
  classNames?: {
    root?: string;
    label?: string;
    value?: string;
    bar?: string;
  };
}

const BAR_CLASSES: Record<NonNullable<DriverMetricRowProps['variant']>, string> = {
  default: 'bg-ink-faint',
  accent: 'bg-accent',
  muted: 'bg-line-strong',
};

/** One driver metric with an optional inline magnitude bar. */
export const DriverMetricRow = ({
  label,
  value,
  fraction,
  hint,
  variant = 'default',
  className = '',
  classNames = {},
}: DriverMetricRowProps) => (
  <div
    title={hint}
    data-driver-row
    className={['flex flex-col gap-1', classNames.root ?? '', className].filter(Boolean).join(' ')}
  >
    <div className="flex items-baseline justify-between gap-2">
      <span className={['text-[10px] text-ink-faint', classNames.label ?? ''].join(' ')}>{label}</span>
      <span className={['font-mono text-[11px] tabular-nums text-ink', classNames.value ?? ''].join(' ')}>
        {value}
      </span>
    </div>
    {fraction !== null && fraction !== undefined ? (
      <div className={['h-0.5 w-full overflow-hidden rounded-full bg-line', classNames.bar ?? ''].join(' ')}>
        <div
          className={['h-full rounded-full', BAR_CLASSES[variant]].join(' ')}
          style={{ width: `${Math.min(100, Math.max(0, fraction * 100))}%` }}
        />
      </div>
    ) : null}
  </div>
);
