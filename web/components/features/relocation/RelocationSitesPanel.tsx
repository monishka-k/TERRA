'use client';

import { EmptyState } from '@/components/common';
import { Button, Toggle } from '@/components/ui';
import type { ApiError } from '@/lib/api/client';
import type { CandidateSiteItem, HabitationListItem } from '@/lib/api/types';

import { CandidateSiteList } from './CandidateSiteList';
import { SiteAssessmentNotice } from './SiteAssessmentNotice';

export interface RelocationSitesPanelProps {
  habitation: HabitationListItem | null;
  /** Every site in range, screened-out ones included. */
  sites: CandidateSiteItem[];
  /** The subset the policy accepted for allocation. */
  allocatableSites: CandidateSiteItem[];
  /** How many sites exist in range, which may exceed the page actually loaded. */
  totalInRange?: number;
  radiusKm: number;
  isLoading?: boolean;
  error?: ApiError | null;
  selectedSiteId?: number | null;
  onSelectSite?: (site: CandidateSiteItem) => void;
  onRetry?: () => void;
  includeScreening: boolean;
  onIncludeScreeningChange: (include: boolean) => void;
  className?: string;
  classNames?: {
    root?: string;
    list?: string;
  };
}

/**
 * Centre panel: the destination options for the selected habitation.
 *
 * Shows allocatable sites by default and everything on request. The distinction matters for the
 * empty state: a district screened from rasters can have hundreds of parcels in range and none
 * of them allocatable, and reporting that as "no sites within the radius" would blame the search
 * distance for what is actually a data gap.
 */
export const RelocationSitesPanel = ({
  habitation,
  sites,
  allocatableSites,
  totalInRange,
  radiusKm,
  isLoading = false,
  error = null,
  selectedSiteId = null,
  onSelectSite,
  onRetry,
  includeScreening,
  onIncludeScreeningChange,
  className = '',
  classNames = {},
}: RelocationSitesPanelProps) => {
  const visible = includeScreening ? sites : allocatableSites;
  const hasScreenedOnly = sites.length > 0 && allocatableSites.length === 0 && !includeScreening;
  // `sites` is one page; `totalInRange` is how many the search actually found.
  const inRange = totalInRange ?? sites.length;
  const truncated = inRange > sites.length;

  return (
    <div
      className={['flex min-h-0 flex-col gap-3 p-4', classNames.root ?? '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <CandidateSiteList
        sites={visible}
        isLoading={isLoading}
        error={error}
        selectedId={selectedSiteId}
        onSelect={onSelectSite}
        onRetry={onRetry}
        className={classNames.list}
        description={
          habitation
            ? `${allocatableSites.length} allocatable of ${inRange} within ${radiusKm} km of ` +
              `${habitation.name}${truncated ? ` (showing the nearest ${sites.length})` : ''}`
            : undefined
        }
        actionSlot={
          habitation ? (
            <Toggle
              label="Show excluded"
              checked={includeScreening}
              onCheckedChange={onIncludeScreeningChange}
            />
          ) : null
        }
        emptyStateSlot={
          hasScreenedOnly ? (
            <EmptyState
              title="No allocatable sites"
              description={
                `${inRange} candidate ${inRange === 1 ? 'parcel is' : 'parcels are'} ` +
                `within ${radiusKm} km, but none passed eligibility. They are screening-grade land: ` +
                'tenure is unverified and water, school and health capacity are unmeasured.'
              }
              actionSlot={
                <Button size="sm" variant="secondary" onClick={() => onIncludeScreeningChange(true)}>
                  Show the excluded
                </Button>
              }
            />
          ) : undefined
        }
        placeholder={
          habitation ? undefined : (
            <EmptyState
              title="Select a habitation"
              description="Pick a habitation from the triage queue to see the sites it could be relocated to."
            />
          )
        }
      />
      <SiteAssessmentNotice sites={sites} />
    </div>
  );
};
