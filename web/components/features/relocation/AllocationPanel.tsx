'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { EmptyState, ErrorState, ScreeningGradeNotice, SectionHeader } from '@/components/common';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import type { ApiError } from '@/lib/api/client';
import type { AllocationAssignment, AllocationPlanResponse } from '@/lib/api/types';

import { AllocationAssignmentRow } from './AllocationAssignmentRow';
import { AllocationSummary } from './AllocationSummary';
import { AllocationWarnings } from './AllocationWarnings';

export interface AllocationPanelProps {
  plan: AllocationPlanResponse | null;
  isSolving?: boolean;
  error?: ApiError | null;
  /** Highlights assignments originating from this habitation. */
  highlightedHabitationId?: number | null;
  onSelectAssignment?: (assignment: AllocationAssignment) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Solver parameter controls, rendered above the result. */
  controlsSlot?: React.ReactNode;
  emptyStateSlot?: React.ReactNode;
  className?: string;
  classNames?: {
    root?: string;
    header?: string;
    controls?: string;
    result?: string;
    list?: string;
  };
  animation?: {
    disabled?: boolean;
    stagger?: number;
    duration?: number;
  };
}

/** Solver parameters, the resulting plan, and every assignment it produced. */
export const AllocationPanel = ({
  plan,
  isSolving = false,
  error = null,
  highlightedHabitationId = null,
  onSelectAssignment,
  title = 'Allocation plan',
  description,
  controlsSlot,
  emptyStateSlot,
  className = '',
  classNames = {},
  animation = {},
}: AllocationPanelProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, stagger = 0.04, duration = 0.3 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  const assignments = plan?.assignments ?? [];

  useGSAP(
    () => {
      if (!animate || assignments.length === 0) return;
      gsap.from('[data-assignment-row]', {
        y: 8,
        opacity: 0,
        duration,
        stagger,
        ease: 'power2.out',
      });
    },
    { scope: rootRef, dependencies: [assignments, animate, duration, stagger] },
  );

  return (
    <div
      ref={rootRef}
      className={['flex min-h-0 flex-col gap-4', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      <SectionHeader title={title} description={description} className={classNames.header} />

      {controlsSlot ? <div className={classNames.controls}>{controlsSlot}</div> : null}

      {error ? (
        <ErrorState
          title="Allocation failed"
          message={
            error.code === 'UNAUTHENTICATED' || error.status === 401
              ? 'Running an allocation requires an authenticated government official. Sign in to continue.'
              : error.message
          }
          code={error.code}
          requestId={error.requestId}
        />
      ) : isSolving ? (
        <div aria-hidden className="h-32 animate-pulse rounded-xl border border-line/40 bg-surface-1/40" />
      ) : !plan ? (
        (emptyStateSlot ?? (
          <EmptyState
            title="No plan yet"
            description="Set the solver parameters and run an allocation to see how demand maps onto available sites."
          />
        ))
      ) : (
        <div className={['flex min-h-0 flex-col gap-3', classNames.result ?? ''].join(' ')}>
          <AllocationSummary plan={plan} />

          <AllocationWarnings warnings={plan.group_split_warnings ?? []} />

          {assignments.length === 0 ? (
            <EmptyState
              title="No assignments"
              description="The solver completed but placed nobody — no eligible site had spare capacity within the radius."
            />
          ) : (
            <div className={['flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto', classNames.list ?? ''].join(' ')}>
              {assignments.map((assignment, index) => (
                <AllocationAssignmentRow
                  key={`${assignment.habitation_id}-${assignment.site_id}-${index}`}
                  assignment={assignment}
                  isHighlighted={assignment.habitation_id === highlightedHabitationId}
                  onSelect={onSelectAssignment}
                />
              ))}
            </div>
          )}

          <ScreeningGradeNotice notice={plan.screening_grade} />
        </div>
      )}
    </div>
  );
};
