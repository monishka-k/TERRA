import type { ReactNode } from 'react';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import type { CoverageFlag } from '@/lib/api/types';
import { COVERAGE_DESCRIPTIONS, COVERAGE_LABELS } from '@/lib/map/constants';

export interface CoverageStatusPillProps {
  flag: CoverageFlag;
  /** Overrides the default label for the flag. */
  label?: ReactNode;
  showDescription?: boolean;
  className?: string;
}

const FLAG_VARIANTS: Record<CoverageFlag, BadgeVariant> = {
  full: 'safe',
  low_coverage: 'warning',
  no_coverage: 'unknown',
};

/**
 * Renders coverage provenance as a pill.
 *
 * `no_coverage` deliberately gets the dashed "unknown" treatment rather than a safe colour:
 * its 0.00 susceptibility is a NaN fill from the pipeline, not an observation.
 */
export const CoverageStatusPill = ({
  flag,
  label,
  showDescription = false,
  className = '',
}: CoverageStatusPillProps) => (
  <Badge
    variant={FLAG_VARIANTS[flag]}
    title={showDescription ? COVERAGE_DESCRIPTIONS[flag] : undefined}
    className={className}
  >
    {label ?? COVERAGE_LABELS[flag]}
  </Badge>
);
