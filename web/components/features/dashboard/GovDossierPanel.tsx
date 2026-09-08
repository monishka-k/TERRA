'use client';

import React from 'react';
import { HabitationData } from './demoData';

export interface GovDossierPanelProps {
  habitation: HabitationData | null;
  onClose: () => void;
  onOpenRelocationPlan: (habitation: HabitationData) => void;
  onViewFullDossier: (habitation: HabitationData) => void;
  className?: string;
}

export const GovDossierPanel: React.FC<GovDossierPanelProps> = ({
  habitation,
  onClose,
  onOpenRelocationPlan,
  onViewFullDossier,
  className = ''
}) => {
  if (!habitation) return null;

  const priorityColor =
    habitation.priority === 'Immediate Priority'
      ? 'text-gov-red bg-gov-red/10 border-gov-red/30'
      : habitation.priority === 'Short-term Action'
      ? 'text-gov-orange bg-gov-orange/10 border-gov-orange/30'
      : 'text-gov-amber bg-gov-amber/10 border-gov-amber/30';

  return (
    <aside
      className={`w-full max-w-sm h-full bg-gov-bg-light/98 dark:bg-gov-bg/98 backdrop-blur-xl border-l border-gov-bg/15 dark:border-gov-bg-light/15 shadow-2xl flex flex-col justify-between overflow-y-auto z-20 text-gov-bg dark:text-cream transition-all duration-300 ${className}`}
    >
      {/* TOP HEADER */}
      <div className="p-5 border-b border-gov-bg/10 dark:border-gov-bg-light/10">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-gov-bg/60 dark:text-cream/60 uppercase">
              DECISION DOSSIER · {habitation.id.toUpperCase()}
            </span>
            <h2
              className="text-2xl font-bold tracking-tight text-gov-bg dark:text-cream mt-1"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              {habitation.name}
            </h2>
            <div className="text-xs text-gov-bg/70 dark:text-cream/70 mt-0.5">
              {habitation.district}, {habitation.state}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gov-bg/50 dark:text-cream/50 hover:text-gov-bg dark:hover:text-cream hover:bg-gov-bg/10 dark:hover:bg-gov-bg-light/10 transition-colors"
            title="Close dossier"
          >
            ✕
          </button>
        </div>

        {/* RISK SCORE HERO BADGE */}
        <div className="mt-4 p-3.5 rounded-lg bg-gov-surface-light/70 dark:bg-gov-surface/70 border border-gov-bg/10 dark:border-gov-bg-light/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-gov-bg/50 dark:text-cream/50 uppercase tracking-wider">
              Risk Score
            </div>
            <div
              className="text-3xl font-extrabold font-serif text-gov-red leading-none mt-1"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              {habitation.riskScore.toFixed(2)}
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className={`px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider border ${priorityColor}`}>
              {habitation.priority}
            </span>
            <span className="text-[10px] text-gov-bg/50 dark:text-cream/50 font-mono mt-1">
              Pop. {habitation.population.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* BODY CONTENT */}
      <div className="p-5 flex-1 flex flex-col gap-4 overflow-y-auto">
        {/* RISK BREAKDOWN BARS */}
        <div>
          <div className="text-[10px] font-bold tracking-wider text-gov-bg/60 dark:text-cream/60 uppercase mb-2">
            Multivariate Risk Breakdown
          </div>

          <div className="flex flex-col gap-2 bg-gov-surface-light/50 dark:bg-gov-surface/50 p-3 rounded-lg border border-gov-bg/8 dark:border-gov-bg-light/8">
            {/* Slope */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span>Slope Instability</span>
                <span className="font-mono text-[11px] font-bold text-gov-red">
                  {habitation.breakdown.slope.toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 w-full bg-gov-bg/10 dark:bg-gov-bg-light/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gov-red rounded-full transition-all duration-500"
                  style={{ width: `${habitation.breakdown.slope * 100}%` }}
                />
              </div>
            </div>

            {/* Rainfall */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span>Rainfall Anomaly</span>
                <span className="font-mono text-[11px] font-bold text-gov-orange">
                  {habitation.breakdown.rainfall.toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 w-full bg-gov-bg/10 dark:bg-gov-bg-light/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gov-orange rounded-full transition-all duration-500"
                  style={{ width: `${habitation.breakdown.rainfall * 100}%` }}
                />
              </div>
            </div>

            {/* Landslide History */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span>Landslide / Geomorphic History</span>
                <span className="font-mono text-[11px] font-bold text-gov-amber">
                  {habitation.breakdown.landslideHistory.toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 w-full bg-gov-bg/10 dark:bg-gov-bg-light/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gov-amber rounded-full transition-all duration-500"
                  style={{ width: `${habitation.breakdown.landslideHistory * 100}%` }}
                />
              </div>
            </div>

            {/* Population Exposure */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span>Population Exposure</span>
                <span className="font-mono text-[11px] font-bold text-gov-green">
                  {habitation.breakdown.populationExposure.toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 w-full bg-gov-bg/10 dark:bg-gov-bg-light/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gov-green rounded-full transition-all duration-500"
                  style={{ width: `${habitation.breakdown.populationExposure * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* WHY THIS AREA IS FLAGGED */}
        <div className="bg-gov-surface-light/60 dark:bg-gov-surface/60 p-3.5 rounded-lg border border-gov-bg/10 dark:border-gov-bg-light/10">
          <div className="text-[10px] font-bold tracking-wider text-gov-bg/60 dark:text-cream/60 uppercase mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gov-orange" />
            Why This Area Is Flagged
          </div>
          <p className="text-xs leading-relaxed text-gov-bg/90 dark:text-cream/90">
            {habitation.whyFlagged}
          </p>
        </div>

        {/* RECOMMENDED ACTION */}
        <div className="bg-gov-red/8 dark:bg-gov-red/15 p-3.5 rounded-lg border border-gov-red/25">
          <div className="text-[10px] font-bold tracking-wider text-gov-red uppercase mb-1">
            Recommended Action
          </div>
          <p className="text-xs font-medium text-gov-bg dark:text-cream">
            {habitation.recommendedAction}
          </p>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="p-5 border-t border-gov-bg/10 dark:border-gov-bg-light/10 flex flex-col gap-2 bg-gov-bg-light dark:bg-gov-bg">
        <button
          type="button"
          onClick={() => onOpenRelocationPlan(habitation)}
          className="w-full py-2.5 px-4 rounded-md bg-gov-red hover:bg-gov-red/85 text-white text-xs font-bold uppercase tracking-wider transition-all duration-150 shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>OPEN RELOCATION PLAN</span>
          <span>→</span>
        </button>

        <button
          type="button"
          onClick={() => onViewFullDossier(habitation)}
          className="w-full py-2 px-4 rounded-md bg-transparent hover:bg-gov-bg/5 dark:hover:bg-gov-bg-light/5 border border-gov-bg/20 dark:border-gov-bg-light/20 text-gov-bg dark:text-cream text-xs font-semibold transition-all duration-150 cursor-pointer text-center"
        >
          View Full Habitation Dossier
        </button>
      </div>
    </aside>
  );
};

export default GovDossierPanel;
