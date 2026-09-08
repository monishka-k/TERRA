'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { EmptyState, ErrorState, ScreeningGradeNotice, SectionHeader } from '@/components/common';
import { Button } from '@/components/ui';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import type { ApiError } from '@/lib/api/client';
import type { CandidateSiteItem } from '@/lib/api/types';

import { CandidateSiteCard } from './CandidateSiteCard';
import { CandidateSiteSkeleton } from './CandidateSiteSkeleton';

export interface CandidateSiteListProps {
  sites: CandidateSiteItem[];
  isLoading?: boolean;
  error?: ApiError | null;
  selectedId?: number | null;
  onSelect?: (site: CandidateSiteItem) => void;
  onRetry?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Filters and toggles rendered beside the title. */
  actionSlot?: React.ReactNode;
  /** Shown when no habitation has been picked yet. */
  placeholder?: React.ReactNode;
  /** Replaces the default empty state, for callers that know why the list is empty. */
  emptyStateSlot?: React.ReactNode;
  compactCards?: boolean;
  className?: string;
  classNames?: {
    root?: string;
    header?: string;
    list?: string;
    notice?: string;
  };
  animation?: {
    disabled?: boolean;
    stagger?: number;
    duration?: number;
  };
}

/** Ranked destination sites for the selected habitation. */
export const CandidateSiteList = ({
  sites,
  isLoading = false,
  error = null,
  selectedId = null,
  onSelect,
  onRetry,
  title = 'Candidate sites',
  description,
  actionSlot,
  placeholder,
  emptyStateSlot,
  compactCards = false,
  className = '',
  classNames = {},
  animation = {},
}: CandidateSiteListProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, stagger = 0.05, duration = 0.35 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!animate || sites.length === 0) return;
      gsap.from('[data-site-card]', {
        y: 10,
        opacity: 0,
        duration,
        stagger,
        ease: 'power2.out',
      });
    },
    { scope: rootRef, dependencies: [sites, animate, duration, stagger] },
  );

  const screeningNotice = sites[0]?.screening_grade;

  return (
    <div
      ref={rootRef}
      className={['flex min-h-0 flex-col gap-3', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      <SectionHeader
        title={title}
        description={description}
        actionSlot={actionSlot}
        className={classNames.header}
      />

      {placeholder ? (
        placeholder
      ) : error ? (
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
        <CandidateSiteSkeleton />
      ) : sites.length === 0 ? (
        (emptyStateSlot ?? (
          <EmptyState
            title="No candidate sites"
            description="No sites fall within the search radius for this habitation. Widen the radius to search further out."
          />
        ))
      ) : (
        <>
          <div className={['flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto', classNames.list ?? ''].join(' ')}>
            {sites.map((site, index) => (
              <CandidateSiteCard
                key={site.id}
                site={site}
                rank={index + 1}
                isSelected={site.id === selectedId}
                onSelect={onSelect}
                compact={compactCards}
                animation={{ disabled: !animate }}
              />
            ))}
          </div>
          {screeningNotice ? (
            <ScreeningGradeNotice notice={screeningNotice} className={classNames.notice} />
          ) : null}
        </>
      )}
    </div>
  );
};
