'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface PrepActionCardProps {
  title: string;
  description: string;
  icon: string;
  iconBgClass?: string;
  iconColorClass?: string;
  className?: string;
}

export const PrepActionCard: React.FC<PrepActionCardProps> = ({
  title,
  description,
  icon,
  iconBgClass = 'bg-citron/15',
  iconColorClass = 'text-citron',
  className = '',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!cardRef.current) return;
    const el = cardRef.current;

    const onEnter = () => {
      gsap.to(el, {
        y: -3,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 20px rgba(212, 241, 93, 0.15)',
        borderColor: 'rgba(212, 241, 93, 0.4)',
        duration: 0.25,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    };
    const onLeave = () => {
      gsap.to(el, {
        y: 0,
        boxShadow: 'none',
        clearProps: 'borderColor',
        duration: 0.25,
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

  return (
    <div
      ref={cardRef}
      className={`prep-card-item glass-card p-4 rounded-xl border border-line dark:border-white/10 transition-colors select-none ${className}`}
    >
      <div className={`w-8 h-8 rounded-lg ${iconBgClass} ${iconColorClass} flex items-center justify-center mb-2.5`}>
        <span className="material-symbols-outlined text-lg">{icon}</span>
      </div>
      <div className="font-semibold text-ink dark:text-white text-sm">{title}</div>
      <p className="text-xs text-text-secondary dark:text-text-muted mt-1 leading-relaxed">{description}</p>
    </div>
  );
};
