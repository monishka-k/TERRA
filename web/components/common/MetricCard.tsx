'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

export type MetricCardVariant = 'default' | 'critical' | 'warning' | 'safe' | 'info';

export interface MetricCardProps {
  /** Primary metric value. */
  value: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  variant?: MetricCardVariant;
  icon?: ReactNode;
  /** Slot for an auxiliary control such as an info popover. */
  actionSlot?: ReactNode;
  /** When numeric, the value counts up to this on change. */
  numericValue?: number;
  /** Formats `numericValue` during the count-up tween. */
  formatNumeric?: (value: number) => string;
  onClick?: () => void;
  className?: string;
  classNames?: {
    root?: string;
    header?: string;
    label?: string;
    value?: string;
    description?: string;
    iconWrapper?: string;
  };
  animation?: {
    disabled?: boolean;
    enableHover?: boolean;
    duration?: number;
  };
}

const VARIANT_CLASSES: Record<MetricCardVariant, string> = {
  default: 'border-line',
  critical: 'border-critical/40',
  warning: 'border-warning/40',
  safe: 'border-safe/40',
  info: 'border-accent/40',
};

const VALUE_CLASSES: Record<MetricCardVariant, string> = {
  default: 'text-ink',
  critical: 'text-critical',
  warning: 'text-warning',
  safe: 'text-safe',
  info: 'text-accent',
};

export const MetricCard = ({
  value,
  label,
  description,
  variant = 'default',
  icon,
  actionSlot,
  numericValue,
  formatNumeric = (v) => v.toFixed(2),
  onClick,
  className = '',
  classNames = {},
  animation = {},
}: MetricCardProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const displayedRef = useRef(numericValue ?? 0);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, enableHover = true, duration = 0.5 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      const node = valueRef.current;
      if (!node || numericValue === undefined) return;

      if (!animate) {
        node.textContent = formatNumeric(numericValue);
        displayedRef.current = numericValue;
        return;
      }

      const proxy = { current: displayedRef.current };
      gsap.to(proxy, {
        current: numericValue,
        duration,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: () => {
          node.textContent = formatNumeric(proxy.current);
        },
        onComplete: () => {
          displayedRef.current = numericValue;
        },
      });
    },
    { scope: rootRef, dependencies: [numericValue, animate, duration] },
  );

  useGSAP(
    () => {
      if (!animate || !enableHover || !rootRef.current) return;
      const element = rootRef.current;
      const to = (y: number) => gsap.to(element, { y, duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
      const onEnter = () => to(-3);
      const onLeave = () => to(0);
      element.addEventListener('mouseenter', onEnter);
      element.addEventListener('mouseleave', onLeave);
      return () => {
        element.removeEventListener('mouseenter', onEnter);
        element.removeEventListener('mouseleave', onLeave);
      };
    },
    { scope: rootRef, dependencies: [animate, enableHover] },
  );

  return (
    <div
      ref={rootRef}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={[
        'rounded-lg border bg-surface-1 p-3 will-change-transform',
        onClick ? 'cursor-pointer' : '',
        VARIANT_CLASSES[variant],
        classNames.root ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={['flex items-start justify-between gap-2', classNames.header ?? ''].join(' ')}>
        <span
          className={[
            'text-[10px] font-medium uppercase tracking-wider text-ink-muted',
            classNames.label ?? '',
          ].join(' ')}
        >
          {label}
        </span>
        {icon ? <span className={classNames.iconWrapper}>{icon}</span> : null}
        {actionSlot}
      </div>

      <div
        ref={valueRef}
        className={[
          'mt-1.5 font-mono text-xl leading-none tabular-nums',
          VALUE_CLASSES[variant],
          classNames.value ?? '',
        ].join(' ')}
      >
        {numericValue === undefined ? value : formatNumeric(numericValue)}
      </div>

      {description ? (
        <p className={['mt-1.5 text-[10px] leading-snug text-ink-faint', classNames.description ?? ''].join(' ')}>
          {description}
        </p>
      ) : null}
    </div>
  );
};
