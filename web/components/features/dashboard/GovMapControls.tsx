'use client';

import React from 'react';
import {
  HAZARDS,
  REGIONS,
  RISK_LEVELS,
  SCENARIO_TIMESTAMPS,
  HazardFilter,
  RiskLevelFilter,
  ScenarioTime
} from './demoData';

export interface GovMapControlsProps {
  selectedHazard: HazardFilter;
  selectedRegion: string;
  selectedRisk: RiskLevelFilter;
  selectedScenarioTime: ScenarioTime;
  onSelectHazard: (hazard: HazardFilter) => void;
  onSelectRegion: (region: string) => void;
  onSelectRisk: (risk: RiskLevelFilter) => void;
  onSelectScenarioTime: (time: ScenarioTime) => void;
  onResetFilters?: () => void;
  isDarkTheme?: boolean;
  onToggleTheme?: () => void;
  className?: string;
}

export const GovMapControls: React.FC<GovMapControlsProps> = ({
  selectedHazard,
  selectedRegion,
  selectedRisk,
  selectedScenarioTime,
  onSelectHazard,
  onSelectRegion,
  onSelectRisk,
  onSelectScenarioTime,
  onResetFilters,
  isDarkTheme = true,
  onToggleTheme,
  className = ''
}) => {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 p-2.5 bg-gov-bg-light/95 dark:bg-gov-bg/95 backdrop-blur-md rounded-lg border border-gov-bg/15 dark:border-gov-bg-light/15 shadow-sm text-xs ${className}`}
    >
      {/* LEFT SECTION: FILTERS */}
      <div className="flex flex-wrap items-center gap-2">
        {/* HAZARD TYPE FILTER */}
        <div className="flex items-center gap-1.5 bg-gov-surface-light/80 dark:bg-gov-surface/80 px-2.5 py-1 rounded border border-gov-bg/10 dark:border-gov-bg-light/10">
          <span className="text-[10px] font-bold text-gov-bg/60 dark:text-cream/60 uppercase tracking-wider">
            Hazard:
          </span>
          <select
            value={selectedHazard}
            onChange={(e) => onSelectHazard(e.target.value as HazardFilter)}
            className="bg-transparent text-gov-bg dark:text-cream font-medium text-xs focus:outline-none cursor-pointer"
          >
            {HAZARDS.map((h) => (
              <option key={h} value={h} className="bg-gov-bg-light dark:bg-gov-bg text-gov-bg dark:text-cream">
                {h}
              </option>
            ))}
          </select>
        </div>

        {/* REGION / STATE SELECTOR */}
        <div className="flex items-center gap-1.5 bg-gov-surface-light/80 dark:bg-gov-surface/80 px-2.5 py-1 rounded border border-gov-bg/10 dark:border-gov-bg-light/10">
          <span className="text-[10px] font-bold text-gov-bg/60 dark:text-cream/60 uppercase tracking-wider">
            Region:
          </span>
          <select
            value={selectedRegion}
            onChange={(e) => onSelectRegion(e.target.value)}
            className="bg-transparent text-gov-bg dark:text-cream font-medium text-xs focus:outline-none cursor-pointer max-w-[120px] truncate"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r} className="bg-gov-bg-light dark:bg-gov-bg text-gov-bg dark:text-cream">
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* RISK LEVEL FILTER CHIPS */}
        <div className="flex items-center gap-1 bg-gov-surface-light/80 dark:bg-gov-surface/80 p-0.5 rounded border border-gov-bg/10 dark:border-gov-bg-light/10">
          {RISK_LEVELS.map((rl) => {
            const isActive = selectedRisk === rl.id;
            let activeStyle = 'bg-gov-bg text-cream dark:bg-gov-bg-light dark:text-gov-bg';
            if (rl.id === 'Permanent Red Zone' && isActive) {
              activeStyle = 'bg-gov-red text-white';
            } else if (rl.id === 'Active Alert' && isActive) {
              activeStyle = 'bg-gov-orange text-white';
            } else if (rl.id === 'Forecast Alert' && isActive) {
              activeStyle = 'bg-gov-amber text-white';
            }

            return (
              <button
                key={rl.id}
                type="button"
                onClick={() => onSelectRisk(rl.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? `${activeStyle} shadow-xs font-semibold`
                    : 'text-gov-bg/70 dark:text-cream/70 hover:bg-gov-bg/5 dark:hover:bg-gov-bg-light/5'
                }`}
              >
                {rl.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT SECTION: 72-HOUR SCENARIO SCRUBBER */}
      <div className="flex items-center gap-2 bg-gov-surface-light/80 dark:bg-gov-surface/80 px-2.5 py-1 rounded border border-gov-bg/10 dark:border-gov-bg-light/10">
        <div className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5 text-gov-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] font-bold text-gov-bg/60 dark:text-cream/60 uppercase tracking-wider">
            72h Scenario:
          </span>
        </div>

        <div className="flex items-center gap-1">
          {SCENARIO_TIMESTAMPS.map((st) => {
            const isSelected = selectedScenarioTime === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => onSelectScenarioTime(st.id)}
                className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-gov-bg text-cream dark:bg-gov-bg-light dark:text-gov-bg shadow-xs'
                    : 'text-gov-bg/60 dark:text-cream/60 hover:text-gov-bg dark:hover:text-cream'
                }`}
                title={st.description}
              >
                {st.label}
              </button>
            );
          })}
        </div>

        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="text-[10px] text-gov-bg/50 dark:text-cream/50 hover:text-gov-red ml-1 pl-1 border-l border-gov-bg/10 dark:border-gov-bg-light/10 transition-colors"
            title="Reset to All"
          >
            Reset
          </button>
        )}

        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded ml-1 bg-gov-bg/10 dark:bg-gov-bg-light/10 text-gov-bg dark:text-cream hover:bg-gov-amber hover:text-gov-surface transition-all cursor-pointer"
            title={isDarkTheme ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <span className="material-symbols-outlined text-xs">
              {isDarkTheme ? 'light_mode' : 'dark_mode'}
            </span>
            <span className="hidden sm:inline">{isDarkTheme ? 'Light' : 'Dark'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default GovMapControls;
