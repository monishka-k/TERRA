'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

export interface SegmentedControlOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Native tooltip text for the segment. */
  title?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string | number> {
  options: SegmentedControlOption<T>[];
  value: T;
  label?: ReactNode;
  onValueChange?: (value: T) => void;
  className?: string;
  classNames?: {
    root?: string;
    label?: string;
    group?: string;
    option?: string;
  };
  animation?: {
    disabled?: boolean;
    duration?: number;
  };
}

export const SegmentedControl = <T extends string | number>({
  options,
  value,
  label,
  onValueChange,
  className = '',
  classNames = {},
  animation = {},
}: SegmentedControlProps<T>) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, duration = 0.25 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!animate) return;
      gsap.fromTo(
        '[data-segment][data-selected="true"]',
        { scale: 0.94 },
        { scale: 1, duration, ease: 'back.out(2)', overwrite: 'auto' },
      );
    },
    { scope: rootRef, dependencies: [value, animate, duration] },
  );

  return (
    <div
      ref={rootRef}
      className={['flex flex-col gap-1.5', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      {label ? (
        <span
          className={[
            'text-[11px] font-medium uppercase tracking-wide text-ink-muted',
            classNames.label ?? '',
          ].join(' ')}
        >
          {label}
        </span>
      ) : null}
      <div
        role="radiogroup"
        className={[
          'inline-flex rounded-md border border-line bg-surface-2 p-0.5',
          classNames.group ?? '',
        ].join(' ')}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              title={option.title}
              disabled={option.disabled}
              data-segment
              data-selected={selected}
              onClick={() => onValueChange?.(option.value)}
              className={[
                'flex-1 rounded px-2.5 py-1 text-[11px] font-medium transition-colors duration-150',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                'disabled:cursor-not-allowed disabled:opacity-40',
                selected ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:text-ink',
                classNames.option ?? '',
              ].join(' ')}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
