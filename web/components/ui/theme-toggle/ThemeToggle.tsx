'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTheme, type ResolvedTheme } from '@/components/providers';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

export type ThemeToggleVariant = 'pill' | 'button' | 'icon';
export type ThemeToggleSize = 'sm' | 'md' | 'lg';

export interface ThemeToggleProps {
  /** Visual presentation style of the toggle */
  variant?: ThemeToggleVariant;
  /** Size scale */
  size?: ThemeToggleSize;
  /** Whether to render label text alongside the icon */
  showLabel?: boolean;
  /** Custom label when in dark mode (suggesting switch to light mode) */
  darkLabel?: React.ReactNode;
  /** Custom label when in light mode (suggesting switch to dark mode) */
  lightLabel?: React.ReactNode;
  /** Accessible title / tooltip */
  title?: string;
  /** Additional CSS classes for root element */
  className?: string;
  /** Granular styling overrides for inner sub-elements */
  classNames?: {
    root?: string;
    iconWrapper?: string;
    label?: string;
  };
  /** Microinteraction animation tuning */
  animation?: {
    disabled?: boolean;
    duration?: number;
  };
  /** Callback fired after theme toggle */
  onToggle?: (nextTheme: ResolvedTheme) => void;
}

const VARIANT_CLASSES: Record<ThemeToggleVariant, string> = {
  pill: 'capsule-pill rounded-full border border-line text-ink hover:border-accent/40 bg-surface-1/80 hover:bg-surface-2 transition-all shadow-xs',
  button: 'rounded-xl border border-line bg-surface-1 hover:bg-surface-2 text-ink transition-all shadow-xs',
  icon: 'rounded-full border border-line bg-surface-1/90 hover:bg-surface-2 text-ink transition-all shadow-xs aspect-square',
};

const SIZE_CLASSES: Record<ThemeToggleSize, { root: string; icon: string; text: string }> = {
  sm: {
    root: 'h-7 px-2.5 text-[11px] gap-1.5',
    icon: 'text-xs',
    text: 'text-[10px] font-mono',
  },
  md: {
    root: 'h-9 px-3 text-xs gap-2',
    icon: 'text-sm',
    text: 'text-xs font-mono font-medium',
  },
  lg: {
    root: 'h-11 px-4 text-sm gap-2.5',
    icon: 'text-base',
    text: 'text-sm font-mono font-medium',
  },
};

const ICON_SIZE_CLASSES: Record<ThemeToggleSize, string> = {
  sm: 'w-7 h-7 p-1',
  md: 'w-9 h-9 p-1.5',
  lg: 'w-11 h-11 p-2',
};

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'button',
  size = 'md',
  showLabel = true,
  darkLabel = 'Light Mode',
  lightLabel = 'Dark Mode',
  title,
  className = '',
  classNames = {},
  animation = {},
  onToggle,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const rootRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const isDark = resolvedTheme === 'dark';
  const { disabled: animationDisabled = false, duration = 0.32 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  // Icon rotation & scale morph animation on theme change
  useGSAP(
    () => {
      if (!animate || !iconRef.current) return;
      gsap.fromTo(
        iconRef.current,
        { rotation: isDark ? -75 : 75, scale: 0.72, opacity: 0.6 },
        {
          rotation: 0,
          scale: 1,
          opacity: 1,
          duration,
          ease: 'back.out(1.8)',
          overwrite: 'auto',
        }
      );
    },
    { scope: rootRef, dependencies: [resolvedTheme, animate, duration] }
  );

  // Tactile press microinteraction
  useGSAP(
    () => {
      if (!animate || !rootRef.current) return;
      const el = rootRef.current;

      const onEnter = () => gsap.to(el, { scale: 1.03, duration: 0.16, ease: 'power2.out', overwrite: 'auto' });
      const onLeave = () => gsap.to(el, { scale: 1, duration: 0.16, ease: 'power2.out', overwrite: 'auto' });
      const onDown = () => gsap.to(el, { scale: 0.96, duration: 0.1, ease: 'power2.out', overwrite: 'auto' });

      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
      el.addEventListener('mousedown', onDown);
      el.addEventListener('mouseup', onEnter);

      return () => {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mouseleave', onLeave);
        el.removeEventListener('mousedown', onDown);
        el.removeEventListener('mouseup', onEnter);
      };
    },
    { scope: rootRef, dependencies: [animate] }
  );

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const nextTheme: ResolvedTheme = isDark ? 'light' : 'dark';
    toggleTheme();
    onToggle?.(nextTheme);
  };

  const defaultTitle = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  const labelText = isDark ? darkLabel : lightLabel;

  const isIconOnly = variant === 'icon' || !showLabel;

  return (
    <button
      ref={rootRef}
      type="button"
      onClick={handleClick}
      aria-label={title || defaultTitle}
      title={title || defaultTitle}
      className={[
        'inline-flex items-center justify-center cursor-pointer select-none will-change-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
        VARIANT_CLASSES[variant],
        isIconOnly ? ICON_SIZE_CLASSES[size] : SIZE_CLASSES[size].root,
        classNames.root ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        ref={iconRef}
        className={[
          'material-symbols-outlined flex items-center justify-center transition-colors',
          SIZE_CLASSES[size].icon,
          isDark ? 'text-amber-300' : 'text-sky-600',
          classNames.iconWrapper ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isDark ? 'light_mode' : 'dark_mode'}
      </span>

      {!isIconOnly && labelText ? (
        <span className={[SIZE_CLASSES[size].text, classNames.label ?? ''].filter(Boolean).join(' ')}>
          {labelText}
        </span>
      ) : null}
    </button>
  );
};

export default ThemeToggle;
