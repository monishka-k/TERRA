'use client';

import React from 'react';
import Link from 'next/link';

export interface GovMapHeaderProps {
  /** Current theme */
  isDarkTheme: boolean;
  /** Callback to toggle theme */
  onToggleTheme: () => void;
  /** Active stage index (0..5) */
  activeStageIndex: number;
  /** Callback to select a stage */
  onSelectStage: (index: number) => void;
  /** Callback to toggle the Animation Explained drawer */
  onToggleExplainDrawer: () => void;
  /** Whether the explain drawer is open */
  isExplainDrawerOpen: boolean;
  /** Target link for switching to Citizen Stories Portal (default '/stories') */
  storiesHref?: string;
  /** Target link for returning to landing overview (default '/') */
  overviewHref?: string;
  /** Target link for opening the 3-panel command workspace (default '/workspace') */
  workspaceHref?: string;
  /** Optional callback to switch to Public Citizen Portal */
  onSwitchToPublicPortal?: () => void;
  /** Optional callback to return to landing overview */
  onBackToOverview?: () => void;
  /** Custom root className */
  className?: string;
}

const STAGES = [
  { step: '1', title: 'INITIAL STATE', time: 1.0 },
  { step: '2', title: 'FIRST ACTIVATION', time: 3.5 },
  { step: '3', title: 'PROPAGATION', time: 6.0 },
  { step: '4', title: 'INTENSITY BUILDS', time: 10.0 },
  { step: '5', title: 'SPATIAL WAVE', time: 14.0 },
  { step: '6', title: 'RESOLVED STATE', time: 17.0 },
];

export const GovMapHeader: React.FC<GovMapHeaderProps> = ({
  isDarkTheme,
  onToggleTheme,
  activeStageIndex,
  onSelectStage,
  onToggleExplainDrawer,
  isExplainDrawerOpen,
  storiesHref = '/stories',
  overviewHref = '/',
  workspaceHref = '/workspace',
  onSwitchToPublicPortal,
  onBackToOverview,
  className = '',
}) => {
  return (
    <header
      className={`w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 sm:px-8 sm:py-5 select-none pointer-events-auto transition-colors duration-300 ${
        isDarkTheme ? 'text-cream' : 'text-[#162522]'
      } ${className}`}
    >
      {/* Left: Title & Subtitle Matching Image 1 */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`w-2 h-2 rounded-full ${
              isDarkTheme ? 'bg-[#a3e635]' : 'bg-[#22543d]'
            } animate-ping`}
          />
          <span className="font-mono text-xs font-bold tracking-[0.2em] uppercase opacity-80">
            {isDarkTheme ? 'DARK MODE' : 'LIGHT MODE'} — HEXAGONAL RISK PROPAGATION
          </span>
        </div>
        <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight">
          Visualizing how disaster risk emerges, intensifies, and spreads across space and time
        </h1>
      </div>

      {/* Center / Right: Stage Scrubber & Actions */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Stage Pills (Image 1 stages 1..6) */}
        <div
          className={`hidden xl:flex items-center p-1 rounded-xl border backdrop-blur-md ${
            isDarkTheme
              ? 'bg-black/40 border-white/10'
              : 'bg-white/80 border-[#162522]/15 shadow-xs'
          }`}
        >
          {STAGES.map((s, idx) => (
            <button
              key={s.step}
              type="button"
              onClick={() => onSelectStage(idx)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                activeStageIndex === idx
                  ? isDarkTheme
                    ? 'bg-[#a3e635] text-[#162522] font-bold shadow-xs'
                    : 'bg-[#162522] text-cream font-bold shadow-xs'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              {s.step}. {s.title}
            </button>
          ))}
        </div>

        {/* Dark / Light Mode Toggle Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          className={`px-3 py-1.5 rounded-xl border font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-md ${
            isDarkTheme
              ? 'bg-white/10 hover:bg-white/20 border-white/20 text-cream'
              : 'bg-[#162522]/10 hover:bg-[#162522]/20 border-[#162522]/20 text-[#162522]'
          }`}
          title="Toggle Dark / Light Mode"
        >
          <span className="material-symbols-outlined text-sm">
            {isDarkTheme ? 'light_mode' : 'dark_mode'}
          </span>
          <span>{isDarkTheme ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {/* Explain Sidebar Toggle */}
        <button
          type="button"
          onClick={onToggleExplainDrawer}
          className={`px-3 py-1.5 rounded-xl border font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-md ${
            isExplainDrawerOpen
              ? 'bg-[#a3e635] text-[#162522] border-[#a3e635] font-bold'
              : isDarkTheme
              ? 'bg-white/10 hover:bg-white/20 border-white/20 text-cream'
              : 'bg-[#162522]/10 hover:bg-[#162522]/20 border-[#162522]/20 text-[#162522]'
          }`}
        >
          <span className="material-symbols-outlined text-sm">info</span>
          <span className="hidden sm:inline">Explained</span>
        </button>

        {/* Open Operational Decision Workspace */}
        <Link
          href={workspaceHref}
          className={`px-3 py-1.5 rounded-xl border font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-md ${
            isDarkTheme
              ? 'bg-citron/15 hover:bg-citron/25 border-citron/40 text-citron font-semibold'
              : 'bg-[#162522]/10 hover:bg-[#162522]/20 border-[#162522]/30 text-[#162522] font-semibold'
          }`}
          title="Open NDRF Triage & Risk Dossier Workspace"
        >
          <span className="material-symbols-outlined text-sm">dashboard</span>
          <span>Workspace</span>
        </Link>

        {/* Switch to Citizen Stories Portal */}
        {onSwitchToPublicPortal ? (
          <button
            type="button"
            onClick={onSwitchToPublicPortal}
            className={`px-3 py-1.5 rounded-xl border font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-md ${
              isDarkTheme
                ? 'bg-[#143d2c]/80 hover:bg-[#143d2c] border-[#a3e635]/40 text-[#a3e635]'
                : 'bg-[#22543d]/10 hover:bg-[#22543d]/20 border-[#22543d]/30 text-[#22543d]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">explore</span>
            <span>Citizen Stories</span>
          </button>
        ) : (
          <Link
            href={storiesHref}
            className={`px-3 py-1.5 rounded-xl border font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-md ${
              isDarkTheme
                ? 'bg-[#143d2c]/80 hover:bg-[#143d2c] border-[#a3e635]/40 text-[#a3e635]'
                : 'bg-[#22543d]/10 hover:bg-[#22543d]/20 border-[#22543d]/30 text-[#22543d]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">explore</span>
            <span>Citizen Stories</span>
          </Link>
        )}

        {/* Overview / Back */}
        {onBackToOverview ? (
          <button
            type="button"
            onClick={onBackToOverview}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer backdrop-blur-md ${
              isDarkTheme
                ? 'bg-white/10 hover:bg-white/20 border-white/20 text-cream'
                : 'bg-[#162522]/10 hover:bg-[#162522]/20 border-[#162522]/20 text-[#162522]'
            }`}
            title="Return to Overview"
          >
            <span className="material-symbols-outlined text-base">logout</span>
          </button>
        ) : (
          <Link
            href={overviewHref}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer backdrop-blur-md ${
              isDarkTheme
                ? 'bg-white/10 hover:bg-white/20 border-white/20 text-cream'
                : 'bg-[#162522]/10 hover:bg-[#162522]/20 border-[#162522]/20 text-[#162522]'
            }`}
            title="Return to Overview"
          >
            <span className="material-symbols-outlined text-base">logout</span>
          </Link>
        )}
      </div>
    </header>
  );
};

export default GovMapHeader;
