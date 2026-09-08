'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { EmptyState, ErrorState, SectionHeader } from '@/components/common';
import { Button } from '@/components/ui';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import type { ApiError } from '@/lib/api/client';
import type { HabitationListItem } from '@/lib/api/types';

import { HabitationQueueRow } from './HabitationQueueRow';
import { HabitationQueueSkeleton } from './HabitationQueueSkeleton';

export interface HabitationQueueProps {
  habitations: HabitationListItem[];
  total?: number;
  isLoading?: boolean;
  error?: ApiError | null;
  selectedId?: number | null;
  onSelect?: (habitation: HabitationListItem) => void;
  onRetry?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Controls rendered to the right of the title, such as a district filter. */
  actionSlot?: React.ReactNode;
  className?: string;
  classNames?: {
    root?: string;
    header?: string;
    list?: string;
  };
  animation?: {
    disabled?: boolean;
    stagger?: number;
    duration?: number;
  };
}

/** The demand side of the plan: habitations ranked by triage priority. */
export const HabitationQueue = ({
  habitations,
  total,
  isLoading = false,
  error = null,
  selectedId = null,
  onSelect,
  onRetry,
  title = 'Triage queue',
  description,
  actionSlot,
  className = '',
  classNames = {},
  animation = {},
}: HabitationQueueProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, stagger = 0.04, duration = 0.3 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!animate || habitations.length === 0) return;
      gsap.from('[data-habitation-row]', {
        y: 8,
        opacity: 0,
        duration,
        stagger,
        ease: 'power2.out',
      });
    },
    { scope: rootRef, dependencies: [habitations, animate, duration, stagger] },
  );

  return (
    <div
      ref={rootRef}
      className={['flex min-h-0 flex-col gap-3', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      <SectionHeader
        title={title}
        description={
          description ??
          (total !== undefined
            ? `${habitations.length} of ${total.toLocaleString()} habitations`
            : undefined)
        }
        actionSlot={actionSlot}
        className={classNames.header}
      />

      {error ? (
        <ErrorState
          message={error.message}
          code={error.code}
          requestId={error.requestId}
          actionSlot={
            onRetry ? (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            ) : null
          }
        />
      ) : isLoading ? (
        <HabitationQueueSkeleton />
      ) : habitations.length === 0 ? (
        <EmptyState
          title="No habitations in scope"
          description="No triaged habitations match the current district and tier filter."
        />
      ) : (
        <div
          className={['flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto', classNames.list ?? ''].join(' ')}
        >
          {habitations.map((habitation, index) => (
            <HabitationQueueRow
              key={habitation.id}
              habitation={habitation}
              rank={index + 1}
              isSelected={habitation.id === selectedId}
              onSelect={onSelect}
              animation={{ disabled: !animate }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
