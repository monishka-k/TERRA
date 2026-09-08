'use client';

import React from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export interface FooterTelemetryProps {
  /** Optional custom className */
  className?: string;
}

export const FooterTelemetry: React.FC<FooterTelemetryProps> = ({
  className = '',
}) => {
  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 sm:gap-4 ${className}`}>
      {/* 24/7 Emergency NDRF Hotline Pill */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-critical/10 border border-critical/30 text-[11px] font-mono text-critical">
        <span className="w-2 h-2 rounded-full bg-critical animate-ping" />
        <span className="font-bold">NDRF 24/7:</span>
        <span>1078 / +91-11-26701728</span>
      </div>

      {/* Release version badge */}
      <span className="hidden md:inline-block px-2.5 py-1 text-[10px] font-mono font-semibold tracking-wider uppercase rounded-md bg-surface-1 dark:bg-forest-deep border border-line dark:border-white/10 text-text-muted">
        v2.4-ORBITAL
      </span>

      {/* Theme Toggle */}
      <ThemeToggle variant="button" size="sm" showLabel={false} />

      {/* Back to top button */}
      <button
        type="button"
        onClick={handleScrollToTop}
        className="px-3 py-1.5 rounded-full text-xs font-mono font-medium text-text-muted hover:text-ink dark:hover:text-text-primary bg-surface-1 dark:bg-forest-deep/80 border border-line dark:border-white/10 hover:border-line-strong transition-all active:scale-95 cursor-pointer"
        aria-label="Scroll back to top"
      >
        Top ↑
      </button>
    </div>
  );
};
