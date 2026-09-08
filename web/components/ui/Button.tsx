'use client';

import { useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Button label. */
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon rendered before the label. */
  leftIcon?: ReactNode;
  /** Icon rendered after the label. */
  rightIcon?: ReactNode;
  /** Stretches the button to fill its container. */
  fullWidth?: boolean;
  /** Renders in a pressed/selected state. */
  isActive?: boolean;
  className?: string;
  classNames?: {
    root?: string;
    label?: string;
    leftIcon?: string;
    rightIcon?: string;
  };
  animation?: {
    disabled?: boolean;
    hoverScale?: number;
    pressScale?: number;
    duration?: number;
  };
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-panel border-accent hover:bg-accent-strong',
  secondary: 'bg-surface-2 text-ink border-line hover:border-line-strong',
  ghost: 'bg-transparent text-ink-muted border-transparent hover:text-ink hover:bg-surface-2',
  danger: 'bg-critical/15 text-critical border-critical/40 hover:bg-critical/25',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[11px] gap-1.5',
  md: 'h-9 px-3.5 text-xs gap-2',
  lg: 'h-11 px-5 text-sm gap-2.5',
};

export const Button = ({
  children,
  variant = 'secondary',
  size = 'md',
  leftIcon,
  rightIcon,
  fullWidth = false,
  isActive = false,
  className = '',
  classNames = {},
  animation = {},
  ...buttonProps
}: ButtonProps) => {
  const rootRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const {
    disabled: animationDisabled = false,
    hoverScale = 1.03,
    pressScale = 0.97,
    duration = 0.18,
  } = animation;

  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!animate || !rootRef.current) return;
      const element = rootRef.current;
      const to = (scale: number) =>
        gsap.to(element, { scale, duration, ease: 'power2.out', overwrite: 'auto' });

      const onEnter = () => to(hoverScale);
      const onLeave = () => to(1);
      const onDown = () => to(pressScale);

      element.addEventListener('mouseenter', onEnter);
      element.addEventListener('mouseleave', onLeave);
      element.addEventListener('mousedown', onDown);
      element.addEventListener('mouseup', onEnter);
      element.addEventListener('blur', onLeave);

      return () => {
        element.removeEventListener('mouseenter', onEnter);
        element.removeEventListener('mouseleave', onLeave);
        element.removeEventListener('mousedown', onDown);
        element.removeEventListener('mouseup', onEnter);
        element.removeEventListener('blur', onLeave);
      };
    },
    { scope: rootRef, dependencies: [animate, hoverScale, pressScale, duration] },
  );

  return (
    <button
      ref={rootRef}
      type="button"
      {...buttonProps}
      data-active={isActive || undefined}
      className={[
        'inline-flex items-center justify-center rounded-md border font-medium',
        'transition-colors duration-150 will-change-transform',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'data-[active]:border-accent data-[active]:text-accent data-[active]:bg-accent/10',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        classNames.root ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {leftIcon ? <span className={classNames.leftIcon}>{leftIcon}</span> : null}
      {children ? <span className={classNames.label}>{children}</span> : null}
      {rightIcon ? <span className={classNames.rightIcon}>{rightIcon}</span> : null}
    </button>
  );
};
