'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface ProgressBarProps {
  /** Progress percentage value (0 to 100) */
  progress: number;
  /** Visual theme */
  variant?: 'emerald' | 'cyan' | 'gradient';
  /** Optional height class */
  heightClassName?: string;
  /** Custom root className */
  className?: string;
  /** Granular styling overrides */
  classNames?: {
    root?: string;
    track?: string;
    bar?: string;
  };
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  variant = 'gradient',
  heightClassName = 'h-2',
  className = '',
  classNames = {},
}) => {
  const barRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!barRef.current) return;
    gsap.to(barRef.current, {
      width: `${Math.min(Math.max(progress, 0), 100)}%`,
      duration: 0.35,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }, { scope: barRef, dependencies: [progress] });

  const gradientStyles = {
    emerald: 'bg-citron shadow-[0_0_12px_rgba(212,241,93,0.7)]',
    cyan: 'bg-accent-emerald-light shadow-[0_0_12px_rgba(110,231,183,0.7)]',
    gradient: 'bg-gradient-to-r from-citron via-accent-emerald-bright to-citron shadow-[0_0_12px_rgba(212,241,93,0.5)]',
  }[variant];

  return (
    <div className={`w-full bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/5 ${classNames.track || ''} ${classNames.root || ''} ${className}`}>
      <div
        ref={barRef}
        style={{ width: `${progress}%` }}
        className={`${heightClassName} rounded-full transition-none ${gradientStyles} ${classNames.bar || ''}`}
      />
    </div>
  );
};
