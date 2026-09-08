'use client';

import { useMemo, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { SectionHeader } from '@/components/common/SectionHeader';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { buildLegendClasses } from '@/lib/map/colorScale';
import { SUSCEPTIBILITY_RAMP, type RGBAColor } from '@/lib/map/constants';

import { LegendSwatch } from './LegendSwatch';

export interface QuantileLegendProps {
  breaks: number[];
  domain: number[];
  quantiles: number[];
  title?: string;
  /** Explains why the classes are quantiles rather than even value steps. */
  description?: string;
  ramp?: RGBAColor[];
  /** Cell counts per class, when available. */
  classCounts?: number[];
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
 * Susceptibility legend built from the API's own quantile breaks.
 *
 * Reading breaks off the response rather than hard-coding them means the legend and the
 * fill colours can never drift apart, including when the user filters to a viewport and
 * the server reclassifies over that smaller population.
 */
export const QuantileLegend = ({
  breaks,
  domain,
  quantiles,
  title = 'Flood susceptibility',
  description,
  ramp = SUSCEPTIBILITY_RAMP,
  classCounts,
  className = '',
  classNames = {},
  animation = {},
}: QuantileLegendProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, stagger = 0.04, duration = 0.35 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  const classes = useMemo(
    () => buildLegendClasses(breaks, domain, ramp),
    [breaks, domain, ramp],
  );

  useGSAP(
    () => {
      if (!animate || classes.length === 0) return;
      gsap.from('[data-legend-row]', {
        x: -6,
        opacity: 0,
        duration,
        stagger,
        ease: 'power2.out',
      });
    },
    { scope: rootRef, dependencies: [animate, classes.length, duration, stagger] },
  );

  const quantileLabel = (index: number): string => {
    if (index === 0) return `< P${Math.round(quantiles[0] * 100)}`;
    if (index >= quantiles.length) return `> P${Math.round(quantiles[quantiles.length - 1] * 100)}`;
    return `P${Math.round(quantiles[index - 1] * 100)}–P${Math.round(quantiles[index] * 100)}`;
  };

  return (
    <div
      ref={rootRef}
      className={['flex flex-col gap-2', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      <SectionHeader title={title} description={description} className={classNames.header} />
      <div className={['flex flex-col gap-1', classNames.list ?? ''].join(' ')}>
        {classes.map((cls, index) => (
          <LegendSwatch
            key={`${cls.min}-${cls.max}`}
            color={cls.color}
            label={cls.label}
            meta={classCounts?.[index] !== undefined ? classCounts[index].toLocaleString() : quantileLabel(index)}
            title={`${quantileLabel(index)} of the layer`}
          />
        ))}
      </div>
    </div>
  );
};
