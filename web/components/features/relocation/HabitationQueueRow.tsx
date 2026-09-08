'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import type { HabitationListItem } from '@/lib/api/types';
import { formatCount, formatPercent, formatScore } from '@/lib/map/format';

import { TierBadge } from './TierBadge';

export interface HabitationQueueRowProps {
  habitation: HabitationListItem;
  rank: number;
  isSelected?: boolean;
  onSelect?: (habitation: HabitationListItem) => void;
  className?: string;
  classNames?: {
    root?: string;
    rank?: string;
    name?: string;
    meta?: string;
    score?: string;
  };
  animation?: {
    disabled?: boolean;
    duration?: number;
  };
}

/** One habitation in the triage queue. Extracted so the list never inlines JSX in `.map()`. */
export const HabitationQueueRow = ({
  habitation,
  rank,
  isSelected = false,
  onSelect,
  className = '',
  classNames = {},
  animation = {},
}: HabitationQueueRowProps) => {
  const rootRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, duration = 0.18 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!animate || !rootRef.current) return;
      const element = rootRef.current;
      const to = (y: number) => gsap.to(element, { y, duration, ease: 'power2.out', overwrite: 'auto' });
      const onEnter = () => to(-2);
      const onLeave = () => to(0);
      element.addEventListener('mouseenter', onEnter);
      element.addEventListener('mouseleave', onLeave);
      return () => {
        element.removeEventListener('mouseenter', onEnter);
        element.removeEventListener('mouseleave', onLeave);
      };
    },
    { scope: rootRef, dependencies: [animate, duration] },
  );

  return (
    <button
      ref={rootRef}
      type="button"
      data-habitation-row
      onClick={() => onSelect?.(habitation)}
      aria-pressed={isSelected}
      className={[
        'flex w-full flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-left will-change-transform',
        'transition-colors duration-150',
        isSelected
          ? 'border-accent bg-accent/10'
          : 'border-line/60 bg-surface-1/40 hover:border-line-strong',
        classNames.root ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className={['w-4 shrink-0 font-mono text-[10px] text-ink-faint', classNames.rank ?? ''].join(' ')}>
          {rank}
        </span>
        <span
          title={habitation.name}
          className={['flex-1 truncate text-[13px] font-semibold text-ink', classNames.name ?? ''].join(' ')}
        >
          {habitation.name}
        </span>
        <TierBadge tier={habitation.tier} />
      </div>

      <div className={['flex items-center gap-2 pl-6 text-[10px] text-ink-faint', classNames.meta ?? ''].join(' ')}>
        <span className="truncate">{habitation.admin_name ?? 'Unknown district'}</span>
        <span aria-hidden>·</span>
        <span className="font-mono tabular-nums">{formatCount(habitation.households)} HH</span>
        <span aria-hidden>·</span>
        <span className="font-mono tabular-nums" title="Share of the habitation inside a potential red zone">
          {formatPercent(habitation.prz_overlap_pct / 100)} PRZ
        </span>
        <span
          className={['ml-auto font-mono tabular-nums text-ink', classNames.score ?? ''].join(' ')}
          title="Priority score"
        >
          {formatScore(habitation.priority_score)}
        </span>
      </div>
    </button>
  );
};
