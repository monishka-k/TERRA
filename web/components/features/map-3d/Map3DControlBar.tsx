'use client';

import React from 'react';
import { REGIONAL_CAMERA_PRESETS, CameraRegionPreset } from '@/lib/geo/indiaBoundary';

export interface Map3DControlBarProps {
  activePresetId?: string;
  onSelectPreset: (preset: CameraRegionPreset) => void;
  isTopDown?: boolean;
  onToggleTopDown?: () => void;
  onResetCamera?: () => void;
  isLoading?: boolean;
  cellCount?: number;
  className?: string;
}

/**
 * Floating HUD Control Bar for 3D Subcontinent Navigation.
 */
export const Map3DControlBar: React.FC<Map3DControlBarProps> = ({
  activePresetId = 'national',
  onSelectPreset,
  isTopDown = false,
  onToggleTopDown,
  onResetCamera,
  isLoading = false,
  cellCount = 0,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 p-2 rounded-2xl glass-card border border-line dark:border-white/10 shadow-xl backdrop-blur-xl pointer-events-auto ${className}`}
    >
      {/* 1. Regional Jump Chips */}
      <div className="flex items-center gap-1 overflow-x-auto py-0.5">
        <span className="text-[11px] font-mono text-text-muted px-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-citron animate-pulse" />
          <span>REGION:</span>
        </span>
        {Object.values(REGIONAL_CAMERA_PRESETS).map((preset) => {
          const isActive = preset.id === activePresetId;
          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-citron text-[#0b1c15] font-semibold shadow-md'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2 dark:hover:bg-white/5'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* 2. Controls & Status */}
      <div className="flex items-center gap-2">
        {/* Stream Status / Cell Count */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-1 dark:bg-white/5 border border-line dark:border-white/10 text-xs font-mono">
          {isLoading ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-amber-400">CONNECTING STREAM…</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-citron" />
              <span className="text-text-secondary">
                {cellCount > 0 ? `${cellCount.toLocaleString()} CELLS` : 'STANDBY (AWAITING DATA)'}
              </span>
            </>
          )}
        </div>

        {/* View Perspective Toggle */}
        {onToggleTopDown && (
          <button
            onClick={onToggleTopDown}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all border cursor-pointer ${
              isTopDown
                ? 'bg-surface-2 text-text-primary border-citron'
                : 'text-text-secondary hover:text-text-primary border-line dark:border-white/10 hover:bg-surface-2'
            }`}
            title="Toggle Top-Down vs 3D Perspective View"
          >
            {isTopDown ? '2D PLAN' : '3D OBLIQUE'}
          </button>
        )}

        {/* Reset Camera Button */}
        {onResetCamera && (
          <button
            onClick={onResetCamera}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Reset Camera Position"
          >
            <span className="material-symbols-outlined text-base">restart_alt</span>
          </button>
        )}
      </div>
    </div>
  );
};
