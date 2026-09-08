'use client';

import React from 'react';
import { HabitationData } from './demoData';

export interface GovHabitationModalProps {
  habitation: HabitationData | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenRelocation: (habitation: HabitationData) => void;
  className?: string;
}

export const GovHabitationModal: React.FC<GovHabitationModalProps> = ({
  habitation,
  isOpen,
  onClose,
  onOpenRelocation,
  className = ''
}) => {
  if (!isOpen || !habitation) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-sm ${className}`}>
      <div className="w-full max-w-3xl max-h-[90vh] bg-gov-bg-light dark:bg-gov-bg rounded-2xl border border-gov-bg/20 dark:border-gov-bg-light/20 shadow-2xl flex flex-col overflow-hidden text-gov-bg dark:text-cream">
        {/* MODAL HEADER */}
        <div className="p-6 border-b border-gov-bg/10 dark:border-gov-bg-light/10 flex items-start justify-between bg-gov-surface-light/50 dark:bg-gov-surface/50">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-gov-red uppercase">
              COMPREHENSIVE HABITATION DOSSIER · {habitation.id.toUpperCase()}
            </span>
            <h2
              className="text-2xl font-bold tracking-tight mt-1"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              {habitation.name}
            </h2>
            <div className="text-xs text-gov-bg/70 dark:text-cream/70 mt-0.5">
              {habitation.district}, {habitation.state} · Coordinates: {habitation.coordinates}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gov-bg/50 dark:text-cream/50 hover:text-gov-bg dark:hover:text-cream hover:bg-gov-bg/10 dark:hover:bg-gov-bg-light/10 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* MODAL BODY (4 CORE DIMENSIONS) */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {/* DIMENSION 1: HAZARD & TERRAIN */}
          <div className="p-4 rounded-xl bg-gov-surface-light/70 dark:bg-gov-surface/70 border border-gov-bg/10 dark:border-gov-bg-light/10">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-gov-bg/8 dark:border-gov-bg-light/8">
              <span className="text-xs font-bold uppercase tracking-wider text-gov-red flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gov-red" />
                1. Hazard Dimension
              </span>
              <span className="font-mono text-xs font-bold text-gov-red">
                Score: {habitation.breakdown.slope.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded bg-gov-bg-light/60 dark:bg-gov-bg/60">
                <div className="text-[10px] text-gov-bg/60 dark:text-cream/60">Primary Hazard</div>
                <div className="font-bold text-sm mt-0.5">{habitation.hazardType}</div>
              </div>
              <div className="p-2.5 rounded bg-gov-bg-light/60 dark:bg-gov-bg/60">
                <div className="text-[10px] text-gov-bg/60 dark:text-cream/60">Mean Slope</div>
                <div className="font-bold text-sm mt-0.5 font-mono">34.2° (Critical)</div>
              </div>
              <div className="p-2.5 rounded bg-gov-bg-light/60 dark:bg-gov-bg/60">
                <div className="text-[10px] text-gov-bg/60 dark:text-cream/60">72h Rain Anomaly</div>
                <div className="font-bold text-sm mt-0.5 font-mono text-gov-orange">+184 mm</div>
              </div>
              <div className="p-2.5 rounded bg-gov-bg-light/60 dark:bg-gov-bg/60">
                <div className="text-[10px] text-gov-bg/60 dark:text-cream/60">Historical Events</div>
                <div className="font-bold text-sm mt-0.5 font-mono">6 Landslides (10yr)</div>
              </div>
            </div>
          </div>

          {/* DIMENSION 2: EXPOSURE */}
          <div className="p-4 rounded-xl bg-gov-surface-light/70 dark:bg-gov-surface/70 border border-gov-bg/10 dark:border-gov-bg-light/10">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-gov-bg/8 dark:border-gov-bg-light/8">
              <span className="text-xs font-bold uppercase tracking-wider text-gov-orange flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gov-orange" />
                2. Exposure Dimension
              </span>
              <span className="font-mono text-xs font-bold text-gov-orange">
                Score: {habitation.breakdown.populationExposure.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded bg-gov-bg-light/60 dark:bg-gov-bg/60">
                <div className="text-[10px] text-gov-bg/60 dark:text-cream/60">Total Population</div>
                <div className="font-bold text-sm mt-0.5 font-mono">{habitation.population.toLocaleString()}</div>
              </div>
              <div className="p-2.5 rounded bg-gov-bg-light/60 dark:bg-gov-bg/60">
                <div className="text-[10px] text-gov-bg/60 dark:text-cream/60">Total Households</div>
                <div className="font-bold text-sm mt-0.5 font-mono">{habitation.households} HH</div>
              </div>
              <div className="p-2.5 rounded bg-gov-bg-light/60 dark:bg-gov-bg/60">
                <div className="text-[10px] text-gov-bg/60 dark:text-cream/60">Critical Assets</div>
                <div className="font-bold text-sm mt-0.5">2 Schools, 1 PHC</div>
              </div>
              <div className="p-2.5 rounded bg-gov-bg-light/60 dark:bg-gov-bg/60">
                <div className="text-[10px] text-gov-bg/60 dark:text-cream/60">Access Arteries</div>
                <div className="font-bold text-sm mt-0.5">NH-58 (Vulnerable)</div>
              </div>
            </div>
          </div>

          {/* DIMENSION 3: VULNERABILITY (SoVI) */}
          <div className="p-4 rounded-xl bg-gov-surface-light/70 dark:bg-gov-surface/70 border border-gov-bg/10 dark:border-gov-bg-light/10">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-gov-bg/8 dark:border-gov-bg-light/8">
              <span className="text-xs font-bold uppercase tracking-wider text-gov-amber flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gov-amber" />
                3. Vulnerability (SoVI Index)
              </span>
              <span className="font-mono text-xs font-bold text-gov-amber">Score: 0.78</span>
            </div>

            <p className="text-xs leading-relaxed text-gov-bg/80 dark:text-cream/80">
              High socio-economic vulnerability with 42% elderly/child demographic dependence. Limited secondary healthcare egress within 45 minutes of road disruption.
            </p>
          </div>

          {/* DIMENSION 4: CONFIDENCE */}
          <div className="p-4 rounded-xl bg-gov-surface-light/70 dark:bg-gov-surface/70 border border-gov-bg/10 dark:border-gov-bg-light/10">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-gov-bg/8 dark:border-gov-bg-light/8">
              <span className="text-xs font-bold uppercase tracking-wider text-gov-green flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gov-green" />
                4. Data Confidence &amp; Sensor Calibration
              </span>
              <span className="font-mono text-xs font-bold text-gov-green">92% High</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-gov-bg/70 dark:text-cream/70">
              <span>Sentinel-1 SAR RTC: <strong>Nominal</strong></span>
              <span>InSAR Coherence: <strong>0.84</strong></span>
              <span>Ground Truth Sensors: <strong>Synced 12m ago</strong></span>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="p-6 border-t border-gov-bg/10 dark:border-gov-bg-light/10 flex items-center justify-end gap-3 bg-gov-surface-light/50 dark:bg-gov-surface/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gov-bg/20 dark:border-gov-bg-light/20 text-xs font-semibold hover:bg-gov-bg/5 dark:hover:bg-gov-bg-light/5 transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenRelocation(habitation);
            }}
            className="px-5 py-2 rounded-md bg-gov-red hover:bg-gov-red/85 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all cursor-pointer"
          >
            Open Relocation Plan →
          </button>
        </div>
      </div>
    </div>
  );
};

export default GovHabitationModal;
