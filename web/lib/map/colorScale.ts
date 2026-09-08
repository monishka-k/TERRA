/**
 * Quantile classification for hazard susceptibility.
 *
 * A linear 0→1 ramp renders the Barpeta flood layer almost uniformly: half its cells sit
 * between 0.39 and 0.48, because mean HAND of 1.83 m across the floodplain saturates the
 * `1 - HAND/P99` term of `S_f`. Classing on the server-supplied quantile breaks puts the
 * contrast where the cells actually are.
 */

import type { CoverageFlag, HazardCell } from '@/lib/api/types';
import {
  HARD_ZERO_COLOR,
  SUSCEPTIBILITY_RAMP,
  type RGBAColor,
} from './constants';

/** How a cell should be drawn, resolved from its score and coverage provenance. */
export type CellRenderClass = 'measured' | 'hard_zero' | 'no_coverage';

export interface ClassifiedBreak {
  /** Inclusive lower bound of the class. */
  min: number;
  /** Exclusive upper bound, or Infinity for the top class. */
  max: number;
  color: RGBAColor;
  label: string;
}

/** Returns the index of the class a value falls into, given ascending breaks. */
export function classIndexFor(value: number, breaks: readonly number[]): number {
  let index = 0;
  while (index < breaks.length && value >= breaks[index]) index += 1;
  return index;
}

/** Maps a susceptibility value onto the ramp using server-computed quantile breaks. */
export function susceptibilityColor(
  value: number,
  breaks: readonly number[],
  ramp: readonly RGBAColor[] = SUSCEPTIBILITY_RAMP,
): RGBAColor {
  const index = Math.min(classIndexFor(value, breaks), ramp.length - 1);
  return ramp[index];
}

/**
 * Decides how a cell is drawn.
 *
 * The critical case: `susceptibility === 0` means "safe" only when the cell was observed.
 * On a `no_coverage` cell that zero came from `apply_quality_flags()` filling NaN, so it
 * gets an outline rather than a fill — an unobserved cell must not read as the safest
 * place on the map.
 */
export function renderClassFor(cell: {
  susceptibility: number;
  quality_flag: CoverageFlag;
  hard_zero_fraction: number | null;
}): CellRenderClass {
  if (cell.quality_flag === 'no_coverage') return 'no_coverage';
  if (cell.susceptibility <= 0 && (cell.hard_zero_fraction ?? 0) > 0) return 'hard_zero';
  if (cell.susceptibility <= 0) return 'no_coverage';
  return 'measured';
}

/** Resolves the final fill colour for a cell, honouring an opacity multiplier in [0,1]. */
export function cellFillColor(
  cell: HazardCell,
  breaks: readonly number[],
  opacity = 1,
  ramp: readonly RGBAColor[] = SUSCEPTIBILITY_RAMP,
): RGBAColor {
  const renderClass = renderClassFor(cell);
  const base =
    renderClass === 'hard_zero'
      ? HARD_ZERO_COLOR
      : susceptibilityColor(cell.susceptibility, breaks, ramp);
  return [base[0], base[1], base[2], Math.round(base[3] * clamp01(opacity))];
}

/** Builds legend rows from the API's breaks, so legend and map can never disagree. */
export function buildLegendClasses(
  breaks: readonly number[],
  domain: readonly number[],
  ramp: readonly RGBAColor[] = SUSCEPTIBILITY_RAMP,
): ClassifiedBreak[] {
  const min = domain[0] ?? 0;
  const max = domain[1] ?? 1;
  const bounds = [min, ...breaks, max];
  const classes: ClassifiedBreak[] = [];

  for (let i = 0; i < breaks.length + 1; i += 1) {
    const lower = bounds[i];
    const upper = bounds[i + 1] ?? max;
    classes.push({
      min: lower,
      max: upper,
      color: ramp[Math.min(i, ramp.length - 1)],
      label: `${formatBound(lower)} – ${formatBound(upper)}`,
    });
  }
  return classes;
}

/**
 * Converts raw confidence to a displayable [0,1] value.
 *
 * Always normalise against the layer ceiling: the flood layer's raw maximum is 0.167,
 * so treating raw confidence as if it were already [0,1] would report every cell as
 * near-worthless when in fact they are all equally well observed.
 */
export function normaliseConfidence(confidence: number, ceiling: number): number {
  if (!ceiling || ceiling <= 0) return clamp01(confidence);
  return clamp01(confidence / ceiling);
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function rgbaToCss(color: RGBAColor): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${(color[3] / 255).toFixed(3)})`;
}

function formatBound(value: number): string {
  return value.toFixed(2);
}
