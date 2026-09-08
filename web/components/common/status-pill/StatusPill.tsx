'use client';

import React from 'react';

export interface StatusPillProps {
  /** Text label */
  label: React.ReactNode;
  /** Optional prefix icon or text (e.g. '✦ ::') */
  prefix?: React.ReactNode;
  /** Whether the ping pulse is active */
  live?: boolean;
  /** Visual color theme */
  variant?: 'emerald' | 'cyan' | 'amber' | 'rose';
  /** Custom root className */
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  label,
  prefix = '✦ ::',
  live = true,
  variant = 'emerald',
  className = '',
}) => {
  const colorStyles = {
    emerald: 'text-citron bg-citron',
    cyan: 'text-accent-emerald-light bg-accent-emerald-light',
    amber: 'text-hazard-amber bg-hazard-amber',
    rose: 'text-hazard-red bg-hazard-red',
  }[variant];

  return (
    <div className={`pill-badge px-3.5 py-1.5 rounded-full inline-flex items-center space-x-2.5 shadow-lg border border-white/10 ${className}`}>
      {prefix && <span className={`text-xs font-bold tracking-widest font-mono ${colorStyles.split(' ')[0]}`}>{prefix}</span>}
      <span className="text-xs font-medium text-text-primary">{label}</span>
      {live && (
        <span className={`w-1.5 h-1.5 rounded-full ${colorStyles.split(' ')[1]} animate-ping`} />
      )}
    </div>
  );
};
