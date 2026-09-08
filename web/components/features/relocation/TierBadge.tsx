import { Badge, type BadgeSize } from '@/components/ui';
import type { Tier } from '@/lib/api/types';

import { TIER_LABELS, TIER_VARIANTS } from './constants';

export interface TierBadgeProps {
  tier?: Tier | null;
  size?: BadgeSize;
  /** Overrides the label derived from the tier. */
  label?: React.ReactNode;
  className?: string;
}

/** Triage tier as a colour-coded badge; unscored habitations read as unknown rather than safe. */
export const TierBadge = ({ tier, size = 'sm', label, className = '' }: TierBadgeProps) => (
  <Badge
    variant={tier ? TIER_VARIANTS[tier] : 'unknown'}
    size={size}
    className={className}
    title={tier ? `Triage tier: ${TIER_LABELS[tier]}` : 'Habitation has not been triaged'}
  >
    {label ?? (tier ? TIER_LABELS[tier] : 'Untriaged')}
  </Badge>
);
