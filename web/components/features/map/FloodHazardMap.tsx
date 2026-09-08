'use client';

import { useCallback, useMemo, useState } from 'react';

import type {
  HazardCell,
  HazardLayerCoverage,
  HazardLayerLegend,
  HazardType,
} from '@/lib/api/types';
import { normaliseConfidence } from '@/lib/map/colorScale';
import { DEFAULT_VIEW_STATE } from '@/lib/map/constants';

import { MapContainer, type MapViewState } from './MapContainer';
import { MapErrorFallback } from './MapErrorFallback';
import { MapSkeleton } from './MapSkeleton';
import { HexTooltip } from './HexTooltip';
import { useHazardHexLayers } from './layers/useHazardHexLayers';
import { MapControlBar } from './controls/MapControlBar';
import { LayerOpacitySlider } from './controls/LayerOpacitySlider';
import { ConfidenceHatchControl } from './controls/ConfidenceHatchControl';
import { ResolutionStepper } from './controls/ResolutionStepper';
import { CellClassToggles } from './controls/CellClassToggles';
import { MapLegendPanel } from './legend/MapLegendPanel';

export interface FloodHazardMapDisplayState {
  opacity: number;
  showConfidenceHatch: boolean;
  confidenceThreshold: number;
  showHardZero: boolean;
  showNoCoverage: boolean;
  resolution: number;
}

export interface FloodHazardMapProps {
  cells: HazardCell[];
  legend: HazardLayerLegend | null;
  coverage: HazardLayerCoverage | null;
  hazardType?: HazardType;
  isLoading?: boolean;
  errorMessage?: string | null;
  errorCode?: string | null;
  requestId?: string | null;
  onRetry?: () => void;
  selectedH3?: string | null;
  hoveredH3?: string | null;
  onSelectCell?: (h3: string | null) => void;
  onHoverCell?: (h3: string | null) => void;
  /** Display state is lifted so panels outside the map can read and drive it. */
  display: FloodHazardMapDisplayState;
  onDisplayChange?: (next: Partial<FloodHazardMapDisplayState>) => void;
  initialViewState?: MapViewState;
  styleUrl?: string;
  className?: string;
  classNames?: {
    root?: string;
    controls?: string;
  };
}

/**
 * Orchestrates the hazard map: layer construction, hover/selection, and the floating
 * control bar. Receives cells and legend as props so it stays independent of how they
 * were fetched.
 */
export const FloodHazardMap = ({
  cells,
  legend,
  coverage,
  isLoading = false,
  errorMessage = null,
  errorCode = null,
  requestId = null,
  onRetry,
  selectedH3 = null,
  hoveredH3 = null,
  onSelectCell,
  onHoverCell,
  display,
  onDisplayChange,
  initialViewState = DEFAULT_VIEW_STATE,
  styleUrl,
  className = '',
  classNames = {},
}: FloodHazardMapProps) => {
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const breaks = useMemo(() => legend?.breaks ?? [], [legend]);
  const confidenceCeiling = legend?.confidence_ceiling ?? 1;

  const handleCellClick = useCallback(
    (cell: HazardCell | null) => onSelectCell?.(cell?.h3 ?? null),
    [onSelectCell],
  );

  const handleCellHover = useCallback(
    (cell: HazardCell | null) => {
      onHoverCell?.(cell?.h3 ?? null);
      if (!cell) setPointer(null);
    },
    [onHoverCell],
  );

  const layers = useHazardHexLayers({
    cells,
    breaks,
    confidenceCeiling,
    opacity: display.opacity,
    showConfidenceHatch: display.showConfidenceHatch,
    confidenceThreshold: display.confidenceThreshold,
    showHardZero: display.showHardZero,
    showNoCoverage: display.showNoCoverage,
    selectedH3,
    hoveredH3,
    onCellClick: handleCellClick,
    onCellHover: handleCellHover,
  });

  // Only the pointer position is stored; the cell itself is derived from `hoveredH3`
  // below, so a tooltip cannot outlive the cell it describes when the layer or resolution
  // changes underneath it.
  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // Control and legend panels sit above the canvas and swallow pointer events, so
    // deck.gl never fires its own onHover(null) when the cursor crosses onto them.
    // Anchoring the tooltip to the canvas is what stops it sticking under a panel.
    if (!(event.target as HTMLElement).closest('canvas')) {
      setPointer(null);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    setPointer({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  }, []);

  const hoveredCell = useMemo(
    () => (hoveredH3 ? (cells.find((cell) => cell.h3 === hoveredH3) ?? null) : null),
    [cells, hoveredH3],
  );

  const hatchedCount = useMemo(() => {
    if (!display.showConfidenceHatch || !legend) return 0;
    return cells.filter(
      (cell) =>
        cell.quality_flag !== 'no_coverage' &&
        normaliseConfidence(cell.confidence, confidenceCeiling) < display.confidenceThreshold,
    ).length;
  }, [cells, confidenceCeiling, display.confidenceThreshold, display.showConfidenceHatch, legend]);

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setPointer(null)}
      className={['relative h-full w-full', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      <MapContainer
        layers={layers}
        initialViewState={initialViewState}
        styleUrl={styleUrl}
        onBackgroundClick={() => onSelectCell?.(null)}
      >
        <MapControlBar className={classNames.controls}>
          <div className="flex flex-col gap-3.5">
            <ResolutionStepper
              value={display.resolution}
              onValueChange={(resolution) => onDisplayChange?.({ resolution })}
            />
            <LayerOpacitySlider
              value={display.opacity}
              onValueChange={(opacity) => onDisplayChange?.({ opacity })}
            />
            <ConfidenceHatchControl
              enabled={display.showConfidenceHatch}
              threshold={display.confidenceThreshold}
              onEnabledChange={(showConfidenceHatch) => onDisplayChange?.({ showConfidenceHatch })}
              onThresholdChange={(confidenceThreshold) => onDisplayChange?.({ confidenceThreshold })}
            />
            <CellClassToggles
              showHardZero={display.showHardZero}
              showNoCoverage={display.showNoCoverage}
              onShowHardZeroChange={(showHardZero) => onDisplayChange?.({ showHardZero })}
              onShowNoCoverageChange={(showNoCoverage) => onDisplayChange?.({ showNoCoverage })}
            />
            {display.showConfidenceHatch && hatchedCount > 0 ? (
              <p className="text-[10px] leading-snug text-ink-faint">
                {hatchedCount.toLocaleString()} cells hatched.
              </p>
            ) : null}
          </div>
        </MapControlBar>

        {legend && coverage ? (
          <MapLegendPanel
            legend={legend}
            coverage={coverage}
            hatchedCount={hatchedCount}
            confidenceThreshold={display.confidenceThreshold}
          />
        ) : null}

        {hoveredCell && pointer ? (
          <HexTooltip
            cell={hoveredCell}
            x={pointer.x}
            y={pointer.y}
            confidenceCeiling={confidenceCeiling}
          />
        ) : null}
      </MapContainer>

      {isLoading ? <MapSkeleton /> : null}
      {errorMessage ? (
        <MapErrorFallback
          message={errorMessage}
          code={errorCode}
          requestId={requestId}
          onRetry={onRetry}
        />
      ) : null}
    </div>
  );
};
