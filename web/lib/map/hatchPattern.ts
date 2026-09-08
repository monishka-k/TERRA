/**
 * Diagonal hatch atlas for deck.gl's FillStyleExtension.
 *
 * FR-9.3 requires model confidence to read as a hatch pattern rather than a solid colour,
 * so a low-confidence cell is visibly provisional instead of quietly darker. The atlas is
 * painted to a canvas at runtime rather than shipped as a binary asset.
 */

export interface HatchAtlas {
  /** Data URL consumed by `fillPatternAtlas`. */
  atlas: string;
  /** Frame mapping consumed by `fillPatternMapping`. */
  mapping: Record<string, { x: number; y: number; width: number; height: number; mask: boolean }>;
}

export const HATCH_PATTERN_NAME = 'diagonal';

const TILE = 64;

/**
 * Builds the atlas. Returns null when no canvas is available (SSR, or a headless
 * environment) so callers can fall back to a solid treatment instead of throwing.
 */
export function createHatchAtlas(strokeWidth = 6, gap = 14): HatchAtlas | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, TILE, TILE);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'square';

  // Draw beyond both edges so the 45° strokes tile seamlessly.
  for (let offset = -TILE; offset < TILE * 2; offset += gap) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + TILE, TILE);
    ctx.stroke();
  }

  return {
    atlas: canvas.toDataURL('image/png'),
    mapping: {
      // `mask: true` makes the pattern take its colour from getFillColor, so the hatch
      // tint can follow the theme instead of being baked into the image.
      [HATCH_PATTERN_NAME]: { x: 0, y: 0, width: TILE, height: TILE, mask: true },
    },
  };
}
