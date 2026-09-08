'use client';

import { useMemo, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { EmptyState } from '@/components/common/EmptyState';
import { SectionHeader } from '@/components/common/SectionHeader';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import type { HazardCell } from '@/lib/api/types';

import { TopRiskRow } from './TopRiskRow';

export interface TopRiskListProps {
  cells: HazardCell[];
  breaks: number[];
  przThreshold: number;
  title?: string;
  description?: string;
  /** Rows to render. */
  limit?: number;
  selectedH3?: string | null;
  onSelect?: (h3: string) => void;
  onHover?: (h3: string | null) => void;
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

/**
 * Highest-scoring cells in the current layer.
 *
 * Unobserved cells are excluded: a `no_coverage` cell has no score to rank, and letting a
 * filled zero sit in a hazard ranking would be actively misleading.
 */
export const TopRiskList = ({
  cells,
  breaks,
  przThreshold,
  title = 'Highest susceptibility',
  description,
  limit = 40,
  selectedH3 = null,
  onSelect,
  onHover,
  className = '',
  classNames = {},
  animation = {},
}: TopRiskListProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, stagger = 0.02, duration = 0.3 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  const ranked = useMemo(
    () =>
      cells
        .filter((cell) => cell.quality_flag !== 'no_coverage')
        .sort((a, b) => b.susceptibility - a.susceptibility)
        .slice(0, limit),
    [cells, limit],
  );

  useGSAP(
    () => {
      if (!animate || ranked.length === 0) return;
      gsap.from('[data-risk-row]', {
        y: 6,
        opacity: 0,
        duration,
        stagger,
        ease: 'power2.out',
      });
    },
    { scope: rootRef, dependencies: [ranked, animate, duration, stagger] },
  );

  return (
    <div
      ref={rootRef}
      className={['flex flex-col gap-2', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      <SectionHeader
        title={title}
        description={description ?? `Top ${ranked.length} of ${cells.length.toLocaleString()} cells`}
        className={classNames.header}
      />
      {ranked.length === 0 ? (
        <EmptyState title="No ranked cells" description="No measured cells in the current layer." />
      ) : (
        <div className={['flex flex-col gap-0.5', classNames.list ?? ''].join(' ')}>
          {ranked.map((cell, index) => (
            <TopRiskRow
              key={cell.h3}
              cell={cell}
              rank={index + 1}
              breaks={breaks}
              isSelected={cell.h3 === selectedH3}
              isPrzCandidate={cell.susceptibility >= przThreshold}
              onSelect={onSelect}
              onHover={onHover}
            />
          ))}
        </div>
      )}
    </div>
  );
};
