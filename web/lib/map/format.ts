/** Display formatters shared by the legend, tooltip and dossier. */

export function formatScore(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatMetres(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)} m`;
}

export function formatDegrees(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}°`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString();
}

/**
 * Shortens an H3 index for tight UI.
 *
 * Trailing `f`s are padding for unused resolution digits — every res-8 cell ends in seven
 * of them — so trimming the tail is what actually leaves the distinguishing part visible.
 * Truncating the middle instead would render every cell in one district identically.
 */
export function formatH3(h3: string): string {
  const trimmed = h3.replace(/f+$/i, '');
  return trimmed.length > 0 ? trimmed : h3;
}
