'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'icon';
  /** Size dimension */
  size?: 'sm' | 'md' | 'lg';
  /** Optional icon rendered on the left */
  leftIcon?: React.ReactNode;
  /** Optional icon rendered on the right */
  rightIcon?: React.ReactNode;
  /** Enable GSAP microinteraction hover/active scaling */
  enableMicrointeraction?: boolean;
  /** Custom root className */
  className?: string;
  /** Granular styling overrides */
  classNames?: {
    root?: string;
    content?: string;
    leftIcon?: string;
    rightIcon?: string;
  };
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  enableMicrointeraction = true,
  className = '',
  classNames = {},
  disabled,
  ...rest
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useGSAP(() => {
    if (!enableMicrointeraction || disabled || !buttonRef.current) return;

    const el = buttonRef.current;
    const onEnter = () => gsap.to(el, { scale: 1.03, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
    const onLeave = () => gsap.to(el, { scale: 1.0, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
    const onDown = () => gsap.to(el, { scale: 0.97, duration: 0.1, ease: 'power2.in', overwrite: 'auto' });
    const onUp = () => gsap.to(el, { scale: 1.03, duration: 0.15, ease: 'power2.out', overwrite: 'auto' });

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('mousedown', onDown);
    el.addEventListener('mouseup', onUp);

    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mouseup', onUp);
    };
  }, { scope: buttonRef, dependencies: [enableMicrointeraction, disabled] });

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-xs font-semibold gap-2',
    lg: 'px-7 py-3.5 text-sm font-bold gap-2.5',
  }[size];

  const variantClasses = {
    primary: 'bg-citron hover:bg-citron-hover text-forest-dark font-bold shadow-[0_0_25px_rgba(212,241,93,0.35)]',
    secondary: 'bg-citron/20 text-citron border border-citron/30 hover:bg-citron/30',
    outline: 'border border-white/10 text-text-secondary hover:text-text-primary hover:border-citron/40 hover:bg-forest-mid/80',
    ghost: 'text-text-muted hover:text-text-primary hover:bg-white/5',
    icon: 'p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-white/5',
  }[variant];

  return (
    <button
      ref={buttonRef}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-full transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${variant !== 'icon' ? sizeClasses : ''} ${variantClasses} ${classNames.root || ''} ${className}`}
      {...rest}
    >
      {leftIcon && <span className={`inline-flex shrink-0 ${classNames.leftIcon || ''}`}>{leftIcon}</span>}
      {children && <span className={`truncate ${classNames.content || ''}`}>{children}</span>}
      {rightIcon && <span className={`inline-flex shrink-0 ${classNames.rightIcon || ''}`}>{rightIcon}</span>}
    </button>
  );
};
