'use client';

import React from 'react';

export interface DidYouKnowCardProps {
  /** Tip text */
  text?: string;
  /** Custom root className */
  className?: string;
}

export const DidYouKnowCard: React.FC<DidYouKnowCardProps> = ({
  text = "Over 65% of India's land area is prone to multiple hazards. Early topographical hazard maps reduce evacuation casualties by up to 78%.",
  className = '',
}) => {
  return (
    <div className={`glass-card p-4 rounded-xl border border-line dark:border-white/10 bg-surface-1/60 dark:bg-forest-surface/40 ${className}`}>
      <div className="flex items-start space-x-3">
        <span className="material-symbols-outlined text-hazard-amber text-lg">lightbulb</span>
        <div>
          <div className="text-xs font-semibold text-ink dark:text-white">Did you know?</div>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
};
