import type { AugmentedCapacity } from '@/lib/api/types';

import { CONSTRAINT_LABELS } from './constants';

export interface AugmentedCapacityCalloutProps {
  augmented?: AugmentedCapacity | null;
  /** Current capacity, to show the gain the intervention would unlock. */
  baseCapacity?: number | null;
  className?: string;
  classNames?: {
    root?: string;
    headline?: string;
    intervention?: string;
    cost?: string;
  };
}

/**
 * What the site could hold if its binding constraint were relieved, and what that would take.
 *
 * Turns a static capacity number into a lever: the next constraint is named too, so nobody
 * reads the augmented figure as unlimited headroom.
 */
export const AugmentedCapacityCallout = ({
  augmented,
  baseCapacity,
  className = '',
  classNames = {},
}: AugmentedCapacityCalloutProps) => {
  if (!augmented) return null;

  const gain =
    baseCapacity != null ? augmented.augmented_capacity - baseCapacity : null;

  return (
    <div
      className={[
        'flex flex-col gap-1.5 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5',
        classNames.root ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className={['text-[11px] leading-snug text-ink', classNames.headline ?? ''].join(' ')}>
        Relieve{' '}
        <span className="font-semibold">
          {CONSTRAINT_LABELS[augmented.relieved_constraint].toLowerCase()}
        </span>{' '}
        and capacity rises to{' '}
        <span className="font-mono font-bold tabular-nums">
          {augmented.augmented_capacity.toLocaleString()}
        </span>{' '}
        HH
        {gain != null && gain > 0 ? (
          <span className="text-safe"> (+{gain.toLocaleString()})</span>
        ) : null}
        {augmented.next_binding_constraint ? (
          <>
            , after which{' '}
            <span className="font-semibold">
              {CONSTRAINT_LABELS[augmented.next_binding_constraint].toLowerCase()}
            </span>{' '}
            binds.
          </>
        ) : (
          '.'
        )}
      </p>

      <p className={['text-[10px] leading-snug text-ink-muted', classNames.intervention ?? ''].join(' ')}>
        {augmented.indicative_intervention}
      </p>

      <p className={['text-[10px] text-ink-faint', classNames.cost ?? ''].join(' ')}>
        {augmented.indicative_cost_inr_lakhs != null
          ? `Indicative cost: ₹${augmented.indicative_cost_inr_lakhs.toLocaleString()} lakh`
          : 'Indicative cost not estimated — costing requires a site survey.'}
      </p>
    </div>
  );
};
