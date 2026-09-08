import { HexSpatialCell, ClusterRegion, HazardCategory } from './types';

// Normalized India Polygon Coordinates (from GovMapStage)
const RAW_COORDS: [number, number][] = [
  [30, 95], [33, 93], [36, 90], [38, 85], [37, 80], [39, 76],
  [43, 76], [48, 77], [52, 79], [56, 80], [60, 78], [63, 76],
  [65, 78], [72, 79], [78, 80], [84, 82], [88, 78], [86, 74],
  [82, 72], [76, 70], [70, 68], [64, 67], [60, 64], [58, 60],
  [60, 56], [62, 52], [61, 47], [58, 43], [54, 38], [50, 32],
  [48, 25], [45, 18], [43, 10], [42, 5],  [40, 0],  [38, 6],
  [35, 12], [32, 20], [28, 28], [24, 35], [20, 42], [15, 48],
  [12, 52], [10, 56], [8, 60],  [12, 62], [15, 60], [18, 62],
  [15, 66], [12, 70], [16, 73], [20, 75], [24, 80], [25, 85],
  [27, 90], [30, 95]
];

// Coordinate projection mapping
const STAGE_POLYGON: [number, number][] = RAW_COORDS.map(([x, y]) => [
  (x - 45) * 0.95,
  (y - 48) * 0.95
]);

// Point-in-polygon ray-casting test
function isPointInPolygon(px: number, py: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = ((yi > py) !== (yj > py)) &&
      (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Epicenters of key regional risk clusters
interface Epicenter {
  clusterId: ClusterRegion;
  x: number;
  y: number;
  radius: number;
  regionName: string;
  state: string;
  hazardType: HazardCategory;
  baseElevation: number;
  baseActivationSec: number;
}

const EPICENTERS: Epicenter[] = [
  {
    clusterId: 'himalaya',
    x: 4,
    y: 13,
    radius: 12,
    regionName: 'Himalayan Arc / Garhwal',
    state: 'Uttarakhand',
    hazardType: 'Landslide',
    baseElevation: 1850,
    baseActivationSec: 2.2,
  },
  {
    clusterId: 'wayanad',
    x: -8,
    y: -26,
    radius: 9,
    regionName: 'Western Ghats / Wayanad',
    state: 'Kerala',
    hazardType: 'Debris Flow',
    baseElevation: 1100,
    baseActivationSec: 12.0,
  },
  {
    clusterId: 'northeast',
    x: 27,
    y: 8,
    radius: 10,
    regionName: 'Teesta Corridor / Mangan',
    state: 'Sikkim',
    hazardType: 'Flood',
    baseElevation: 1540,
    baseActivationSec: 12.5,
  },
  {
    clusterId: 'kutch',
    x: -23,
    y: 1,
    radius: 8,
    regionName: 'Kutch Fault Basin',
    state: 'Gujarat',
    hazardType: 'Subsidence',
    baseElevation: 220,
    baseActivationSec: 13.0,
  },
  {
    clusterId: 'odisha',
    x: 18,
    y: -10,
    radius: 8,
    regionName: 'Mahanadi Coastal Plain',
    state: 'Odisha',
    hazardType: 'Erosion',
    baseElevation: 45,
    baseActivationSec: 13.5,
  },
];

/**
 * Generates an analytical hexagonal grid covering the subcontinent.
 * Spacing and hex dimensions ensure ~160 to 200 analytical units.
 */
export function generateIndiaHexGrid(): HexSpatialCell[] {
  const cells: HexSpatialCell[] = [];
  const hexRadius = 1.95;
  const colSpacing = hexRadius * 1.5;
  const rowSpacing = Math.sqrt(3) * hexRadius;

  let cellIndex = 1;

  for (let col = -22; col <= 24; col++) {
    for (let row = -24; row <= 26; row++) {
      const x = col * colSpacing;
      const y = row * rowSpacing + (col % 2 !== 0 ? rowSpacing / 2 : 0);

      // Verify cell center lies within India's boundary
      if (!isPointInPolygon(x, y, STAGE_POLYGON)) {
        continue;
      }

      // Check proximity to regional epicenters
      let closestEpicenter: Epicenter | null = null;
      let minDistance = 999;

      for (const epi of EPICENTERS) {
        const dist = Math.hypot(x - epi.x, y - epi.y);
        if (dist <= epi.radius && dist < minDistance) {
          minDistance = dist;
          closestEpicenter = epi;
        }
      }

      const id = `cell-${cellIndex}`;
      const syntheticH3 = `886${Math.abs(Math.round(x * 100)).toString(16).padStart(4, '0')}${Math.abs(Math.round(y * 100)).toString(16).padStart(4, '0')}fffff`;

      if (closestEpicenter) {
        const normalizedDist = minDistance / closestEpicenter.radius;
        // Propagation speed: outward delay per distance unit
        const activationDelay = normalizedDist * 4.2;
        const activationTime = closestEpicenter.baseActivationSec + activationDelay;

        // Peak severity determined by distance from core
        let peakSeverity: 'critical' | 'high' | 'moderate' | 'low' = 'low';
        if (normalizedDist < 0.32) peakSeverity = 'critical';
        else if (normalizedDist < 0.60) peakSeverity = 'high';
        else if (normalizedDist < 0.85) peakSeverity = 'moderate';

        const baseMhi = Math.max(0.45, 0.95 - normalizedDist * 0.4);
        const exposedPop = Math.round((1 - normalizedDist * 0.7) * 4500 + Math.random() * 500);

        cells.push({
          id,
          h3Index: syntheticH3,
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          elevationM: Math.round(closestEpicenter.baseElevation + (Math.random() * 120 - 60)),
          regionName: closestEpicenter.regionName,
          state: closestEpicenter.state,
          hazardType: closestEpicenter.hazardType,
          baseMhiScore: Math.round(baseMhi * 100) / 100,
          exposedPopulation: exposedPop,
          clusterId: closestEpicenter.clusterId,
          clusterDistance: Math.round(normalizedDist * 100) / 100,
          activationTime: Math.round(activationTime * 100) / 100,
          peakSeverity,
        });
      } else {
        // Quiet observational inland cell
        cells.push({
          id,
          h3Index: syntheticH3,
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          elevationM: Math.round(420 + Math.random() * 200),
          regionName: 'Central Deccan Plateau',
          state: 'Madhya Pradesh',
          hazardType: 'Flood',
          baseMhiScore: 0.22,
          exposedPopulation: 850,
          clusterId: 'inland',
          clusterDistance: 1.0,
          activationTime: 999, // Stays inactive/observational throughout
          peakSeverity: 'inactive',
        });
      }

      cellIndex++;
    }
  }

  return cells;
}
