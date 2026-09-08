/**
 * SETU-DRR: Disaster Risk Reduction & Relocation Planning Platform for India
 * Prototype Demo Data for Geospatial Hazard Intelligence & Relocation Decision Support
 */

export type HazardFilter =
  | 'All'
  | 'Landslide'
  | 'Flash Flood'
  | 'Coastal Erosion'
  | 'Subsidence'
  | 'GLOF';

export type RiskLevelFilter =
  | 'All'
  | 'Permanent Red Zone'
  | 'Active Alert'
  | 'Forecast Alert'
  | 'Monitored';

export type ScenarioTime = 'Now' | '+24h' | '+48h' | '+72h';

export const HAZARDS: HazardFilter[] = [
  'All',
  'Landslide',
  'Flash Flood',
  'Coastal Erosion',
  'Subsidence',
  'GLOF'
];

export const REGIONS: string[] = [
  'All India',
  'Uttarakhand',
  'Kerala',
  'Assam',
  'Sikkim',
  'Gujarat',
  'Bihar',
  'Himachal Pradesh',
  'Odisha',
  'Ladakh'
];

export const RISK_LEVELS: { id: RiskLevelFilter; label: string; color: string }[] = [
  { id: 'All', label: 'All Risks', color: '#162522' },
  { id: 'Permanent Red Zone', label: 'Permanent Red Zone', color: '#B9433F' },
  { id: 'Active Alert', label: 'Active Alert', color: '#C96B3B' },
  { id: 'Forecast Alert', label: 'Forecast Alert', color: '#D49A45' },
  { id: 'Monitored', label: 'Monitored', color: '#6F8F72' }
];

export const SCENARIO_TIMESTAMPS: { id: ScenarioTime; label: string; description: string }[] = [
  { id: 'Now', label: 'Now', description: 'Real-time telemetry and active alerts' },
  { id: '+24h', label: '+24h', description: 'Forecasted precipitation threshold breaches in next 24 hours' },
  { id: '+48h', label: '+48h', description: 'Simulated 48h soil saturation and slope shear breach' },
  { id: '+72h', label: '+72h', description: '72-hour extreme weather ensemble scenario' }
];

export interface RiskBreakdown {
  slope: number;
  rainfall: number;
  landslideHistory: number;
  populationExposure: number;
}

export interface HabitationData {
  id: string;
  name: string;
  state: string;
  district: string;
  coordinates: string;
  mapCoords: { x: number; y: number };
  riskScore: number;
  priority: 'Immediate Priority' | 'Short-term Action' | 'Monitor Caseload';
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  riskState: 'Permanent Red Zone' | 'Active Alert' | 'Forecast Alert' | 'Monitored';
  hazardType: 'Landslide' | 'Flash Flood' | 'Coastal Erosion' | 'Subsidence' | 'GLOF';
  population: number;
  households: number;
  breakdown: RiskBreakdown;
  whyFlagged: string;
  recommendedAction: string;
  elevationM: number;
  slopeAngle: number;
  recentRainfallMm: number;
}

export interface RelocationCandidate {
  id: string;
  code: string;
  name: string;
  location: string;
  distanceKm: number;
  capacity: number;
  totalRequired: number;
  suitabilityScore: number;
  bindingConstraint: 'WATER' | 'ROAD ACCESS' | 'SEISMIC BUFFER' | 'TERRAIN SLOPE';
  landSuitability: number;
  waterAvailability: number;
  roadAccess: number;
  schoolAccess: number;
  healthcareAccess: number;
  elevationM: number;
  landTenure: string;
  slope: string;
  notes: string;
}

export interface HexCellData {
  id: string;
  h3Index: string;
  x: number;
  y: number;
  riskState: 'Permanent Red Zone' | 'Active Alert' | 'Forecast Alert' | 'Monitored';
  dominantHazard: HazardFilter;
  mhiScore: number;
  settlementNearby?: string;
}

export const TOP_LEVEL_METRICS = {
  activeAlerts: 18,
  priorityHabitations: 7,
  populationExposed: '24.8K',
  relocationReviews: 12,
  lastUpdatedMinAgo: 3
};

export const DEMO_HABITATIONS: HabitationData[] = [
  {
    id: 'joshimath',
    name: 'Joshimath',
    state: 'Uttarakhand',
    district: 'Chamoli',
    coordinates: '30.556° N, 79.567° E',
    mapCoords: { x: 3, y: 14 },
    riskScore: 0.87,
    priority: 'Immediate Priority',
    riskLevel: 'Critical',
    riskState: 'Active Alert',
    hazardType: 'Subsidence',
    population: 3420,
    households: 560,
    breakdown: {
      slope: 0.91,
      rainfall: 0.82,
      landslideHistory: 0.89,
      populationExposure: 0.74
    },
    whyFlagged:
      'High slope instability combined with recurring blind thrust shear and recent heavy rainfall and elevated population exposure has pushed this settlement into the immediate-priority category.',
    recommendedAction: 'Assess for short-term relocation.',
    elevationM: 1890,
    slopeAngle: 38,
    recentRainfallMm: 218
  },
  {
    id: 'bhairavpur-devagram',
    name: 'Bhairavpur / Devagram',
    state: 'Uttarakhand',
    district: 'Rudraprayag',
    coordinates: '30.285° N, 78.982° E',
    mapCoords: { x: 5, y: 11 },
    riskScore: 0.81,
    priority: 'Short-term Action',
    riskLevel: 'High',
    riskState: 'Active Alert',
    hazardType: 'Landslide',
    population: 1240,
    households: 410,
    breakdown: {
      slope: 0.88,
      rainfall: 0.84,
      landslideHistory: 0.79,
      populationExposure: 0.71
    },
    whyFlagged:
      'Severe toe-erosion by perennial glacial stream combined with high weathered colluvium overburden. Critical risk threshold breach forecast in monsoon.',
    recommendedAction: 'Open and approve Relocation Planning protocol for candidate plateau sites.',
    elevationM: 1420,
    slopeAngle: 34,
    recentRainfallMm: 195
  },
  {
    id: 'wayanad-meppadi',
    name: 'Wayanad (Meppadi–Chooralmala)',
    state: 'Kerala',
    district: 'Wayanad',
    coordinates: '11.554° N, 76.126° E',
    mapCoords: { x: -8, y: -26 },
    riskScore: 0.89,
    priority: 'Immediate Priority',
    riskLevel: 'Critical',
    riskState: 'Permanent Red Zone',
    hazardType: 'Landslide',
    population: 2850,
    households: 520,
    breakdown: {
      slope: 0.94,
      rainfall: 0.96,
      landslideHistory: 0.92,
      populationExposure: 0.85
    },
    whyFlagged:
      'Catastrophic debris flow corridor with recurrent saturated soil liquefaction. High probability recurrence zone designated Permanent Red Zone (PRZ).',
    recommendedAction: 'Permanent buffer establishment and accelerated resettlement to low-gradient foothill sites.',
    elevationM: 980,
    slopeAngle: 42,
    recentRainfallMm: 372
  },
  {
    id: 'teesta-valley',
    name: 'Teesta Valley Corridor',
    state: 'Sikkim',
    district: 'Mangan',
    coordinates: '27.533° N, 88.512° E',
    mapCoords: { x: 26, y: 8 },
    riskScore: 0.84,
    priority: 'Immediate Priority',
    riskLevel: 'Critical',
    riskState: 'Active Alert',
    hazardType: 'GLOF',
    population: 4100,
    households: 680,
    breakdown: {
      slope: 0.86,
      rainfall: 0.89,
      landslideHistory: 0.83,
      populationExposure: 0.78
    },
    whyFlagged:
      'Glacial lake outburst flood (GLOF) surge channel along high-velocity braided gorge. Fluvial embankment undercutting active.',
    recommendedAction: 'Demarcate 200m riverine exclusion buffer and execute upstream early-warning relay.',
    elevationM: 1650,
    slopeAngle: 36,
    recentRainfallMm: 280
  },
  {
    id: 'kosi-avulsion',
    name: 'Kosi Avulsion Embankment',
    state: 'Bihar',
    district: 'Supaul',
    coordinates: '26.124° N, 86.602° E',
    mapCoords: { x: 19, y: 3 },
    riskScore: 0.86,
    priority: 'Immediate Priority',
    riskLevel: 'High',
    riskState: 'Forecast Alert',
    hazardType: 'Flash Flood',
    population: 31500,
    households: 4800,
    breakdown: {
      slope: 0.35,
      rainfall: 0.94,
      landslideHistory: 0.89,
      populationExposure: 0.95
    },
    whyFlagged:
      'High sedimentation channel migration hazard with heavy monsoon catchment runoff threatening ring-bund breach.',
    recommendedAction: 'Evacuation corridor standby and raised plinth cluster planning.',
    elevationM: 85,
    slopeAngle: 4,
    recentRainfallMm: 310
  },
  {
    id: 'kutch-fault',
    name: 'Kutch Mainland Basin',
    state: 'Gujarat',
    district: 'Kutch',
    coordinates: '23.342° N, 69.821° E',
    mapCoords: { x: -24, y: 0 },
    riskScore: 0.78,
    priority: 'Short-term Action',
    riskLevel: 'Medium',
    riskState: 'Forecast Alert',
    hazardType: 'Subsidence',
    population: 3110,
    households: 490,
    breakdown: {
      slope: 0.62,
      rainfall: 0.45,
      landslideHistory: 0.88,
      populationExposure: 0.76
    },
    whyFlagged:
      'Intraplate blind thrust fault shear zone exhibiting localized soil liquefaction anomalies and crustal subsidence.',
    recommendedAction: 'Structural seismic retrofitting and soil stabilization monitoring.',
    elevationM: 210,
    slopeAngle: 12,
    recentRainfallMm: 48
  }
];

export const DEMO_RELOCATION_CANDIDATES: RelocationCandidate[] = [
  {
    id: 'site-a',
    code: 'SITE A',
    name: 'Bhatoli Plateau',
    location: 'Rudraprayag North Ridge, Uttarakhand',
    distanceKm: 8.4,
    capacity: 340,
    totalRequired: 410,
    suitabilityScore: 76,
    bindingConstraint: 'ROAD ACCESS',
    landSuitability: 88,
    waterAvailability: 82,
    roadAccess: 62,
    schoolAccess: 74,
    healthcareAccess: 68,
    elevationM: 1420,
    landTenure: 'State Revenue Forest / Category-C',
    slope: '8.4° (Gentle Bench)',
    notes: 'Stable sandstone bedrock shelf with high solar aspect. Requires 4.2 km feeder road upgrade for all-weather access.'
  },
  {
    id: 'site-b',
    code: 'SITE B',
    name: 'Gauchar Terrace',
    location: 'Alaknanda Valley River Terrace, Uttarakhand',
    distanceKm: 12.2,
    capacity: 218,
    totalRequired: 410,
    suitabilityScore: 84,
    bindingConstraint: 'WATER',
    landSuitability: 94,
    waterAvailability: 68,
    roadAccess: 95,
    schoolAccess: 90,
    healthcareAccess: 88,
    elevationM: 880,
    landTenure: 'Municipal Degraded Pasture',
    slope: '3.2° (Fluvial Flat)',
    notes: 'Prime riverine fluvial terrace with direct NH-58 connectivity and flat topography. Requires gravity-fed pipe scheme for drinking water.'
  },
  {
    id: 'site-c',
    code: 'SITE C',
    name: 'Pipalkoti Ridge',
    location: 'Upper Garhwal South Bench, Uttarakhand',
    distanceKm: 15.6,
    capacity: 410,
    totalRequired: 410,
    suitabilityScore: 89,
    bindingConstraint: 'SEISMIC BUFFER',
    landSuitability: 91,
    waterAvailability: 90,
    roadAccess: 86,
    schoolAccess: 84,
    healthcareAccess: 82,
    elevationM: 1150,
    landTenure: 'Gram Panchayat Common Land',
    slope: '6.5° (Stable Micro-Terrace)',
    notes: 'Accommodates 100% of origin settlement households in a single cluster. Excellent perennial spring catchment and micro-terrace stability.'
  }
];

export const DEMO_HEX_CELLS: HexCellData[] = [
  // Garhwal / Uttarakhand Cluster (Joshimath, Rudraprayag)
  { id: 'hex-1', h3Index: '88604312d3fffff', x: 2, y: 15, riskState: 'Permanent Red Zone', dominantHazard: 'Subsidence', mhiScore: 0.92, settlementNearby: 'Joshimath Core' },
  { id: 'hex-2', h3Index: '88604312d5fffff', x: 4, y: 14, riskState: 'Active Alert', dominantHazard: 'Landslide', mhiScore: 0.87, settlementNearby: 'Joshimath Slope' },
  { id: 'hex-3', h3Index: '88604312d7fffff', x: 5, y: 11, riskState: 'Active Alert', dominantHazard: 'Landslide', mhiScore: 0.81, settlementNearby: 'Bhairavpur / Devagram' },
  { id: 'hex-4', h3Index: '88604312d9fffff', x: 7, y: 12, riskState: 'Forecast Alert', dominantHazard: 'Landslide', mhiScore: 0.73, settlementNearby: 'Pipalkoti' },
  { id: 'hex-5', h3Index: '88604312dbfffff', x: 1, y: 13, riskState: 'Monitored', dominantHazard: 'Subsidence', mhiScore: 0.48 },

  // Western Ghats / Kerala Cluster (Wayanad)
  { id: 'hex-6', h3Index: '88618925d3fffff', x: -8, y: -26, riskState: 'Permanent Red Zone', dominantHazard: 'Landslide', mhiScore: 0.95, settlementNearby: 'Meppadi–Chooralmala' },
  { id: 'hex-7', h3Index: '88618925d5fffff', x: -6, y: -28, riskState: 'Permanent Red Zone', dominantHazard: 'Landslide', mhiScore: 0.91, settlementNearby: 'Mundakkai' },
  { id: 'hex-8', h3Index: '88618925d7fffff', x: -9, y: -24, riskState: 'Active Alert', dominantHazard: 'Landslide', mhiScore: 0.84, settlementNearby: 'Vythiri' },
  { id: 'hex-9', h3Index: '88618925d9fffff', x: -11, y: -27, riskState: 'Forecast Alert', dominantHazard: 'Flash Flood', mhiScore: 0.69 },

  // Sikkim / Teesta Valley Cluster
  { id: 'hex-10', h3Index: '88629731d1fffff', x: 26, y: 8, riskState: 'Active Alert', dominantHazard: 'GLOF', mhiScore: 0.88, settlementNearby: 'Teesta Valley' },
  { id: 'hex-11', h3Index: '88629731d3fffff', x: 28, y: 9, riskState: 'Active Alert', dominantHazard: 'GLOF', mhiScore: 0.85, settlementNearby: 'Chungthang' },
  { id: 'hex-12', h3Index: '88629731d5fffff', x: 25, y: 6, riskState: 'Forecast Alert', dominantHazard: 'Landslide', mhiScore: 0.76, settlementNearby: 'Mangan' },

  // Bihar / Kosi Cluster
  { id: 'hex-13', h3Index: '88624599d3fffff', x: 19, y: 3, riskState: 'Forecast Alert', dominantHazard: 'Flash Flood', mhiScore: 0.86, settlementNearby: 'Kosi Embankment' },
  { id: 'hex-14', h3Index: '88624599d5fffff', x: 21, y: 4, riskState: 'Forecast Alert', dominantHazard: 'Flash Flood', mhiScore: 0.82, settlementNearby: 'Supaul' },

  // Gujarat / Kutch Cluster
  { id: 'hex-15', h3Index: '88607144d1fffff', x: -24, y: 0, riskState: 'Forecast Alert', dominantHazard: 'Subsidence', mhiScore: 0.78, settlementNearby: 'Kutch Basin' },
  { id: 'hex-16', h3Index: '88607144d3fffff', x: -22, y: -2, riskState: 'Monitored', dominantHazard: 'Subsidence', mhiScore: 0.55 },

  // Odisha / Coastal Cluster
  { id: 'hex-17', h3Index: '8861bb02d3fffff', x: 17, y: -10, riskState: 'Active Alert', dominantHazard: 'Coastal Erosion', mhiScore: 0.83, settlementNearby: 'Paradip Coast' },
  { id: 'hex-18', h3Index: '8861bb02d5fffff', x: 19, y: -9, riskState: 'Forecast Alert', dominantHazard: 'Coastal Erosion', mhiScore: 0.77, settlementNearby: 'Mahanadi Delta' }
];
