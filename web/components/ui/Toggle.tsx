'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

export interface ToggleProps {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  classNames?: {
    root?: string;
    label?: string;
    description?: string;
    track?: string;
    thumb?: string;
  };
  animation?: {
    disabled?: boolean;
    duration?: number;
  };
}

export const Toggle = ({
  label,
  description,
  checked,
  disabled = false,
  onCheckedChange,
  className = '',
  classNames = {},
  animation = {},
}: ToggleProps) => {
  const rootRef = useRef<HTMLLabelElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, duration = 0.22 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!thumbRef.current) return;
      const x = checked ? 14 : 0;
      if (!animate) {
        gsap.set(thumbRef.current, { x });
        return;
      }
      gsap.to(thumbRef.current, { x, duration, ease: 'back.out(1.6)', overwrite: 'auto' });
    },
    { scope: rootRef, dependencies: [checked, animate, duration] },
  );

  return (
    <label
      ref={rootRef}
      className={[
        'flex cursor-pointer items-start gap-2.5 select-none',
        disabled ? 'cursor-not-allowed opacity-40' : '',
        classNames.root ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={[
          'mt-0.5 inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border px-0.5',
          'transition-colors duration-200',
          checked ? 'border-accent bg-accent/30' : 'border-line bg-surface-2',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          classNames.track ?? '',
        ].join(' ')}
      >
        <span
          ref={thumbRef}
          className={[
            'block h-3 w-3 rounded-full',
            checked ? 'bg-accent' : 'bg-ink-faint',
            classNames.thumb ?? '',
          ].join(' ')}
        />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className={['text-[11px] font-medium text-ink', classNames.label ?? ''].join(' ')}>
          {label}
        </span>
        {description ? (
          <span
            className={['text-[10px] leading-tight text-ink-faint', classNames.description ?? ''].join(' ')}
          >
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
};
