'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface HazardCardProps {
  title: string;
  subtitle: string;
  icon: string;
  colorScheme: 'emerald' | 'cyan' | 'amber' | 'teal' | 'rose';
  onClick?: () => void;
  className?: string;
}

export const HazardCard: React.FC<HazardCardProps> = ({
  title,
  subtitle,
  icon,
  colorScheme,
  onClick,
  className = '',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!cardRef.current) return;
    const el = cardRef.current;

    const onEnter = () => {
      gsap.to(el, {
        y: -2,
        boxShadow: '0 15px 40px rgba(0, 0, 0, 0.7)',
        duration: 0.22,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    };
    const onLeave = () => {
      gsap.to(el, {
        y: 0,
        boxShadow: 'none',
        duration: 0.22,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, { scope: cardRef });

  const colorStyles = {
    emerald: {
      iconBg: 'bg-citron/15 text-citron',
      border: 'border-citron/40 dark:border-citron/30',
      hoverText: 'group-hover:text-citron',
      chevronHover: 'group-hover:text-citron',
    },
    cyan: {
      iconBg: 'bg-accent-emerald-light/15 text-accent-emerald-light',
      border: 'border-line dark:border-white/5',
      hoverText: 'group-hover:text-accent-emerald-light',
      chevronHover: 'group-hover:text-accent-emerald-light',
    },
    amber: {
      iconBg: 'bg-hazard-amber/15 text-hazard-amber',
      border: 'border-line dark:border-white/5',
      hoverText: 'group-hover:text-hazard-amber',
      chevronHover: 'group-hover:text-hazard-amber',
    },
    teal: {
      iconBg: 'bg-accent-emerald-bright/15 text-accent-emerald-bright',
      border: 'border-line dark:border-white/5',
      hoverText: 'group-hover:text-accent-emerald-bright',
      chevronHover: 'group-hover:text-accent-emerald-bright',
    },
    rose: {
      iconBg: 'bg-hazard-red/15 text-hazard-red',
      border: 'border-line dark:border-white/5',
      hoverText: 'group-hover:text-hazard-red',
      chevronHover: 'group-hover:text-hazard-red',
    },
  }[colorScheme];

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={`hazard-card-item glass-card p-3.5 rounded-xl border ${colorStyles.border} cursor-pointer flex items-center justify-between group transition-all select-none ${className}`}
    >
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-lg ${colorStyles.iconBg} flex items-center justify-center font-bold shrink-0`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div>
          <div className={`text-sm font-semibold text-ink dark:text-white ${colorStyles.hoverText} transition-colors`}>
            {title}
          </div>
          <div className="text-xs text-text-muted">{subtitle}</div>
        </div>
      </div>
      <span className={`material-symbols-outlined text-text-muted ${colorStyles.chevronHover} group-hover:translate-x-1 transition-all`}>
        chevron_right
      </span>
    </div>
  );
};
