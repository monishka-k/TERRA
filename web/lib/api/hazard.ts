/** Endpoint bindings for the static hazard layer API. */

import { apiGet } from './client';
import type {
  HazardCellDetail,
  HazardLayerResponse,
  HazardLayerSummary,
  HazardType,
} from './types';

export interface FetchHazardLayerParams {
  hazardType?: HazardType;
  res?: number;
  /** Viewport as [minLon, minLat, maxLon, maxLat]. Omit for the whole layer. */
  bbox?: [number, number, number, number];
  /** admin_boundary id or LGD code (277 = Barpeta). */
  admin?: number;
  minSusceptibility?: number;
  limit?: number;
}

/** Lists every published static hazard layer, for the layer switcher. */
export function fetchHazardLayers(signal?: AbortSignal): Promise<HazardLayerSummary[]> {
  return apiGet<HazardLayerSummary[]>('/hazard/layers', undefined, signal);
}

/**
 * Fetches hazard cells plus the legend needed to colour them.
 *
 * The response carries no geometry — hexagon boundaries are derived from the H3 index
 * on the GPU by deck.gl's H3HexagonLayer.
 */
export function fetchHazardLayer(
  params: FetchHazardLayerParams = {},
  signal?: AbortSignal,
): Promise<HazardLayerResponse> {
  const { hazardType = 'riverine_flood', res = 8, bbox, admin, minSusceptibility, limit } = params;
  return apiGet<HazardLayerResponse>(
    '/hazard/cells',
    {
      hazard_type: hazardType,
      res,
      bbox: bbox ? bbox.join(',') : undefined,
      admin,
      min_susceptibility: minSusceptibility,
      limit,
    },
    signal,
  );
}

/** Fetches one cell's dossier: score, coverage provenance and physical drivers. */
export function fetchHazardCellDetail(
  h3: string,
  hazardType: HazardType = 'riverine_flood',
  signal?: AbortSignal,
): Promise<HazardCellDetail> {
  return apiGet<HazardCellDetail>(`/hazard/cells/${h3}`, { hazard_type: hazardType }, signal);
}
