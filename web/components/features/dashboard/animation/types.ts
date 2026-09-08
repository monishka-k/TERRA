/**
 * SETU-DRR Hexagonal Risk Propagation Animation Types
 * High-precision geospatial risk simulation interfaces
 */

export type HexRiskState = 'inactive' | 'low' | 'moderate' | 'high' | 'critical';

export type HazardCategory = 'Landslide' | 'Flood' | 'Debris Flow' | 'Erosion' | 'Subsidence';

export type ClusterRegion = 'himalaya' | 'wayanad' | 'northeast' | 'kutch' | 'odisha' | 'inland';

export interface HexSpatialCell {
  /** Unique cell identifier */
  id: string;
  /** Synthetic H3 resolution-8 index */
  h3Index: string;
  /** 3D stage coordinates (Cartesian) */
  x: number;
  y: number;
  /** Geographic reference */
  elevationM: number;
  regionName: string;
  state: string;
  /** Primary hazard type */
  hazardType: HazardCategory;
  /** Baseline Multi-Hazard Index score (0 to 1) */
  baseMhiScore: number;
  /** Vulnerable population count */
  exposedPopulation: number;
  /** Settlement name if cell intersects a habitation */
  settlementNearby?: string;
  /** Regional risk cluster association */
  clusterId: ClusterRegion;
  /** Normalized distance from cluster epicenter (0 = epicenter) */
  clusterDistance: number;
  /** Scheduled activation onset time in seconds (0 to 18) */
  activationTime: number;
  /** Peak severity ceiling reached during simulation */
  peakSeverity: HexRiskState;
}

export interface CellRenderState {
  riskState: HexRiskState;
  score: number;
  colorHex: string;
  threeColor: number;
  height: number;
  opacity: number;
  isPulsing: boolean;
  pulseScale: number;
}

export interface AnimationStage {
  id: number;
  key: string;
  title: string;
  startTime: number;
  endTime: number;
  timestampLabel: string;
  shortDescription: string;
  summary: string;
}

export interface DataPulseSignal {
  id: string;
  fromCoords: { x: number; y: number };
  toCoords: { x: number; y: number };
  progress: number;
  intensity: number;
  label?: string;
}

export interface IncidentDataPoint {
  day: number;
  label: string;
  count: number;
}

export interface TelemetryState {
  incidentTrend: IncidentDataPoint[];
  backscatterDb: number;
  sarConstellation: string;
  overpassId: string;
  activeHazardsCount: number;
}
