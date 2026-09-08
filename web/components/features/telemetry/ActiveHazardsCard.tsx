'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Pill } from '@/components/ui/pill';
import { ProgressBar } from '@/components/ui/progress';

export interface ActiveHazardsCardProps {
  /** Callback when a hazard category is selected */
  onSelectHazard: (type: 'landslide' | 'flood' | 'cloudburst' | 'earthquake') => void;
  /** Custom root className */
  className?: string;
}

export const ActiveHazardsCard: React.FC<ActiveHazardsCardProps> = ({
  onSelectHazard,
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
    <div className={`fixed bottom-24 left-4 sm:left-20 z-20 pointer-events-auto hidden md:block max-w-xs w-full ${className}`}>
      <div ref={cardRef} className="glass-card p-4 rounded-2xl transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-citron font-medium">
            :: ACTIVE HAZARDS
          </span>
          <span className="text-[10px] font-mono text-text-muted">5 Monitored</span>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Pill
            interactive
            variant="emerald"
            onClick={() => onSelectHazard('landslide')}
            leftSlot={<span className="w-1.5 h-1.5 rounded-full bg-citron" />}
          >
            Landslide
          </Pill>
          <Pill
            interactive
            variant="cyan"
            onClick={() => onSelectHazard('flood')}
            leftSlot={<span className="w-1.5 h-1.5 rounded-full bg-accent-emerald-light" />}
          >
            Flood
          </Pill>
          <Pill
            interactive
            variant="amber"
            onClick={() => onSelectHazard('cloudburst')}
            leftSlot={<span className="w-1.5 h-1.5 rounded-full bg-hazard-amber" />}
          >
            Cloudburst
          </Pill>
          <Pill
            interactive
            variant="rose"
            onClick={() => onSelectHazard('earthquake')}
            leftSlot={<span className="w-1.5 h-1.5 rounded-full bg-hazard-red" />}
          >
            Seismic
          </Pill>
        </div>

        {/* Data Integrity */}
        <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
          <span className="text-text-muted font-mono">Data Integrity</span>
          <span className="text-citron font-mono font-semibold">99.8% Nominal</span>
        </div>
        <div className="mt-1.5">
          <ProgressBar progress={99.8} variant="gradient" heightClassName="h-1.5" />
        </div>
      </div>
    </div>
  );
};
