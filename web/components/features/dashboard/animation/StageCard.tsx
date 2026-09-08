'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { AnimationStage } from './types';

export interface StageCardProps {
  stage: AnimationStage;
  isActive: boolean;
  isPast: boolean;
  progressPercent: number; // 0 to 100% within this stage
  onClick: (stage: AnimationStage) => void;
  className?: string;
}

export const StageCard: React.FC<StageCardProps> = ({
  stage,
  isActive,
  isPast,
  progressPercent,
  onClick,
  className = '',
}) => {
  const cardRef = useRef<HTMLButtonElement>(null);

  useGSAP(() => {
    if (!cardRef.current) return;
    const el = cardRef.current;

    const onEnter = () => {
      gsap.to(el, { y: -2, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
    };
    const onLeave = () => {
      gsap.to(el, { y: 0, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, { scope: cardRef });

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={() => onClick(stage)}
      className={`relative flex-1 min-w-[130px] p-2 sm:p-2.5 rounded-lg border text-left transition-all duration-200 cursor-pointer overflow-hidden select-none ${
        isActive
          ? 'bg-gov-surface-light dark:bg-gov-surface border-gov-amber shadow-md ring-1 ring-gov-amber/40'
          : isPast
          ? 'bg-gov-surface-light/70 dark:bg-gov-surface/70 border-gov-border/30 hover:border-gov-border'
          : 'bg-gov-surface-light/40 dark:bg-gov-surface/40 border-gov-border/15 opacity-70 hover:opacity-100 hover:border-gov-border/30'
      } ${className}`}
      title={stage.summary}
    >
      {/* Top Header: Step & Timestamp */}
      <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono tracking-wider">
        <span
          className={`font-bold ${
            isActive ? 'text-gov-amber' : isPast ? 'text-gov-sage-light' : 'text-gov-bg/50 dark:text-cream/50'
          }`}
        >
          {stage.id}. {stage.title.toUpperCase()}
        </span>
        <span className="text-gov-bg/60 dark:text-cream/60 font-medium">
          {stage.timestampLabel}
        </span>
      </div>

      {/* Subtitle / Short description */}
      <p className="text-[10px] text-gov-bg/75 dark:text-cream/75 mt-1 line-clamp-2 leading-snug font-sans">
        {stage.shortDescription}
      </p>

      {/* Active Stage Progress Bar */}
      <div className="mt-2 h-1 w-full bg-gov-bg/10 dark:bg-gov-bg-light/10 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-100 ${
            isActive
              ? 'bg-gov-amber'
              : isPast
              ? 'bg-gov-sage'
              : 'bg-transparent'
          }`}
          style={{
            width: isActive ? `${Math.min(Math.max(progressPercent, 0), 100)}%` : isPast ? '100%' : '0%',
          }}
        />
      </div>
    </button>
  );
};

export default StageCard;
