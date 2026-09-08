'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface PillProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual variant */
  variant?: 'default' | 'emerald' | 'cyan' | 'amber' | 'rose';
  /** Optional icon or indicator on left */
  leftSlot?: React.ReactNode;
  /** Optional right slot */
  rightSlot?: React.ReactNode;
  /** Whether the pill is interactive (clickable) */
  interactive?: boolean;
  /** Active state for toggling */
  active?: boolean;
  /** Custom root className */
  className?: string;
  /** Granular styling overrides */
  classNames?: {
    root?: string;
    content?: string;
  };
}

export const Pill: React.FC<PillProps> = ({
  children,
  variant = 'default',
  leftSlot,
  rightSlot,
  interactive = false,
  active = false,
  className = '',
  classNames = {},
  onClick,
  ...rest
}) => {
  const pillRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!interactive || !pillRef.current) return;

    const el = pillRef.current;
    const onEnter = () => gsap.to(el, { scale: 1.04, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
    const onLeave = () => gsap.to(el, { scale: 1.0, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
    const onDown = () => gsap.to(el, { scale: 0.96, duration: 0.1, ease: 'power2.in', overwrite: 'auto' });

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('mousedown', onDown);

    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('mousedown', onDown);
    };
  }, { scope: pillRef, dependencies: [interactive] });

  const variantStyles = {
    default: 'border-white/10 text-text-secondary hover:border-white/20',
    emerald: active ? 'bg-citron/20 text-citron border-citron/30' : 'text-citron border-citron/30 hover:bg-citron/10',
    cyan: active ? 'bg-accent-emerald-light/20 text-accent-emerald-light border-accent-emerald-light/30' : 'text-accent-emerald-light border-accent-emerald-light/30 hover:bg-accent-emerald-light/10',
    amber: active ? 'bg-hazard-amber/20 text-hazard-amber border-hazard-amber/30' : 'text-hazard-amber border-hazard-amber/30 hover:bg-hazard-amber/10',
    rose: active ? 'bg-hazard-red/20 text-hazard-red border-hazard-red/30' : 'text-hazard-red border-hazard-red/30 hover:bg-hazard-red/10',
  }[variant];

  return (
    <div
      ref={pillRef}
      onClick={onClick}
      className={`pill-badge inline-flex items-center px-3 py-1 rounded-full text-xs font-mono select-none ${interactive ? 'cursor-pointer' : ''} ${variantStyles} ${classNames.root || ''} ${className}`}
      {...rest}
    >
      {leftSlot && <span className="inline-flex items-center mr-1.5 shrink-0">{leftSlot}</span>}
      <span className={`truncate ${classNames.content || ''}`}>{children}</span>
      {rightSlot && <span className="inline-flex items-center ml-1.5 shrink-0">{rightSlot}</span>}
    </div>
  );
};
