'use client';

import React from 'react';

export interface GovAnimationDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Callback to close drawer */
  onClose: () => void;
  /** Current theme */
  isDarkTheme?: boolean;
  /** Custom root className */
  className?: string;
}

const SECTIONS = [
  {
    icon: 'grain',
    title: 'WHAT THIS ANIMATION SHOWS',
    content:
      'This animation communicates how disaster risk emerges in a region and propagates through space over time based on environmental triggers and terrain susceptibility.',
  },
  {
    icon: 'wifi_tethering',
    title: 'HOW IT WORKS',
    content:
      'Incoming satellite, rainfall, and geophysical data are processed in real-time. When risk thresholds are crossed, hexagonal cells activate and pass risk to their neighboring cells, creating a wave.',
  },
  {
    icon: 'hexagon',
    title: 'HEXAGONAL GRID',
    content:
      'The hexagon represents the spatial analysis unit of the system. Each cell stores risk scores, hazard type, and exposure information.',
  },
  {
    icon: 'palette',
    title: 'RISK LEVELS',
    content:
      'Cells move through four risk levels: Low (Monitored) → Moderate → High → Critical. Critical cells pulse subtly to indicate immediate attention.',
  },
  {
    icon: 'compare_arrows',
    title: 'DATA PULSES',
    content:
      'Thin pulses between cells represent the flow of data and influence from one area to another (e.g., rainfall runoff, slope instability, seismic shocks).',
  },
  {
    icon: 'verified',
    title: 'WHY THIS MATTERS',
    content:
      'This dynamic view helps decision-makers understand not just where risk exists, but how it is evolving and where it is likely to expand next.',
  },
];

export const GovAnimationDrawer: React.FC<GovAnimationDrawerProps> = ({
  isOpen,
  onClose,
  isDarkTheme = true,
  className = '',
}) => {
  if (!isOpen) return null;

  return (
    <aside
      className={`fixed top-0 right-0 bottom-0 w-80 sm:w-96 z-40 p-6 flex flex-col justify-between overflow-y-auto border-l backdrop-blur-2xl shadow-2xl transition-all duration-300 select-none ${
        isDarkTheme
          ? 'bg-[#0e1715]/95 border-white/10 text-cream'
          : 'bg-[#F7F5F0]/95 border-[#162522]/15 text-[#162522]'
      } ${className}`}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#a3e635] text-xl">
              psychology_alt
            </span>
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              Animation Explained
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-black/20 hover:bg-black/40 flex items-center justify-center text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Explain Sections (Image 1 Right Column) */}
        <div className="space-y-5">
          {SECTIONS.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-wider opacity-90 uppercase">
                <span className="material-symbols-outlined text-sm text-[#a3e635]">
                  {sec.icon}
                </span>
                <span>{sec.title}</span>
              </div>
              <p className="text-xs leading-relaxed opacity-75 font-sans pl-5">
                {sec.content}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Design Principles */}
      <div className="pt-6 mt-6 border-t border-white/10 font-mono text-[10px] space-y-1 opacity-60">
        <div className="font-bold uppercase tracking-wider text-xs opacity-90 mb-1">
          DESIGN PRINCIPLES
        </div>
        <div>• Editorial cartography</div>
        <div>• Solarpunk color philosophy</div>
        <div>• Environmental intelligence</div>
        <div>• Calm, trustworthy, data-driven</div>
      </div>
    </aside>
  );
};

export default GovAnimationDrawer;
