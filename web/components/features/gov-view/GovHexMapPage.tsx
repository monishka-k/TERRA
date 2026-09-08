'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/components/providers';
import { GovMapStage } from '../dashboard/GovMapStage';
import { GovMapHeader } from './GovMapHeader';
import { GovMapBottomBar } from './GovMapBottomBar';
import { GovAnimationDrawer } from './GovAnimationDrawer';
import { DEMO_HABITATIONS } from '../dashboard/demoData';

export interface GovHexMapPageProps {
  /** Target link for returning to landing overview (default '/') */
  overviewHref?: string;
  /** Target link for switching to Citizen Stories Portal (default '/stories') */
  storiesHref?: string;
  /** Target link for opening the 3-panel command workspace (default '/workspace') */
  workspaceHref?: string;
  /** Callback to return to landing overview */
  onBackToOverview?: () => void;
  /** Callback to switch to Public Citizen Portal */
  onSwitchToPublicPortal?: () => void;
  /** Custom root className */
  className?: string;
}

const STAGE_TIMES = [1.0, 3.5, 6.0, 10.0, 14.0, 17.0];

export const GovHexMapPage: React.FC<GovHexMapPageProps> = ({
  overviewHref = '/',
  storiesHref = '/stories',
  workspaceHref = '/workspace',
  onBackToOverview,
  onSwitchToPublicPortal,
  className = '',
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';
  const [currentTime, setCurrentTime] = useState<number>(10.0); // Start at Intensity Builds
  const [activeStageIndex, setActiveStageIndex] = useState<number>(3);
  const [isExplainDrawerOpen, setIsExplainDrawerOpen] = useState(false);

  // Auto-advance continuous simulation loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setCurrentTime((prev) => {
        const next = prev + dt * 0.5;
        return next > 18 ? 0 : next;
      });
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleSelectStage = (idx: number) => {
    setActiveStageIndex(idx);
    setCurrentTime(STAGE_TIMES[idx]);
  };

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden flex flex-col justify-between select-none transition-colors duration-500 ${
        isDarkTheme ? 'bg-[#0b1614]' : 'bg-[#F7F5F0]'
      } ${className}`}
    >
      {/* 1. MINIMAL FLOATING TOP HEADER */}
      <GovMapHeader
        isDarkTheme={isDarkTheme}
        onToggleTheme={toggleTheme}
        activeStageIndex={activeStageIndex}
        onSelectStage={handleSelectStage}
        isExplainDrawerOpen={isExplainDrawerOpen}
        onToggleExplainDrawer={() => setIsExplainDrawerOpen((prev) => !prev)}
        overviewHref={overviewHref}
        storiesHref={storiesHref}
        workspaceHref={workspaceHref}
        onSwitchToPublicPortal={onSwitchToPublicPortal}
        onBackToOverview={onBackToOverview}
        className="relative z-20"
      />

      {/* 2. PURE MAP OF INDIA WITH PRE-MAPPED HEXAGONS (HERO CANVAS) */}
      <div className="absolute inset-0 z-0 w-full h-full">
        <GovMapStage
          selectedHabitation={DEMO_HABITATIONS[0]}
          selectedHazard="All"
          selectedRegion="All India"
          selectedRisk="All"
          selectedScenarioTime="Now"
          onSelectHabitation={() => {}}
          currentTime={currentTime}
          isDarkTheme={isDarkTheme}
          className="w-full h-full"
        />
      </div>

      {/* 3. HORIZONTAL RISK LEGEND & SATELLITE OVERPASS BOTTOM BAR */}
      <GovMapBottomBar isDarkTheme={isDarkTheme} className="relative z-20" />

      {/* 4. OPTIONAL "ANIMATION EXPLAINED" DRAWER (IMAGE 1 RIGHT COLUMN) */}
      <GovAnimationDrawer
        isOpen={isExplainDrawerOpen}
        onClose={() => setIsExplainDrawerOpen(false)}
        isDarkTheme={isDarkTheme}
      />
    </div>
  );
};

export default GovHexMapPage;
