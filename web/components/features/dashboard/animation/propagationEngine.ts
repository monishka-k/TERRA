import {
  HexSpatialCell,
  HexRiskState,
  CellRenderState,
  AnimationStage,
  DataPulseSignal,
} from './types';

export const ANIMATION_DURATION_SEC = 18.0;

export const ANIMATION_STAGES: AnimationStage[] = [
  {
    id: 1,
    key: 'initial-state',
    title: 'Initial State',
    startTime: 0,
    endTime: 2.0,
    timestampLabel: '0:00 – 0:02',
    shortDescription: 'Calm topographic map. Hex grid fades in softly.',
    summary: 'Observational state. National grid is quiet, terrain contours and boundaries visible without active risk alert.',
  },
  {
    id: 2,
    key: 'first-activation',
    title: 'First Activation',
    startTime: 2.0,
    endTime: 4.0,
    timestampLabel: '0:02 – 0:04',
    shortDescription: 'A small cluster of hex cells activates in one region.',
    summary: 'Initial slope anomaly and precipitation threshold breach detected in Garhwal / Chamoli foothills. Inactive → Low.',
  },
  {
    id: 3,
    key: 'propagation-begins',
    title: 'Propagation Begins',
    startTime: 4.0,
    endTime: 8.0,
    timestampLabel: '0:04 – 0:08',
    shortDescription: 'Risk propagates to adjacent hexagons in a natural pattern.',
    summary: 'Concentric neighbor-to-neighbor propagation wave moves outward across slope topography without fluid/blob artifacts.',
  },
  {
    id: 4,
    key: 'intensity-builds',
    title: 'Intensity Builds',
    startTime: 8.0,
    endTime: 12.0,
    timestampLabel: '0:08 – 0:12',
    shortDescription: 'Cells transition through levels (low → medium → high → critical).',
    summary: 'Multi-step transition as saturation rises: Teal → Ochre → Terracotta → Restrained Crimson with subtle breathing pulse.',
  },
  {
    id: 5,
    key: 'spatial-wave',
    title: 'Spatial Wave',
    startTime: 12.0,
    endTime: 16.0,
    timestampLabel: '0:12 – 0:16',
    shortDescription: 'Multiple clusters active. Wave continues across regions.',
    summary: 'Western Ghats (Wayanad), Northeast (Teesta/Sikkim), and Kutch activate simultaneously with incoming directional telemetry.',
  },
  {
    id: 6,
    key: 'resolved-state',
    title: 'Resolved State',
    startTime: 16.0,
    endTime: 18.0,
    timestampLabel: '0:16 – 0:18',
    shortDescription: 'Final risk state holds. Ready for interaction.',
    summary: 'Dynamic equilibrium reached. Critical cells continue subtle periodic pulse. Ready for officer inspection and dossier action.',
  },
];

export function getCurrentStage(timeSec: number): AnimationStage {
  const clamped = Math.min(Math.max(timeSec, 0), ANIMATION_DURATION_SEC);
  const found = ANIMATION_STAGES.find((s) => clamped >= s.startTime && clamped <= s.endTime);
  return found || ANIMATION_STAGES[ANIMATION_STAGES.length - 1];
}

// Color definitions matching the PRD palette
const DARK_COLORS = {
  inactive: { hex: '#1c2e29', num: 0x1c2e29 },
  low: { hex: '#10b981', num: 0x10b981 },        // Muted teal/emerald
  moderate: { hex: '#d49a45', num: 0xd49a45 },   // Ochre
  high: { hex: '#c96b3b', num: 0xc96b3b },       // Terracotta
  critical: { hex: '#b9433f', num: 0xb9433f },   // Restrained crimson
};

const LIGHT_COLORS = {
  inactive: { hex: '#ded9cc', num: 0xded9cc },
  low: { hex: '#6f8f72', num: 0x6f8f72 },        // Moss green
  moderate: { hex: '#d49a45', num: 0xd49a45 },   // Ochre
  high: { hex: '#c96b3b', num: 0xc96b3b },       // Terracotta
  critical: { hex: '#b9433f', num: 0xb9433f },   // Restrained red
};

/**
 * Evaluates the precise state of a hexagonal spatial cell at timestamp t.
 */
export function evaluateHexCellState(
  cell: HexSpatialCell,
  timeSec: number,
  isDarkTheme: boolean = true,
  pulsePhase: number = 0
): CellRenderState {
  const colors = isDarkTheme ? DARK_COLORS : LIGHT_COLORS;

  // 1. Check if cell is active yet
  if (timeSec < cell.activationTime) {
    return {
      riskState: 'inactive',
      score: 0.1,
      colorHex: colors.inactive.hex,
      threeColor: colors.inactive.num,
      height: 0.35,
      opacity: isDarkTheme ? 0.22 : 0.28,
      isPulsing: false,
      pulseScale: 1.0,
    };
  }

  // Elapsed time since this cell's specific activation onset
  const elapsed = timeSec - cell.activationTime;

  // Determine current severity based on elapsed progression time and peak severity
  let currentSeverity: HexRiskState = 'low';

  if (cell.peakSeverity === 'critical') {
    if (elapsed > 4.5) currentSeverity = 'critical';
    else if (elapsed > 2.8) currentSeverity = 'high';
    else if (elapsed > 1.2) currentSeverity = 'moderate';
    else currentSeverity = 'low';
  } else if (cell.peakSeverity === 'high') {
    if (elapsed > 3.0) currentSeverity = 'high';
    else if (elapsed > 1.4) currentSeverity = 'moderate';
    else currentSeverity = 'low';
  } else if (cell.peakSeverity === 'moderate') {
    if (elapsed > 1.8) currentSeverity = 'moderate';
    else currentSeverity = 'low';
  }

  // Height and opacity scaling based on risk level
  let height = 0.8;
  let opacity = isDarkTheme ? 0.82 : 0.85;
  let isPulsing = false;
  let pulseScale = 1.0;

  if (currentSeverity === 'critical') {
    height = 2.4;
    opacity = isDarkTheme ? 0.95 : 0.95;
    isPulsing = true;
    // Gentle breathing pulse (1.2s periodic sine wave)
    pulseScale = 1.0 + Math.sin(pulsePhase * 3.5 + cell.x) * 0.12;
  } else if (currentSeverity === 'high') {
    height = 1.7;
    opacity = isDarkTheme ? 0.90 : 0.90;
  } else if (currentSeverity === 'moderate') {
    height = 1.25;
    opacity = isDarkTheme ? 0.86 : 0.88;
  }

  const colorObj = colors[currentSeverity];
  const score = currentSeverity === 'critical' ? 0.92 : currentSeverity === 'high' ? 0.81 : currentSeverity === 'moderate' ? 0.65 : 0.42;

  return {
    riskState: currentSeverity,
    score,
    colorHex: colorObj.hex,
    threeColor: colorObj.num,
    height,
    opacity,
    isPulsing,
    pulseScale,
  };
}

/**
 * Returns active directional data pulse transmissions between cells/regions.
 */
export function getActiveDataPulses(timeSec: number): DataPulseSignal[] {
  // Pulses active primarily in Stage 5: Spatial Wave (12.0 to 16.0s)
  if (timeSec < 11.5 || timeSec > 16.5) return [];

  const stageTime = timeSec - 11.5; // 0 to 5.0s
  const pulses: DataPulseSignal[] = [];

  // Data pulse 1: Satellite Ingest → Himalayan Arc
  const prog1 = (stageTime * 0.8) % 1.0;
  pulses.push({
    id: 'pulse-insat-himalaya',
    fromCoords: { x: 0, y: 35 },
    toCoords: { x: 4, y: 13 },
    progress: prog1,
    intensity: Math.sin(prog1 * Math.PI),
    label: 'RADAR-SAR',
  });

  // Data pulse 2: Western Ghats corridor relay
  const prog2 = ((stageTime + 0.3) * 0.75) % 1.0;
  pulses.push({
    id: 'pulse-west-ghats',
    fromCoords: { x: -14, y: -15 },
    toCoords: { x: -8, y: -26 },
    progress: prog2,
    intensity: Math.sin(prog2 * Math.PI),
    label: 'HYDRO-PRECIP',
  });

  // Data pulse 3: Eastern Teesta / Brahmaputra basin
  const prog3 = ((stageTime + 0.7) * 0.7) % 1.0;
  pulses.push({
    id: 'pulse-teesta',
    fromCoords: { x: 18, y: 3 },
    toCoords: { x: 27, y: 8 },
    progress: prog3,
    intensity: Math.sin(prog3 * Math.PI),
    label: 'GLOF-TELEMETRY',
  });

  return pulses;
}
