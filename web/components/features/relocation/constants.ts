/** Shared vocabulary for the relocation workspace: tiers, constraints and their presentation. */

import type { BadgeVariant } from '@/components/ui';
import type { BindingConstraint, Tier } from '@/lib/api/types';

export const TIER_LABELS: Record<Tier, string> = {
  immediate: 'Immediate',
  short_term: 'Short term',
  medium_term: 'Medium term',
  mitigate_in_situ: 'Mitigate in situ',
};

export const TIER_VARIANTS: Record<Tier, BadgeVariant> = {
  immediate: 'critical',
  short_term: 'warning',
  medium_term: 'info',
  mitigate_in_situ: 'safe',
};

export const CONSTRAINT_LABELS: Record<BindingConstraint, string> = {
  land: 'Land',
  water: 'Water',
  school: 'School',
  health: 'Health',
};

/** What each capacity dimension is derived from, for the planner reading the number. */
export const CONSTRAINT_HINTS: Record<BindingConstraint, string> = {
  land: 'Developable area ÷ area norm per household',
  water: 'Sustainable yield ÷ CPHEEO litres per capita per day',
  school: 'Spare school seats ÷ school-age children per household',
  health: 'Spare health-centre catchment ÷ mean household size',
};

export const TENURE_LABELS: Record<string, string> = {
  government_revenue: 'Government revenue land',
  private: 'Private land',
  tenure_unverified: 'Tenure unverified',
};

/** Distinguishes a measured capacity from one the site simply has no data for. */
export const UNMEASURED_LABEL = 'Not measured';
