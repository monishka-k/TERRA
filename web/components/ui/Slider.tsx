'use client';

import { useRef, type ChangeEvent, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

export interface SliderProps {
  /** Field label. */
  label?: ReactNode;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** Formats the value shown beside the label. */
  formatValue?: (value: number) => string;
  /** Hint rendered under the track. */
  description?: ReactNode;
  disabled?: boolean;
  onValueChange?: (value: number) => void;
  className?: string;
  classNames?: {
    root?: string;
    label?: string;
    value?: string;
    track?: string;
    description?: string;
  };
  animation?: {
    disabled?: boolean;
    /** Duration of the value counter roll-up, in seconds. */
    duration?: number;
  };
}

export const Slider = ({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  formatValue = (v) => v.toFixed(2),
  description,
  disabled = false,
  onValueChange,
  className = '',
  classNames = {},
  animation = {},
}: SliderProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const displayedRef = useRef(value);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, duration = 0.3 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  // Tween the printed number rather than snapping it, so dragging reads as continuous.
  useGSAP(
    () => {
      const node = valueRef.current;
      if (!node) return;

      if (!animate) {
        node.textContent = formatValue(value);
        displayedRef.current = value;
        return;
      }

      const proxy = { current: displayedRef.current };
      gsap.to(proxy, {
        current: value,
        duration,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: () => {
          node.textContent = formatValue(proxy.current);
        },
        onComplete: () => {
          displayedRef.current = value;
        },
      });
    },
    { scope: rootRef, dependencies: [value, animate, duration] },
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange?.(Number(event.target.value));
  };

  return (
    <div
      ref={rootRef}
      className={['flex flex-col gap-1.5', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      {label !== undefined ? (
        <div className="flex items-baseline justify-between">
          <span
            className={[
              'text-[11px] font-medium uppercase tracking-wide text-ink-muted',
              classNames.label ?? '',
            ].join(' ')}
          >
            {label}
          </span>
          <span
            ref={valueRef}
            className={['font-mono text-[11px] text-ink', classNames.value ?? ''].join(' ')}
          >
            {formatValue(value)}
          </span>
        </div>
      ) : null}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={handleChange}
        aria-label={typeof label === 'string' ? label : undefined}
        className={[
          'h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-accent',
          'disabled:cursor-not-allowed disabled:opacity-40',
          classNames.track ?? '',
        ].join(' ')}
      />
      {description ? (
        <p className={['text-[10px] leading-tight text-ink-faint', classNames.description ?? ''].join(' ')}>
          {description}
        </p>
      ) : null}
    </div>
  );
};
