'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { Layer, PickingInfo } from '@deck.gl/core';

import { resolveBasemapStyle, registerPMTilesProtocol } from '@/lib/map/basemap';
import { DEFAULT_VIEW_STATE, MAP_ATTRIBUTION } from '@/lib/map/constants';
import { useTheme } from '@/components/providers';

import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
}

export interface MapContainerProps {
  /** deck.gl layers drawn over the basemap. */
  layers: Layer[];
  initialViewState?: MapViewState;
  /** MapLibre style URL; falls back to a flat canvas when unset. */
  styleUrl?: string;
  attribution?: string;
  /** Overlays positioned above the canvas (legend, controls, tooltip). */
  children?: ReactNode;
  onMapLoad?: (map: MapLibreMap) => void;
  onZoomChange?: (zoom: number) => void;
  /** Fires on empty-canvas clicks so callers can clear a selection. */
  onBackgroundClick?: () => void;
  className?: string;
  classNames?: {
    root?: string;
    canvas?: string;
  };
}

/**
 * MapLibre GL canvas with a deck.gl overlay.
 *
 * Purely presentational: it owns no hazard state and does no fetching. Layers arrive
 * fully built so the same canvas can render any layer stack.
 *
 * deck.gl is attached through `MapboxOverlay` in overlaid mode, which keeps MapLibre in
 * charge of camera and gestures — the H3 layers stay pinned through pan and zoom without
 * a second view-state store to keep in sync.
 */
export const MapContainer = ({
  layers,
  initialViewState = DEFAULT_VIEW_STATE,
  styleUrl,
  attribution = MAP_ATTRIBUTION,
  children,
  onMapLoad,
  onZoomChange,
  onBackgroundClick,
  className = '',
  classNames = {},
}: MapContainerProps) => {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  // Map construction is async (it awaits the pmtiles/maplibre dynamic imports), so layers
  // can arrive before the overlay exists. This flag re-runs the layer effect once it does;
  // without it the first batch of layers is dropped and the canvas stays empty.
  const [isOverlayReady, setIsOverlayReady] = useState(false);

  // Callbacks are read through refs so a new inline handler never tears down the map.
  // Assigned in an effect rather than during render: mutating a ref while rendering is
  // unsafe under concurrent React, and these are only ever read from map event handlers.
  const onMapLoadRef = useRef(onMapLoad);
  const onZoomChangeRef = useRef(onZoomChange);
  const onBackgroundClickRef = useRef(onBackgroundClick);
  const resolvedThemeRef = useRef(resolvedTheme);
  const styleUrlRef = useRef(styleUrl);
  const layersRef = useRef(layers);
  const currentStyleRef = useRef<string | StyleSpecification | null>(null);

  useEffect(() => {
    onMapLoadRef.current = onMapLoad;
    onZoomChangeRef.current = onZoomChange;
    onBackgroundClickRef.current = onBackgroundClick;
    resolvedThemeRef.current = resolvedTheme;
    styleUrlRef.current = styleUrl;
    layersRef.current = layers;
  }, [onMapLoad, onZoomChange, onBackgroundClick, resolvedTheme, styleUrl, layers]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;

    const init = async () => {
      await registerPMTilesProtocol();
      if (disposed || !containerRef.current) return;
      maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');

      const isDark = resolvedThemeRef.current === 'dark';
      const initialStyle = resolveBasemapStyle(styleUrlRef.current, isDark);
      currentStyleRef.current = initialStyle;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: initialStyle,
        center: [initialViewState.longitude, initialViewState.latitude],
        zoom: initialViewState.zoom,
        pitch: initialViewState.pitch ?? 0,
        bearing: initialViewState.bearing ?? 0,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.addControl(
        new maplibregl.AttributionControl({ compact: true, customAttribution: attribution }),
        'bottom-left',
      );

      const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
      map.addControl(overlay);

      // Keep deck.gl layers synchronized across basemap style switches
      map.on('styledata', () => {
        if (overlayRef.current && layersRef.current) {
          overlayRef.current.setProps({ layers: layersRef.current });
        }
      });

      map.on('zoomend', () => onZoomChangeRef.current?.(map.getZoom()));
      map.on('click', (event: MapMouseEvent) => {
        // deck.gl picks first; an unpicked click means the user hit empty canvas.
        const picked = overlayRef.current?.pickObject({
          x: event.point.x,
          y: event.point.y,
          radius: 2,
        }) as PickingInfo | null;
        if (!picked?.object) onBackgroundClickRef.current?.();
      });
      map.on('load', () => onMapLoadRef.current?.(map));

      mapRef.current = map;
      overlayRef.current = overlay;
      setIsOverlayReady(true);
    };

    void init();

    return () => {
      disposed = true;
      overlayRef.current?.finalize();
      overlayRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      currentStyleRef.current = null;
      setIsOverlayReady(false);
    };
    // Style and initial camera are creation-time settings; changing them later would
    // reset the user's view, so they are deliberately excluded from the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dynamically switch basemap style when theme or styleUrl changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const isDark = resolvedTheme === 'dark';
    const nextStyle = resolveBasemapStyle(styleUrl, isDark);

    const isSame =
      typeof currentStyleRef.current === 'string' && typeof nextStyle === 'string'
        ? currentStyleRef.current === nextStyle
        : JSON.stringify(currentStyleRef.current) === JSON.stringify(nextStyle);

    if (isSame) return;
    currentStyleRef.current = nextStyle;

    try {
      map.setStyle(nextStyle, { diff: false });
    } catch (err) {
      console.error('Failed to update basemap style:', err);
    }
  }, [resolvedTheme, styleUrl]);

  useEffect(() => {
    if (!isOverlayReady) return;
    overlayRef.current?.setProps({ layers });
  }, [layers, isOverlayReady]);

  return (
    <div
      className={['relative h-full w-full', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      <div ref={containerRef} className={['h-full w-full', classNames.canvas ?? ''].join(' ')} />
      {children}
    </div>
  );
};
