import { Badge } from '@/components/ui';
import type { AllocationPlanResponse, HabitationListItem } from '@/lib/api/types';

export interface RelocationHeaderMetaProps {
  totalHabitations?: number;
  selectedHabitation?: HabitationListItem | null;
  plan?: AllocationPlanResponse | null;
  className?: string;
}

/** Contextual chips for the workspace header: scope, selection, and last-run outcome. */
export const RelocationHeaderMeta = ({
  totalHabitations = 0,
  selectedHabitation = null,
  plan = null,
  className = '',
}: RelocationHeaderMetaProps) => (
  <span className={['contents', className].filter(Boolean).join(' ')}>
    {totalHabitations > 0 ? (
      <Badge variant="neutral">{totalHabitations.toLocaleString()} habitations</Badge>
    ) : null}
    {selectedHabitation ? <Badge variant="info">{selectedHabitation.name}</Badge> : null}
    {plan ? (
      <Badge
        variant={plan.unmet_demand_households > 0 ? 'warning' : 'safe'}
        title="Households the last run could not place"
      >
        {plan.unmet_demand_households.toLocaleString()} unmet
      </Badge>
    ) : null}
  </span>
);
