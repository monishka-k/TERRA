'use client';

import type { AllocationAssignment } from '@/lib/api/types';

import { TierBadge } from './TierBadge';

export interface AllocationAssignmentRowProps {
  assignment: AllocationAssignment;
  isHighlighted?: boolean;
  onSelect?: (assignment: AllocationAssignment) => void;
  className?: string;
  classNames?: {
    root?: string;
    origin?: string;
    destination?: string;
    households?: string;
    split?: string;
  };
}

/** One habitation-to-site assignment produced by the solver. */
export const AllocationAssignmentRow = ({
  assignment,
  isHighlighted = false,
  onSelect,
  className = '',
  classNames = {},
}: AllocationAssignmentRowProps) => (
  <div
    data-assignment-row
    role={onSelect ? 'button' : undefined}
    tabIndex={onSelect ? 0 : undefined}
    onClick={() => onSelect?.(assignment)}
    onKeyDown={(event) => {
      if (onSelect && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onSelect(assignment);
      }
    }}
    className={[
      'flex flex-col gap-1 rounded-lg border px-3 py-2 transition-colors duration-150',
      isHighlighted ? 'border-accent bg-accent/[0.06]' : 'border-line/60 bg-surface-1/40',
      onSelect ? 'cursor-pointer hover:border-line-strong' : '',
      classNames.root ?? '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <div className="flex items-center gap-2">
      <span className={['min-w-0 flex-1 truncate text-[12px] font-semibold text-ink', classNames.origin ?? ''].join(' ')}>
        {assignment.habitation_name}
      </span>
      <TierBadge tier={assignment.tier} />
    </div>

    <div className="flex items-center gap-2 text-[10px] text-ink-faint">
      <span aria-hidden>→</span>
      <span className={['truncate', classNames.destination ?? ''].join(' ')}>
        Site {assignment.site_id}
      </span>
      <span aria-hidden>·</span>
      <span className="font-mono tabular-nums">{assignment.site_distance_km.toFixed(2)} km</span>
      {assignment.site_suitability != null ? (
        <>
          <span aria-hidden>·</span>
          <span className="font-mono tabular-nums">{assignment.site_suitability}/100</span>
        </>
      ) : null}
      <span
        className={['ml-auto font-mono font-semibold tabular-nums text-ink', classNames.households ?? ''].join(' ')}
      >
        {assignment.households.toLocaleString()} HH
      </span>
    </div>

    {assignment.has_group_split && assignment.split_details ? (
      <p className={['text-[10px] leading-snug text-warning', classNames.split ?? ''].join(' ')}>
        {assignment.split_details}
      </p>
    ) : null}
  </div>
);
