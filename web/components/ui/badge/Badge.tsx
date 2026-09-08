'use client';

import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Visual severity / theme */
  variant?: 'emerald' | 'cyan' | 'amber' | 'rose' | 'slate';
  /** Optional animated ping dot */
  ping?: boolean;
  /** Size dimension */
  size?: 'sm' | 'md';
  /** Custom root className */
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'emerald',
  ping = false,
  size = 'md',
  className = '',
  ...rest
}) => {
  const colorStyles = {
    emerald: {
      bg: 'bg-citron/15 text-citron border-citron/30',
      dot: 'bg-citron',
    },
    cyan: {
      bg: 'bg-accent-emerald-light/15 text-accent-emerald-light border-accent-emerald-light/30',
      dot: 'bg-accent-emerald-light',
    },
    amber: {
      bg: 'bg-hazard-amber/15 text-hazard-amber border-hazard-amber/30',
      dot: 'bg-hazard-amber',
    },
    rose: {
      bg: 'bg-hazard-red/15 text-hazard-red border-hazard-red/30',
      dot: 'bg-hazard-red',
    },
    slate: {
      bg: 'bg-forest-mid text-text-secondary border-white/10',
      dot: 'bg-text-muted',
    },
  }[variant];

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-mono border ${colorStyles.bg} ${sizeStyles} ${className}`}
      {...rest}
    >
      <span className="relative flex h-1.5 w-1.5">
        {ping && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colorStyles.dot}`} />
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${colorStyles.dot}`} />
      </span>
      {children}
    </span>
  );
};
