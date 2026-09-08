'use client';

import React from 'react';

export interface ScrollIndicatorProps {
  /** Target section id to scroll into on click (default 'triage-engine') */
  targetId?: string;
  /** Custom label */
  label?: string;
  /** Custom className */
  className?: string;
}

export const ScrollIndicator: React.FC<ScrollIndicatorProps> = ({
  targetId = 'triage-engine',
  label = 'Scroll to explore platform telemetry',
  className = '',
}) => {
  const handleScrollDown = () => {
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
    }
  };

  return (
    <button
      type="button"
      onClick={handleScrollDown}
      className={`group inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface-0/60 dark:bg-forest-surface/60 backdrop-blur-md border border-line dark:border-white/10 text-[11px] font-mono font-medium text-text-muted hover:text-ink dark:hover:text-text-primary transition-all duration-300 hover:border-line-strong dark:hover:border-white/20 cursor-pointer ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
      <span>{label}</span>
      <span className="text-xs transition-transform duration-300 group-hover:translate-y-0.5">
        ↓
      </span>
    </button>
  );
};
