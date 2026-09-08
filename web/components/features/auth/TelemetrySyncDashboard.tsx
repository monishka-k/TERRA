'use client';

import React from 'react';

export interface TelemetrySyncDashboardProps {
  /** Current synchronization progress percentage (0 - 100) */
  progress: number;
  /** Dynamic tactical status log */
  currentLog: string;
  /** Status action headline */
  actionLabel?: string;
  /** Whether authentication is complete */
  isComplete?: boolean;
  /** Callback for emergency bypass / override */
  onEmergencyOverride?: () => void;
  /** Custom root className */
  className?: string;
}

export const TelemetrySyncDashboard: React.FC<TelemetrySyncDashboardProps> = ({
  progress,
  currentLog,
  actionLabel = 'AUTHENTICATING CIPHER STREAM...',
  isComplete = false,
  onEmergencyOverride,
  className = '',
}) => {
  return (
    <footer
      className={`relative z-10 w-full px-6 pb-6 pt-2 max-w-xl mx-auto flex flex-col space-y-4 select-none ${className}`}
      data-purpose="hud-telemetry-controls"
    >
      {/* Dynamic Status Pill */}
      <div className="text-center space-y-2">
        <div
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-mono tracking-wider transition-all duration-300 backdrop-blur-md ${
            isComplete
              ? 'bg-citron/25 text-citron border-citron'
              : 'bg-forest-surface border-citron/30 text-citron'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isComplete ? 'bg-citron' : 'bg-citron animate-ping'}`} />
          <span>{actionLabel}</span>
        </div>
        
        <div className="text-[11px] font-mono text-text-muted h-4 transition-opacity duration-200">
          {currentLog}
        </div>
      </div>

      {/* Progress Bar & Percentage Readout */}
      <div className="w-full space-y-1.5">
        <div className="flex justify-between text-xs font-mono text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-citron" />
            <span>TELEMETRY SYNCHRONIZATION</span>
          </span>
          <span className="text-citron font-semibold">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-forest-surface border border-citron/20 overflow-hidden p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-citron via-accent-emerald-bright to-accent-emerald-light transition-all duration-300 shadow-[0_0_12px_rgba(212,241,93,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Interactive Actions: Emergency Override */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <button
          type="button"
          onClick={onEmergencyOverride}
          className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-mono font-medium tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isComplete
              ? 'bg-citron text-forest-dark font-bold border-citron shadow-[0_0_20px_rgba(212,241,93,0.5)]'
              : 'hud-glass hover:border-citron text-citron hover:bg-forest-mid/40'
          }`}
        >
          <span className="material-symbols-outlined text-sm">bolt</span>
          <span>{isComplete ? 'LAUNCHING PLATFORM...' : 'EMERGENCY OVERRIDE'}</span>
        </button>

        <div className="text-right text-[10px] font-mono text-text-dim leading-tight">
          <div>ENCRYPTION: QUANTUM-DRR-256</div>
          <div className="text-citron/60">DISASTER RELIEF PROTOCOL ACTIVE</div>
        </div>
      </div>

      {/* Safe Area Spacing Indicator */}
      <div className="w-32 h-1 bg-forest-mid rounded-full mx-auto mt-1" />
    </footer>
  );
};
