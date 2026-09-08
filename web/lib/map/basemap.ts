/**
 * Basemap style resolution (FR-10.2: self-hosted tiles, no third-party billing).
 *
 * Two supported paths, both self-hosted:
 *   1. `NEXT_PUBLIC_BASEMAP_STYLE_URL` — a full MapLibre style.json, from Martin,
 *      a static PMTiles bundle, or any OSM style you host.
 *   2. No env var — a flat canvas so the hazard layer is legible on its own. Deliberately
 *      not a third-party raster fallback; a demo must not acquire a billing dependency by
 *      accident.
 */

import type { StyleSpecification } from 'maplibre-gl';

export const OPENFREEMAP_DARK_STYLE_URL = '/tiles/dark-style.json';
export const OPENFREEMAP_LIGHT_STYLE_URL = '/tiles/light-style.json';

export const BASEMAP_DARK_STYLE_URL =
  process.env.NEXT_PUBLIC_BASEMAP_DARK_STYLE_URL ??
  process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL ??
  OPENFREEMAP_DARK_STYLE_URL;

export const BASEMAP_LIGHT_STYLE_URL =
  process.env.NEXT_PUBLIC_BASEMAP_LIGHT_STYLE_URL ??
  OPENFREEMAP_LIGHT_STYLE_URL;

export const BASEMAP_STYLE_URL = BASEMAP_DARK_STYLE_URL;

/** Canvas colours are read from theme palette so the map tracks the app theme. */
export const FALLBACK_BACKGROUND_DARK = '#0b0f16';
export const FALLBACK_BACKGROUND_LIGHT = '#f4f7f5';

export function createFallbackStyle(background = FALLBACK_BACKGROUND_DARK): StyleSpecification {
  return {
    version: 8,
    // MapLibre requires a glyph endpoint before any symbol layer can render. None is
    // declared here because the fallback style has no labels.
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': background },
      },
    ],
  };
}

/** Returns the style to hand MapLibre: theme-aware style URL (dark/light), explicit URL, or flat fallback. */
export function resolveBasemapStyle(
  styleUrl?: string,
  isDark = true,
): string | StyleSpecification {
  if (styleUrl === 'none' || styleUrl === 'fallback') {
    return createFallbackStyle(isDark ? FALLBACK_BACKGROUND_DARK : FALLBACK_BACKGROUND_LIGHT);
  }
  if (styleUrl) {
    return styleUrl;
  }
  return isDark ? BASEMAP_DARK_STYLE_URL : BASEMAP_LIGHT_STYLE_URL;
}

/**
 * Registers the `pmtiles://` protocol so a self-hosted PMTiles bundle can be referenced
 * directly from a style. Safe to call repeatedly; a no-op on the server.
 */
export async function registerPMTilesProtocol(): Promise<void> {
  if (typeof window === 'undefined') return;
  const scope = window as typeof window & { __setuPMTilesRegistered?: boolean };
  if (scope.__setuPMTilesRegistered) return;

  const [maplibregl, { Protocol }] = await Promise.all([
    import('maplibre-gl'),
    import('pmtiles'),
  ]);

  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  scope.__setuPMTilesRegistered = true;
}
