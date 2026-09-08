import type { ReactNode } from 'react';

export type BadgeVariant = 'neutral' | 'critical' | 'warning' | 'safe' | 'info' | 'unknown';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Dot or glyph rendered before the label. */
  icon?: ReactNode;
  className?: string;
  classNames?: {
    root?: string;
    icon?: string;
    label?: string;
  };
  title?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'border-line bg-surface-2 text-ink-muted',
  critical: 'border-critical/45 bg-critical/12 text-critical',
  warning: 'border-warning/45 bg-warning/12 text-warning',
  safe: 'border-safe/45 bg-safe/12 text-safe',
  info: 'border-accent/45 bg-accent/12 text-accent',
  unknown: 'border-dashed border-ink-faint/60 bg-transparent text-ink-faint',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'h-[18px] px-1.5 text-[10px] gap-1',
  md: 'h-6 px-2 text-[11px] gap-1.5',
};

export const Badge = ({
  children,
  variant = 'neutral',
  size = 'sm',
  icon,
  className = '',
  classNames = {},
  title,
}: BadgeProps) => (
  <span
    title={title}
    className={[
      'inline-flex items-center rounded border font-medium uppercase tracking-wide whitespace-nowrap',
      VARIANT_CLASSES[variant],
      SIZE_CLASSES[size],
      classNames.root ?? '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {icon ? <span className={classNames.icon}>{icon}</span> : null}
    <span className={classNames.label}>{children}</span>
  </span>
);
