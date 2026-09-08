'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface PriorityRegionCardProps {
  /** Inspect Guidance callback */
  onInspectGuidance?: () => void;
  /** Custom root className */
  className?: string;
}

export const PriorityRegionCard: React.FC<PriorityRegionCardProps> = ({
  onInspectGuidance,
  className = '',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!cardRef.current) return;
    const el = cardRef.current;

    const onEnter = () => {
      gsap.to(el, {
        y: -3,
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 25px rgba(212, 241, 93, 0.2)',
        borderColor: 'rgba(212, 241, 93, 0.45)',
        duration: 0.28,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    };
    const onLeave = () => {
      gsap.to(el, {
        y: 0,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.09)',
        duration: 0.28,
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
    <div className={`fixed bottom-24 right-6 z-20 pointer-events-auto hidden lg:block max-w-sm w-full ${className}`}>
      <div
        ref={cardRef}
        className="glass-card p-4 rounded-2xl border border-white/10 flex items-center space-x-3.5 transition-colors"
      >
        <div className="flex-1">
          <div className="flex items-center space-x-1.5 text-[10px] font-mono text-citron font-medium tracking-wider uppercase mb-1">
            <span>:: REGION FOCUS</span>
            <span className="text-text-dim">•</span>
            <span>HIGH PRIORITY</span>
          </div>
          <h4 className="font-display font-bold text-white text-base leading-snug">
            Himalayan Resilience Corridor
          </h4>
          <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
            2,847 historical landslide events indexed. Predictive radar active.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={onInspectGuidance}
              className="text-xs font-semibold text-citron hover:text-citron-hover flex items-center gap-1 transition-colors cursor-pointer hover:scale-105 active:scale-95"
            >
              Inspect Guidance <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Thumbnail */}
        <div className="w-24 h-20 rounded-xl overflow-hidden relative border border-white/15 shrink-0 bg-forest-surface">
          <img
            src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=300&q=80"
            alt="Mountain terrain"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-1 right-1.5 text-[9px] font-mono text-citron font-bold">
            2.8k EV
          </div>
        </div>
      </div>
    </div>
  );
};
