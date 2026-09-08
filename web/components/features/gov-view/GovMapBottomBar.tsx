'use client';

import React from 'react';

export interface GovMapBottomBarProps {
  /** Dark mode flag */
  isDarkTheme?: boolean;
  /** Custom root className */
  className?: string;
}

export const GovMapBottomBar: React.FC<GovMapBottomBarProps> = ({
  isDarkTheme = true,
  className = '',
}) => {
  return (
    <footer
      className={`w-full flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 border-t select-none pointer-events-auto backdrop-blur-xl transition-colors duration-300 ${
        isDarkTheme
          ? 'bg-[#0e1715]/90 border-white/10 text-cream'
          : 'bg-[#F7F5F0]/95 border-[#162522]/15 text-[#162522]'
      } ${className}`}
    >
      {/* Left: Risk Levels & Symbols (Image 1 Bottom Bar) */}
      <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
        {/* Title */}
        <span className="font-bold tracking-widest uppercase opacity-70">
          RISK LEVELS
        </span>

        {/* 1. Low */}
        <div className="flex items-center gap-2">
          <span
            className={`w-3.5 h-3.5 rounded-sm border ${
              isDarkTheme
                ? 'border-[#6F8F72] bg-[#6F8F72]/30'
                : 'border-[#5A7A5D] bg-[#5A7A5D]/20'
            }`}
          />
          <span className="opacity-90">LOW (MONITORED)</span>
        </div>

        {/* 2. Moderate */}
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-sm bg-[#D49A45] shadow-xs" />
          <span className="opacity-90">MODERATE</span>
        </div>

        {/* 3. High */}
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-sm bg-[#C96B3B] shadow-xs" />
          <span className="opacity-90">HIGH</span>
        </div>

        {/* 4. Critical (Pulsing) */}
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-sm bg-[#B9433F] relative flex items-center justify-center">
            <span className="animate-ping absolute inset-0 rounded-sm bg-[#B9433F] opacity-75" />
          </span>
          <span className="font-semibold text-red-400">CRITICAL (PULSING)</span>
        </div>

        {/* Divider */}
        <span className="opacity-20 hidden md:inline">|</span>

        {/* Symbology Indicators */}
        <div className="hidden lg:flex items-center gap-5 text-xs opacity-75">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cream" />
            <span>HABITATION</span>
          </div>

          <div className="flex items-center gap-1 font-bold text-[#a3e635]">
            <span>&gt;&gt;&gt;</span>
            <span>DATA PULSE</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-4 h-[1.5px] bg-cream/60" />
            <span>BOUNDARY</span>
          </div>
        </div>
      </div>

      {/* Right: Satellite SAR Overpass Badge (Image 1 Bottom Right) */}
      <div
        className={`px-4 py-2 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs font-mono ${
          isDarkTheme
            ? 'bg-black/40 border-white/15'
            : 'bg-white/80 border-[#162522]/15 shadow-xs'
        }`}
      >
        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-60">
          SATELLITE SAR OVERPASS
        </span>
        <span className="hidden sm:inline opacity-30">|</span>
        <span className="font-bold tracking-tight">
          INDIA | WAYANAD_S1A_RTC_2024
        </span>
        <span className="flex items-center gap-1 text-[#a3e635] font-bold">
          <span className="w-2 h-2 rounded-full bg-[#a3e635] animate-ping" />
          <span>LIVE</span>
        </span>
      </div>
    </footer>
  );
};

export default GovMapBottomBar;
