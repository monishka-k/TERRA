import { Badge, type BadgeSize } from '@/components/ui';
import type { BindingConstraint } from '@/lib/api/types';

import { CONSTRAINT_HINTS, CONSTRAINT_LABELS } from './constants';

export interface BindingConstraintBadgeProps {
  constraint?: BindingConstraint | null;
  /** Other dimensions capping the site at the same value. */
  tiedConstraints?: BindingConstraint[];
  size?: BadgeSize;
  className?: string;
}

/** Names the resource that caps a site — the single most decision-relevant fact about it. */
export const BindingConstraintBadge = ({
  constraint,
  tiedConstraints = [],
  size = 'sm',
  className = '',
}: BindingConstraintBadgeProps) => {
  if (!constraint) {
    return (
      <Badge variant="unknown" size={size} className={className} title="No capacity dimension resolved">
        Capacity unresolved
      </Badge>
    );
  }

  const ties = tiedConstraints.filter((tied) => tied !== constraint);
  const label = ties.length
    ? `${CONSTRAINT_LABELS[constraint]} + ${ties.map((tied) => CONSTRAINT_LABELS[tied]).join(' + ')}`
    : CONSTRAINT_LABELS[constraint];

  return (
    <Badge variant="warning" size={size} className={className} title={CONSTRAINT_HINTS[constraint]}>
      {label}-limited
    </Badge>
  );
};
