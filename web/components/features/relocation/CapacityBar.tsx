import type { BindingConstraint } from '@/lib/api/types';

import { CONSTRAINT_HINTS, CONSTRAINT_LABELS, UNMEASURED_LABEL } from './constants';

export interface CapacityBarProps {
  constraint: BindingConstraint;
  /** Households this dimension supports; null means never measured, which is not zero. */
  value: number | null | undefined;
  /** Largest capacity across the site's dimensions, used to scale the bar. */
  max: number;
  /** Marks this dimension as the one capping the site. */
  isBinding?: boolean;
  className?: string;
  classNames?: {
    root?: string;
    label?: string;
    value?: string;
    track?: string;
    fill?: string;
  };
}

/**
 * One resource dimension of a site's carrying capacity.
 *
 * An unmeasured dimension renders as a hatched, valueless track rather than an empty bar —
 * "we never measured the water yield" and "this site supports nobody" must not look alike.
 */
export const CapacityBar = ({
  constraint,
  value,
  max,
  isBinding = false,
  className = '',
  classNames = {},
}: CapacityBarProps) => {
  const measured = value !== null && value !== undefined;
  const fraction = measured && max > 0 ? Math.min(1, value / max) : 0;

  return (
    <div
      title={CONSTRAINT_HINTS[constraint]}
      className={['flex flex-col gap-1', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={[
            'text-[10px] uppercase tracking-wide',
            isBinding ? 'font-semibold text-warning' : 'text-ink-faint',
            classNames.label ?? '',
          ].join(' ')}
        >
          {CONSTRAINT_LABELS[constraint]}
          {isBinding ? ' · binding' : ''}
        </span>
        <span
          className={[
            'font-mono text-[11px] tabular-nums',
            measured ? 'text-ink' : 'italic text-ink-faint',
            classNames.value ?? '',
          ].join(' ')}
        >
          {measured ? `${value.toLocaleString()} HH` : UNMEASURED_LABEL}
        </span>
      </div>

      <div
        className={[
          'h-1.5 w-full overflow-hidden rounded-full',
          measured ? 'bg-line' : 'bg-line/40',
          classNames.track ?? '',
        ].join(' ')}
        style={
          measured
            ? undefined
            : {
                backgroundImage:
                  'repeating-linear-gradient(45deg, currentColor 0 2px, transparent 2px 6px)',
                color: 'var(--ink-faint)',
                opacity: 0.35,
              }
        }
      >
        {measured ? (
          <div
            className={[
              'h-full rounded-full transition-[width] duration-300 ease-out',
              isBinding ? 'bg-warning' : 'bg-accent',
              classNames.fill ?? '',
            ].join(' ')}
            style={{ width: `${fraction * 100}%` }}
          />
        ) : null}
      </div>
    </div>
  );
};
