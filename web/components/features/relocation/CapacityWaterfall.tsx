'use client';

import { useMemo, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import type { BindingConstraint, CapacityBreakdown } from '@/lib/api/types';

import { BindingConstraintBadge } from './BindingConstraintBadge';
import { CapacityBar } from './CapacityBar';
import { UNMEASURED_LABEL } from './constants';

const DIMENSIONS: BindingConstraint[] = ['land', 'water', 'school', 'health'];

export interface CapacityWaterfallProps {
  capacity: CapacityBreakdown;
  title?: React.ReactNode;
  /** Renders the four dimension bars; off leaves only the headline figure. */
  showDimensions?: boolean;
  className?: string;
  classNames?: {
    root?: string;
    header?: string;
    final?: string;
    bars?: string;
    footnote?: string;
  };
  animation?: {
    disabled?: boolean;
    duration?: number;
  };
}

/**
 * A site's carrying capacity as the minimum across four independent resource dimensions.
 *
 * The final figure is not a sum or an average — it is whichever resource runs out first, which
 * is why the binding dimension is called out rather than left for the reader to spot.
 */
export const CapacityWaterfall = ({
  capacity,
  title = 'Carrying capacity',
  showDimensions = true,
  className = '',
  classNames = {},
  animation = {},
}: CapacityWaterfallProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, duration = 0.5 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  const values = useMemo<Record<BindingConstraint, number | null | undefined>>(
    () => ({
      land: capacity.cc_land,
      water: capacity.cc_water,
      school: capacity.cc_school,
      health: capacity.cc_health,
    }),
    [capacity],
  );

  const max = useMemo(
    () => Math.max(0, ...DIMENSIONS.map((d) => values[d]).filter((v): v is number => v != null)),
    [values],
  );

  const ccFinal = capacity.cc_final;

  useGSAP(
    () => {
      if (!animate || !finalRef.current || ccFinal == null) return;
      const target = finalRef.current;
      const counter = { value: 0 };
      gsap.to(counter, {
        value: ccFinal,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          target.textContent = Math.round(counter.value).toLocaleString();
        },
      });
    },
    { scope: rootRef, dependencies: [ccFinal, animate, duration] },
  );

  return (
    <div
      ref={rootRef}
      className={['flex flex-col gap-3', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      <div className={['flex items-center justify-between gap-2', classNames.header ?? ''].join(' ')}>
        <span className="text-[10px] uppercase tracking-wide text-ink-faint">{title}</span>
        <BindingConstraintBadge
          constraint={capacity.binding_constraint}
          tiedConstraints={capacity.tied_constraints}
        />
      </div>

      <div className={['flex items-baseline gap-2', classNames.final ?? ''].join(' ')}>
        {ccFinal == null ? (
          <span className="text-[15px] italic text-ink-faint">{UNMEASURED_LABEL}</span>
        ) : (
          <>
            <span ref={finalRef} className="font-mono text-2xl font-bold tabular-nums text-ink">
              {animate ? '0' : ccFinal.toLocaleString()}
            </span>
            <span className="text-[11px] text-ink-muted">households</span>
          </>
        )}
      </div>

      {showDimensions ? (
        <div className={['flex flex-col gap-2', classNames.bars ?? ''].join(' ')}>
          {DIMENSIONS.map((dimension) => (
            <CapacityBar
              key={dimension}
              constraint={dimension}
              value={values[dimension]}
              max={max}
              isBinding={capacity.binding_constraint === dimension}
            />
          ))}
        </div>
      ) : null}

      <p className={['text-[10px] leading-relaxed text-ink-faint', classNames.footnote ?? ''].join(' ')}>
        Capacity is the minimum across dimensions, scaled by a livelihood multiplier of{' '}
        <span className="font-mono tabular-nums">{capacity.livelihood_multiplier.toFixed(2)}</span>.
        Policy {capacity.policy_version} · {capacity.data_quality.replace(/_/g, ' ')} data.
      </p>
    </div>
  );
};
