/** Endpoint bindings for the relocation planning API (triage, candidate sites, allocation). */

import { apiGet, apiPost } from './client';
import type {
  AllocationPlanRequest,
  AllocationPlanResponse,
  CandidateSitePage,
  HabitationPage,
  HabitationRiskDossier,
  Tier,
} from './types';

export interface FetchHabitationsParams {
  /** admin_boundary id, to scope the queue to one district. */
  admin?: number;
  tier?: Tier;
  /** Queue ordering; the API defaults to `urgency`. */
  sort?: 'urgency' | 'caseload';
  limit?: number;
  offset?: number;
}

/** Prioritised habitation triage queue — the demand side of the allocation. */
export function fetchHabitations(
  params: FetchHabitationsParams = {},
  signal?: AbortSignal,
): Promise<HabitationPage> {
  const { admin, tier, sort, limit = 50, offset = 0 } = params;
  return apiGet<HabitationPage>('/habitations', { admin, tier, sort, limit, offset }, signal);
}

/** Full risk dossier for one habitation: vulnerability breakdown and triage rationale. */
export function fetchHabitationRisk(
  habitationId: number,
  signal?: AbortSignal,
): Promise<HabitationRiskDossier> {
  return apiGet<HabitationRiskDossier>(`/habitations/${habitationId}/risk`, undefined, signal);
}

export interface FetchCandidateSitesParams {
  /** Widens the list to sites the H7 policy rejected, each carrying its rejection reasons. */
  includeScreening?: boolean;
  /** Server-side radius filter, in km. */
  radiusKm?: number;
  minSuitability?: number;
  limit?: number;
}

/**
 * Ranked candidate relocation sites for one habitation.
 *
 * With `includeScreening`, ineligible sites are returned too — a planner needs to see that a
 * site was excluded and why, rather than have it silently vanish from the comparison.
 */
export function fetchCandidateSites(
  habitationId: number,
  params: FetchCandidateSitesParams = {},
  signal?: AbortSignal,
): Promise<CandidateSitePage> {
  const { includeScreening, radiusKm, minSuitability, limit = 50 } = params;
  return apiGet<CandidateSitePage>(
    `/habitations/${habitationId}/sites`,
    {
      include_screening: includeScreening ? 'true' : undefined,
      radius_km: radiusKm,
      min_suitability: minSuitability,
      limit,
    },
    signal,
  );
}

/**
 * Runs the min-cost-flow allocation solver and persists an `allocation_run`.
 *
 * Requires an authenticated government official — the endpoint is gated on the
 * `ALLOCATION_RUN` permission and writes a canonical, audited decision record.
 */
export function solveAllocationPlan(
  request: AllocationPlanRequest,
  signal?: AbortSignal,
): Promise<AllocationPlanResponse> {
  return apiPost<AllocationPlanResponse>('/plan/allocate', request, signal);
}
