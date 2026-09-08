/** Map defaults, palettes and hazard metadata shared across the map feature. */

import type { CoverageFlag, HazardType } from '@/lib/api/types';

export type RGBAColor = [number, number, number, number];

/** Barpeta pilot AOI — mirrors `pipeline/hazard/flood/aoi.py:BARPETA_BBOX_WGS84`. */
export const BARPETA_BBOX: [number, number, number, number] = [90.7, 26.05, 91.45, 26.75];

export const BARPETA_LGD_CODE = 277;

export const DEFAULT_VIEW_STATE = {
  longitude: (BARPETA_BBOX[0] + BARPETA_BBOX[2]) / 2,
  latitude: (BARPETA_BBOX[1] + BARPETA_BBOX[3]) / 2,
  zoom: 9.2,
  pitch: 0,
  bearing: 0,
} as const;

/**
 * Sequential ramp for classed susceptibility, dark-ground safe.
 * Seven stops for the six quantile breaks the API returns.
 */
export const SUSCEPTIBILITY_RAMP: RGBAColor[] = [
  [26, 90, 120, 255],
  [31, 138, 148, 255],
  [110, 181, 128, 255],
  [232, 205, 96, 255],
  [240, 150, 62, 255],
  [222, 88, 51, 255],
  [176, 24, 43, 255],
];

/**
 * Cells that are safe *by construction* (FR-3.17 hard-zero: HAND > 30 m or slope > 15°).
 * Deliberately off-ramp so a structurally safe cell never reads as "low measured risk".
 */
export const HARD_ZERO_COLOR: RGBAColor = [72, 84, 92, 190];

/** Unobserved cells are drawn as an outline only — never filled, never green. */
export const NO_COVERAGE_OUTLINE_COLOR: RGBAColor = [148, 163, 184, 220];

export const SELECTED_OUTLINE_COLOR: RGBAColor = [255, 255, 255, 255];

export const HOVER_OUTLINE_COLOR: RGBAColor = [226, 232, 240, 200];

/** Hatch overlay marking cells whose normalised confidence falls below the threshold. */
export const LOW_CONFIDENCE_HATCH_COLOR: RGBAColor = [12, 16, 24, 205];

export const COVERAGE_LABELS: Record<CoverageFlag, string> = {
  full: 'Measured',
  low_coverage: 'Partial coverage',
  no_coverage: 'No data',
};

export const COVERAGE_DESCRIPTIONS: Record<CoverageFlag, string> = {
  full: 'At least half the cell area carries valid raster pixels.',
  low_coverage: 'Under half the cell was observed; the score is directional only.',
  no_coverage: 'No valid pixels. The 0.00 score is a fill, not a measurement.',
};

export const HAZARD_LABELS: Record<HazardType, string> = {
  landslide: 'Landslide',
  flash_flood: 'Flash flood',
  storm_surge: 'Storm surge',
  riverine_flood: 'Riverine flood',
  coastal_erosion: 'Coastal erosion',
  cloudburst: 'Cloudburst',
};

/** H3 resolutions the map offers. Source data is res 8; 7 and 6 are client-side roll-ups. */
export const SUPPORTED_RESOLUTIONS = [6, 7, 8] as const;

export type SupportedResolution = (typeof SUPPORTED_RESOLUTIONS)[number];

export const SOURCE_RESOLUTION = 8;

/**
 * Default cut for the low-confidence hatch, applied to *normalised* confidence.
 * On the Barpeta flood layer raw confidence peaks at 0.167 (10 SAR scenes against a
 * 30-observation ceiling), so an absolute cut of 0.3 would hatch every cell on the map.
 */
export const DEFAULT_CONFIDENCE_HATCH_THRESHOLD = 0.5;

export const MAP_ATTRIBUTION =
  'Map © OpenFreeMap, OpenStreetMap contributors · Copernicus Sentinel-1 · ASF GLO-30 HAND · JRC GSW · ESA WorldCover';
