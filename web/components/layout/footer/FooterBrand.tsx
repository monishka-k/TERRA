'use client';

import React from 'react';
import Link from 'next/link';

export interface FooterBrandProps {
  /** Optional custom className */
  className?: string;
}

export const FooterBrand: React.FC<FooterBrandProps> = ({ className = '' }) => {
  return (
    <div className={`flex flex-col items-start gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 group transition-transform active:scale-95"
        >
          {/* Emblem Crest */}
          <div className="w-8 h-8 rounded-lg bg-surface-1 dark:bg-forest-deep border border-line dark:border-white/15 flex items-center justify-center font-serif font-black text-sm text-ochre shadow-sm">
            सं
          </div>
          <div className="flex flex-col">
            <span className="font-display font-black text-sm tracking-tight text-ink dark:text-text-primary group-hover:text-accent transition-colors">
              SETU-DRR
            </span>
            <span className="text-[10px] font-mono tracking-wider uppercase text-text-muted">
              Planetary Resilience Command
            </span>
          </div>
        </Link>

        {/* Live Status Pill */}
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-safe/10 border border-safe/30 text-safe">
          <span className="w-1.5 h-1.5 rounded-full bg-safe animate-pulse" />
          SYSTEM NOMINAL
        </span>
      </div>

      <p className="text-xs text-text-muted max-w-sm leading-relaxed">
        Disaster Management Division · Ministry of Home Affairs · Government of India.
        Autonomous spatial hazard analytics and relocation corridors.
      </p>
    </div>
  );
};
