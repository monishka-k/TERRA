'use client';

import { useCallback, useState } from 'react';

import {
  AppHeader,
  CenterPanel,
  LeftPanel,
  RightPanel,
  ThreePanelLayout,
} from '@/components/layout';
import { useAllocationPlan } from '@/lib/hooks/useAllocationPlan';
import { useDistricts } from '@/lib/hooks/useDistricts';
import { useCandidateSites } from '@/lib/hooks/useCandidateSites';
import { useHabitationQueue } from '@/lib/hooks/useHabitationQueue';
import type { CandidateSiteItem, HabitationListItem } from '@/lib/api/types';

import { AllocationControls, type AllocationSettings } from './AllocationControls';
import { AllocationPanel } from './AllocationPanel';
import { DistrictSelect } from './DistrictSelect';
import { HabitationQueue } from './HabitationQueue';
import { RelocationHeaderMeta } from './RelocationHeaderMeta';
import { RelocationSitesPanel } from './RelocationSitesPanel';

export interface RelocationWorkspaceProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Solver parameters the workspace opens with. */
  initialSettings?: Partial<AllocationSettings>;
  className?: string;
}

const DEFAULT_SETTINGS: AllocationSettings = {
  maxSearchRadiusKm: 15,
  targetTier: 'immediate',
  allowGroupSplits: true,
  distancePenaltyWeight: 1,
};

/**
 * Relocation planning workspace: triage demand, compare destination sites, solve the allocation.
 *
 * The three panels read left to right as the decision itself — who needs to move, where they
 * could go and what caps each option, and how the solver actually distributes them.
 */
export const RelocationWorkspace = ({
  title = 'Relocation planning',
  subtitle = 'Match displaced households to candidate sites under carrying-capacity limits',
  initialSettings,
  className = '',
}: RelocationWorkspaceProps) => {
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [selectedHabitation, setSelectedHabitation] = useState<HabitationListItem | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [includeScreening, setIncludeScreening] = useState(false);
  const [settings, setSettings] = useState<AllocationSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });

  const queue = useHabitationQueue({ admin: districtId ?? undefined, limit: 50 });
  // Districts come from their own request, not the queue's page: the queue is ranked and
  // paged, so a district whose habitations all score low would drop out of the picker.
  const { districts } = useDistricts();
  const activeDistrictId = districtId ?? districts[0]?.id ?? null;

  const sites = useCandidateSites({
    habitationId: selectedHabitation?.id ?? null,
    radiusKm: settings.maxSearchRadiusKm,
  });

  const allocation = useAllocationPlan();

  const handleSelectHabitation = useCallback((habitation: HabitationListItem) => {
    setSelectedHabitation(habitation);
    setSelectedSiteId(null);
  }, []);

  const handleSelectDistrict = useCallback((adminId: number) => {
    setDistrictId(adminId);
    setSelectedHabitation(null);
    setSelectedSiteId(null);
  }, []);

  const handleSolve = useCallback(() => {
    void allocation.solve({
      admin_id: activeDistrictId ?? undefined,
      max_search_radius_km: settings.maxSearchRadiusKm,
      target_tiers: [settings.targetTier],
      allow_group_splits: settings.allowGroupSplits,
      distance_penalty_weight: settings.distancePenaltyWeight,
    });
  }, [allocation, activeDistrictId, settings]);

  const handleSelectSite = useCallback(
    (site: CandidateSiteItem) =>
      setSelectedSiteId((current) => (current === site.id ? null : site.id)),
    [],
  );

  return (
    <ThreePanelLayout
      className={className}
      header={
        <AppHeader
          title={title}
          subtitle={subtitle}
          metaSlot={
            <RelocationHeaderMeta
              totalHabitations={queue.total}
              selectedHabitation={selectedHabitation}
              plan={allocation.plan}
            />
          }
        />
      }
      left={
        <LeftPanel>
          <HabitationQueue
            habitations={queue.habitations}
            total={queue.total}
            isLoading={queue.isLoading}
            error={queue.error}
            selectedId={selectedHabitation?.id ?? null}
            onSelect={handleSelectHabitation}
            onRetry={queue.refetch}
            actionSlot={
              districts.length > 1 ? (
                <DistrictSelect
                  options={districts}
                  value={activeDistrictId}
                  onValueChange={handleSelectDistrict}
                />
              ) : null
            }
          />
        </LeftPanel>
      }
      center={
        <CenterPanel>
          <RelocationSitesPanel
            habitation={selectedHabitation}
            sites={sites.sites}
            allocatableSites={sites.allocatable}
            totalInRange={sites.total}
            radiusKm={settings.maxSearchRadiusKm}
            isLoading={sites.isLoading}
            error={sites.error}
            selectedSiteId={selectedSiteId}
            onSelectSite={handleSelectSite}
            onRetry={sites.refetch}
            includeScreening={includeScreening}
            onIncludeScreeningChange={setIncludeScreening}
          />
        </CenterPanel>
      }
      right={
        <RightPanel>
          <AllocationPanel
            plan={allocation.plan}
            isSolving={allocation.isSolving}
            error={allocation.error}
            highlightedHabitationId={selectedHabitation?.id ?? null}
            description={
              activeDistrictId
                ? `Solving across ${districts.find((d) => d.id === activeDistrictId)?.name ?? 'the district'}`
                : undefined
            }
            controlsSlot={
              <AllocationControls
                settings={settings}
                onSettingsChange={setSettings}
                onSolve={handleSolve}
                isSolving={allocation.isSolving}
              />
            }
          />
        </RightPanel>
      }
    />
  );
};
