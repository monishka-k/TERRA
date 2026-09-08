/**
 * Transport types for the SETU-DRR hazard layer API.
 *
 * Mirrors `core/src/core/schemas/hazard.py` field-for-field, in snake_case, so no
 * mapping layer sits between the wire and the render path. Regenerate the canonical
 * versions with `pnpm generate:types` once the API is reachable on port 8000.
 */

/** Coverage provenance for an aggregated H3 cell (Step 10 §10.3). */
export type CoverageFlag = 'full' | 'low_coverage' | 'no_coverage';

export type HazardType =
  | 'landslide'
  | 'flash_flood'
  | 'storm_surge'
  | 'riverine_flood'
  | 'coastal_erosion'
  | 'cloudburst';

/**
 * One hexagon of a hazard layer.
 *
 * `susceptibility === 0` is ambiguous on its own: it means "structurally safe" only when
 * `quality_flag === 'full'`. On a `no_coverage` cell the zero is a NaN fill from the
 * pipeline's `apply_quality_flags()` and must never be rendered as a safe value.
 */
export interface HazardCell {
  h3: string;
  susceptibility: number;
  /** Raw confidence. Divide by `HazardLayerLegend.confidence_ceiling` before display. */
  confidence: number;
  quality_flag: CoverageFlag;
  /** Fraction of the cell excluded by FR-3.17 (HAND > 30 m OR slope > 15°). */
  hard_zero_fraction: number | null;
}

export interface HazardLayerLegend {
  method: string;
  quantiles: number[];
  /** Ascending class breaks in susceptibility units, computed server-side. */
  breaks: number[];
  domain: [number, number] | number[];
  /** Maximum confidence in the layer; the divisor for a displayable [0,1] value. */
  confidence_ceiling: number;
  /** FR-3.9 Permanent Red Zone susceptibility cut. */
  prz_susceptibility_threshold: number;
}

export interface HazardLayerCoverage {
  full: number;
  low_coverage: number;
  no_coverage: number;
}

export interface HazardLayerResponse {
  hazard_type: HazardType;
  res: number;
  count: number;
  truncated: boolean;
  model_version: string;
  legend: HazardLayerLegend;
  coverage: HazardLayerCoverage;
  cells: HazardCell[];
  screening_grade: string;
}

export interface HazardLayerSummary {
  hazard_type: HazardType;
  res: number;
  cell_count: number;
  model_version: string;
  min_susceptibility: number;
  max_susceptibility: number;
  mean_susceptibility: number;
  confidence_ceiling: number;
}

/** Physical drivers behind a flood susceptibility score (`hazard_static_flood`). */
export interface FloodDrivers {
  mean_inundation_frequency: number | null;
  mean_hand_m: number | null;
  min_hand_m: number | null;
  mean_slope_deg: number | null;
  mean_cropland_fraction: number | null;
  max_susceptibility: number | null;
  valid_pixel_fraction: number | null;
  hard_zero_fraction: number | null;
  observation_ceiling: number;
}

export interface HazardCellDetail {
  h3: string;
  h3_int: number;
  res: number;
  hazard_type: HazardType;
  susceptibility: number;
  confidence: number;
  confidence_normalised: number;
  quality_flag: CoverageFlag;
  model_version: string;
  centroid: [number, number] | number[];
  admin_name: string | null;
  population: number;
  is_permanent_red_candidate: boolean;
  drivers: FloodDrivers | null;
  screening_grade: string;
}

/** Standard API error envelope (see `core/errors.py`). */
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    request_id: string | null;
    details: Record<string, unknown>;
  };
}

/** Canonical authentication transfer types generated from backend OpenAPI contract. */
import type { components } from '../api-types';

export type UserResponse = components['schemas']['UserResponse'];
export type LoginRequest = components['schemas']['LoginRequest'];
export type Role = components['schemas']['Role'];
export type JurisdictionDTO = components['schemas']['JurisdictionDTO'];
export type LogoutResponse = components['schemas']['LogoutResponse'];
export type RegisterRequest = components['schemas']['RegisterRequest'];

/* ---- Relocation planning (habitations, candidate sites, allocation) ---- */

export type Tier = components['schemas']['Tier'];
export type TenureType = components['schemas']['TenureType'];
export type BindingConstraint = components['schemas']['BindingConstraint'];

export type HabitationListItem = components['schemas']['HabitationListItem'];
export type HabitationRiskDossier = components['schemas']['HabitationRiskDossier'];
export type HabitationPage = components['schemas']['PaginatedResponse_HabitationListItem_'];

export type CandidateSiteItem = components['schemas']['CandidateSiteItem'];
export type CandidateSiteDetail = components['schemas']['CandidateSiteDetail'];
export type CandidateSitePage = components['schemas']['PaginatedResponse_CandidateSiteItem_'];
export type CapacityBreakdown = components['schemas']['CapacityBreakdownDTO'];
export type AugmentedCapacity = components['schemas']['AugmentedCapacityDTO'];

export type AllocationPlanRequest = components['schemas']['AllocationPlanRequest'];
export type AllocationPlanResponse = components['schemas']['AllocationPlanResponse'];
export type AllocationAssignment = components['schemas']['AllocationAssignmentDTO'];
