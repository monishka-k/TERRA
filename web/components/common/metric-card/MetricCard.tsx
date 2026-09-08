'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface MetricCardProps {
  /** Numeric or string metric value */
  value: number | string;
  /** Label describing the metric */
  label: React.ReactNode;
  /** Optional prefix (e.g. '₹') */
  prefix?: string;
  /** Optional suffix (e.g. ' Cr', 'M+') */
  suffix?: string;
  /** Visual intent / severity color */
  variant?: 'emerald' | 'cyan' | 'amber' | 'rose';
  /** Animate number tweening when mounted or value changes */
  animateNumber?: boolean;
  /** Enable hover lift microinteraction */
  hoverLift?: boolean;
  /** Custom root className */
  className?: string;
  /** Granular styling overrides */
  classNames?: {
    root?: string;
    value?: string;
    label?: string;
  };
}

export const MetricCard: React.FC<MetricCardProps> = ({
  value,
  label,
  prefix = '',
  suffix = '',
  variant = 'emerald',
  animateNumber = true,
  hoverLift = true,
  className = '',
  classNames = {},
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!cardRef.current) return;

    // Hover Lift Microinteraction (Rule #3: y: -3px, shadow expansion, border glow)
    if (hoverLift) {
      const card = cardRef.current;
      const onEnter = () => {
        gsap.to(card, {
          y: -3,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 25px rgba(212, 241, 93, 0.2)',
          borderColor: 'rgba(212, 241, 93, 0.45)',
          duration: 0.28,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      };
      const onLeave = () => {
        gsap.to(card, {
          y: 0,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          borderColor: 'rgba(255, 255, 255, 0.09)',
          duration: 0.28,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      };

      card.addEventListener('mouseenter', onEnter);
      card.addEventListener('mouseleave', onLeave);

      return () => {
        card.removeEventListener('mouseenter', onEnter);
        card.removeEventListener('mouseleave', onLeave);
      };
    }
  }, { scope: cardRef, dependencies: [hoverLift] });

  // Number Tweening Animation (Rule #3)
  useGSAP(() => {
    if (!valueRef.current || !animateNumber || typeof value !== 'number') return;

    const targetVal = value;
    const counterObj = { val: 0 };
    const el = valueRef.current;

    gsap.to(counterObj, {
      val: targetVal,
      duration: 1.2,
      ease: 'power2.out',
      onUpdate: () => {
        el.innerText = `${prefix}${Math.floor(counterObj.val).toLocaleString()}${suffix}`;
      },
    });
  }, { scope: cardRef, dependencies: [value, animateNumber] });

  const colorStyles = {
    emerald: 'text-citron border-citron/20',
    cyan: 'text-accent-emerald-light border-accent-emerald-light/20',
    amber: 'text-hazard-amber border-hazard-amber/20',
    rose: 'text-hazard-red border-hazard-red/20',
  }[variant];

  return (
    <div
      ref={cardRef}
      className={`glass-card p-3 rounded-xl border ${colorStyles.split(' ')[1]} ${classNames.root || ''} ${className}`}
    >
      <div
        ref={valueRef}
        className={`font-display font-extrabold text-lg sm:text-xl ${colorStyles.split(' ')[0]} ${classNames.value || ''}`}
      >
        {typeof value === 'number' && animateNumber ? '0' : `${prefix}${value}${suffix}`}
      </div>
      <div className={`text-[10px] sm:text-xs text-text-muted mt-0.5 ${classNames.label || ''}`}>
        {label}
      </div>
    </div>
  );
};
