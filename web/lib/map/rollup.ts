/**
 * Client-side H3 roll-up for zoomed-out views.
 *
 * The flood pipeline publishes resolution 8 only. Rather than depend on the
 * `mhi_res6`/`mhi_res7` Martin materialised views (which do not exist yet), coarser
 * levels are derived in the browser with `h3.cellToParent` — cheap at 7.5k cells.
 */

import { cellToParent } from 'h3-js';

import type { CoverageFlag, HazardCell } from '@/lib/api/types';

/**
 * How child scores combine into a parent.
 *
 * `max` is the default for hazard screening: a parent containing one red-zone child
 * must read red, because averaging would hide exactly the cells the map exists to find.
 */
export type RollupAggregation = 'max' | 'mean';

export interface RollupOptions {
  targetResolution: number;
  sourceResolution?: number;
  aggregation?: RollupAggregation;
}

/**
 * Worst-case coverage wins.
 *
 * A parent is only `full` when every child was measured; if any child is blind the
 * parent cannot honestly claim full coverage, and if all are blind it stays `no_coverage`.
 */
function combineFlags(flags: CoverageFlag[]): CoverageFlag {
  if (flags.every((f) => f === 'no_coverage')) return 'no_coverage';
  if (flags.every((f) => f === 'full')) return 'full';
  return 'low_coverage';
}

export function rollupHazardCells(cells: HazardCell[], options: RollupOptions): HazardCell[] {
  const { targetResolution, sourceResolution = 8, aggregation = 'max' } = options;

  if (targetResolution >= sourceResolution || cells.length === 0) return cells;

  const groups = new Map<
    string,
    {
      susceptibilities: number[];
      confidences: number[];
      hardZeroes: number[];
      flags: CoverageFlag[];
    }
  >();

  for (const cell of cells) {
    const parent = cellToParent(cell.h3, targetResolution);
    let group = groups.get(parent);
    if (!group) {
      group = { susceptibilities: [], confidences: [], hardZeroes: [], flags: [] };
      groups.set(parent, group);
    }
    group.susceptibilities.push(cell.susceptibility);
    group.confidences.push(cell.confidence);
    group.flags.push(cell.quality_flag);
    if (cell.hard_zero_fraction !== null) group.hardZeroes.push(cell.hard_zero_fraction);
  }

  const rolled: HazardCell[] = [];
  for (const [h3, group] of groups) {
    // Unobserved children contribute no score; averaging their filled zeros would drag
    // a real parent score toward "safe".
    const measured = group.susceptibilities.filter((_, i) => group.flags[i] !== 'no_coverage');
    const pool = measured.length > 0 ? measured : group.susceptibilities;

    rolled.push({
      h3,
      susceptibility: aggregation === 'max' ? Math.max(...pool) : mean(pool),
      confidence: mean(group.confidences),
      quality_flag: combineFlags(group.flags),
      hard_zero_fraction: group.hardZeroes.length > 0 ? mean(group.hardZeroes) : null,
    });
  }

  return rolled;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
