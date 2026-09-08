'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { HexSpatialCell, CellRenderState } from './types';

export interface CellDetailTooltipProps {
  cell: HexSpatialCell | null;
  cellState?: CellRenderState;
  position: { x: number; y: number } | null;
  onOpenDossier?: (cell: HexSpatialCell) => void;
  onClose?: () => void;
  className?: string;
}

export const CellDetailTooltip: React.FC<CellDetailTooltipProps> = ({
  cell,
  cellState,
  position,
  onOpenDossier,
  onClose,
  className = '',
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!tooltipRef.current || !cell) return;
    gsap.fromTo(
      tooltipRef.current,
      { opacity: 0, y: 8, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'power2.out' }
    );
  }, [cell]);

  if (!cell || !position) return null;

  const severityColor = cellState ? cellState.colorHex : '#6f8f72';
  const severityLabel = cellState ? cellState.riskState.toUpperCase() : 'MONITORED';

  return (
    <div
      ref={tooltipRef}
      className={`absolute z-30 pointer-events-auto p-3.5 rounded-xl bg-gov-surface-light/95 dark:bg-gov-surface/95 backdrop-blur-xl border border-gov-bg/15 dark:border-gov-bg-light/15 shadow-2xl text-xs font-sans min-w-[240px] max-w-[280px] -translate-x-1/2 -translate-y-full mb-4 select-none ${className}`}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      {/* Top Header: H3 index and close */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-gov-bg/10 dark:border-gov-bg-light/10">
        <div className="flex items-center space-x-1.5 font-mono text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: severityColor }} />
          <span className="text-gov-bg/60 dark:text-cream/60">H3:</span>
          <span className="font-bold text-gov-bg dark:text-cream">{cell.h3Index.slice(0, 10)}...</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase shadow-xs"
            style={{ backgroundColor: severityColor, color: '#ffffff' }}
          >
            {severityLabel}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gov-bg/40 dark:text-cream/40 hover:text-gov-bg dark:hover:text-cream p-0.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Region & Hazard */}
      <div className="mt-2 space-y-0.5">
        <h4 className="font-bold text-sm text-gov-bg dark:text-cream">
          {cell.settlementNearby || cell.regionName}
        </h4>
        <div className="text-[11px] text-gov-bg/70 dark:text-cream/70">
          {cell.state} · Primary Hazard: <strong className="text-gov-amber">{cell.hazardType}</strong>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="mt-2.5 pt-2 border-t border-gov-bg/10 dark:border-gov-bg-light/10 grid grid-cols-2 gap-2 text-[11px] font-mono">
        <div>
          <span className="text-[10px] text-gov-bg/50 dark:text-cream/50 block">MHI Score</span>
          <span className="font-bold text-sm" style={{ color: severityColor }}>
            {(cellState?.score || cell.baseMhiScore).toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-gov-bg/50 dark:text-cream/50 block">Exposed Pop</span>
          <span className="font-bold text-sm text-gov-bg dark:text-cream">
            {cell.exposedPopulation.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-gov-bg/50 dark:text-cream/50 block">Elevation</span>
          <span className="text-gov-bg/80 dark:text-cream/80">{cell.elevationM}m MSL</span>
        </div>
        <div>
          <span className="text-[10px] text-gov-bg/50 dark:text-cream/50 block">Distance to Core</span>
          <span className="text-gov-bg/80 dark:text-cream/80">{Math.round(cell.clusterDistance * 100)}%</span>
        </div>
      </div>

      {/* Action Button: Open Dossier */}
      {onOpenDossier && (
        <div className="mt-3 pt-2 border-t border-gov-bg/10 dark:border-gov-bg-light/10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onOpenDossier(cell)}
            className="w-full py-1.5 px-3 rounded-lg bg-gov-amber hover:bg-gov-amber/90 text-gov-surface font-semibold text-xs font-mono transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
          >
            <span>Open Risk Dossier</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CellDetailTooltip;
