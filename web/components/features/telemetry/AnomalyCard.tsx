'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface AnomalyCardProps {
  /** Target hotspot / locate callback */
  onLocateTarget?: () => void;
  /** Custom root className */
  className?: string;
}

export const AnomalyCard: React.FC<AnomalyCardProps> = ({
  onLocateTarget,
  className = '',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!cardRef.current) return;
    const el = cardRef.current;

    const onEnter = () => {
      gsap.to(el, {
        y: -3,
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 25px rgba(239, 68, 68, 0.25)',
        borderColor: 'rgba(239, 68, 68, 0.45)',
        duration: 0.28,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    };
    const onLeave = () => {
      gsap.to(el, {
        y: 0,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.2)',
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
    <div className={`fixed top-20 right-6 z-20 max-w-xs w-full pointer-events-auto ${className}`}>
      <div
        ref={cardRef}
        className="glass-card p-4 rounded-2xl border border-hazard-red/20 transition-colors"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-hazard-red animate-ping" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-hazard-red font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">warning</span> Seismic Shift Alert
            </span>
          </div>
          <span className="text-[10px] font-mono text-text-muted">Live</span>
        </div>
        <div className="text-sm font-semibold text-white tracking-tight">Sector 7G — Himalayan Arc</div>
        <p className="text-xs text-text-muted mt-1 leading-relaxed">
          Slip rate anomaly: <span className="text-hazard-amber font-mono">4.2mm/yr</span>. Soil saturation index critical in Uttarakhand foothills.
        </p>
        <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <button
            onClick={onLocateTarget}
            className="text-[11px] text-citron hover:text-citron-hover font-mono flex items-center gap-1 transition-colors cursor-pointer hover:scale-105 active:scale-95"
          >
            Locate Target <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </button>
          <span className="text-[10px] font-mono text-text-dim">Sensor INSAT-3DR</span>
        </div>
      </div>
    </div>
  );
};
