'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/components/providers';
import { GovNavRail, NavTab } from './GovNavRail';
import { GovHeader } from './GovHeader';
import { GovTelemetryMetrics } from './GovTelemetryMetrics';
import { GovMapControls } from './GovMapControls';
import { GovRiskLegend } from './GovRiskLegend';
import { GovMapStage } from './GovMapStage';
import { GovDossierPanel } from './GovDossierPanel';
import { GovRelocationPlanner } from './GovRelocationPlanner';
import { GovHabitationModal } from './GovHabitationModal';
import {
  StoryboardScrubber,
  TelemetrySidebar,
  SarOverpassBadge,
  ANIMATION_DURATION_SEC,
  HexSpatialCell,
} from './animation';
import {
  DEMO_HABITATIONS,
  HabitationData,
  HazardFilter,
  RiskLevelFilter,
  ScenarioTime
} from './demoData';

export interface GovDashboardProps {
  officerId?: string;
  onLogout?: () => void;
  className?: string;
}

export const GovDashboard: React.FC<GovDashboardProps> = ({
  officerId = 'NDRF-OFFICER-894',
  onLogout,
  className = ''
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';

  // Navigation & View State
  const [activeTab, setActiveTab] = useState<NavTab>('risk-map');
  const [currentView, setCurrentView] = useState<'map' | 'relocation'>('map');

  // Animation Engine State
  const [currentTime, setCurrentTime] = useState<number>(3.5); // Start at First Activation
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Filter States
  const [selectedHazard, setSelectedHazard] = useState<HazardFilter>('All');
  const [selectedRegion, setSelectedRegion] = useState<string>('All India');
  const [selectedRisk, setSelectedRisk] = useState<RiskLevelFilter>('All');
  const [selectedScenarioTime, setSelectedScenarioTime] = useState<ScenarioTime>('Now');

  // Selected Entities
  const [selectedHabitation, setSelectedHabitation] = useState<HabitationData | null>(
    DEMO_HABITATIONS[0] // Default selected: Joshimath
  );
  const [isDossierOpen, setIsDossierOpen] = useState<boolean>(true);
  const [isHabitationModalOpen, setIsHabitationModalOpen] = useState<boolean>(false);

  // 60 FPS Clock Driver for Hexagonal Risk Propagation Simulation
  useEffect(() => {
    if (!isPlaying) return;
    let lastTime = performance.now();
    let animId: number;

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      setCurrentTime((prev) => {
        const next = prev + dt * playbackSpeed;
        if (next >= ANIMATION_DURATION_SEC) {
          return isLooping ? 0 : ANIMATION_DURATION_SEC;
        }
        return next;
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isLooping, playbackSpeed]);

  // Compute Dynamic HUD Telemetry based on Animation Stage
  const dynamicBackscatterDb = (() => {
    if (currentTime < 2) return -21.4;
    if (currentTime < 4) return -16.8;
    if (currentTime < 8) return -10.5;
    if (currentTime < 12) return -4.2;
    if (currentTime < 16) return 1.8;
    return -2.4;
  })();

  const dynamicIncidentCount = (() => {
    if (currentTime < 2) return 18;
    if (currentTime < 4) return 29;
    if (currentTime < 8) return 46;
    if (currentTime < 12) return 72;
    if (currentTime < 16) return 94;
    return 78;
  })();

  // Handlers
  const handleSelectHabitation = useCallback((hab: HabitationData) => {
    setSelectedHabitation(hab);
    setIsDossierOpen(true);
  }, []);

  const handleSelectHexCell = useCallback((cell: HexSpatialCell) => {
    // If cell intersects a known habitation, select it
    const matched = DEMO_HABITATIONS.find(
      (h) => Math.hypot(h.mapCoords.x - cell.x, h.mapCoords.y - cell.y) < 5.0
    );
    if (matched) {
      setSelectedHabitation(matched);
      setIsDossierOpen(true);
    }
  }, []);

  const handleOpenRelocation = (hab: HabitationData) => {
    setSelectedHabitation(hab);
    setCurrentView('relocation');
    setActiveTab('relocation');
  };

  const handleBackToMap = () => {
    setCurrentView('map');
    setActiveTab('risk-map');
  };

  const handleResetFilters = () => {
    setSelectedHazard('All');
    setSelectedRegion('All India');
    setSelectedRisk('All');
    setSelectedScenarioTime('Now');
  };

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden ${
        isDarkTheme ? 'dark' : ''
      } bg-gov-bg-light dark:bg-gov-bg text-gov-bg dark:text-cream font-sans ${className}`}
    >
      {/* 1. LEFT NARROW NAVIGATION RAIL */}
      <GovNavRail
        activeTab={activeTab}
        onTabChange={(tab: NavTab) => {
          setActiveTab(tab);
          if (tab === 'relocation') {
            setCurrentView('relocation');
          } else {
            setCurrentView('map');
          }
        }}
        officerId={officerId}
      />

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* TOP COMMAND HEADER */}
        <GovHeader
          officerId={officerId}
          lastUpdatedMinAgo={3}
          onLogout={onLogout}
        />

        {/* 6-STAGE HEXAGONAL RISK PROPAGATION STORYBOARD SCRUBBER */}
        <StoryboardScrubber
          currentTime={currentTime}
          isPlaying={isPlaying}
          isLooping={isLooping}
          playbackSpeed={playbackSpeed}
          onTimeChange={(t) => setCurrentTime(t)}
          onTogglePlay={() => setIsPlaying((prev) => !prev)}
          onToggleLoop={() => setIsLooping((prev) => !prev)}
          onSpeedChange={(spd) => setPlaybackSpeed(spd)}
          onReset={() => {
            setCurrentTime(0);
            setIsPlaying(true);
          }}
        />

        {/* RESTRAINED TELEMETRY METRICS BAR */}
        <GovTelemetryMetrics
          onMetricClick={(metricId) => {
            if (metricId === 'active_alerts') setSelectedRisk('Active Alert');
            else if (metricId === 'priority_habitations') setSelectedRisk('Permanent Red Zone');
            else if (metricId === 'relocation_reviews') setCurrentView('relocation');
          }}
        />

        {/* 3. CENTER & RIGHT WORKSPACE */}
        <div className="flex-1 relative flex overflow-hidden">
          {currentView === 'map' ? (
            <>
              {/* CENTER MAP AREA */}
              <div className="flex-1 relative flex flex-col h-full overflow-hidden">
                {/* FLOATING MAP CONTROLS (TOP) */}
                <div className="absolute top-4 left-4 right-4 z-20 pointer-events-auto">
                  <GovMapControls
                    selectedHazard={selectedHazard}
                    selectedRegion={selectedRegion}
                    selectedRisk={selectedRisk}
                    selectedScenarioTime={selectedScenarioTime}
                    onSelectHazard={setSelectedHazard}
                    onSelectRegion={setSelectedRegion}
                    onSelectRisk={setSelectedRisk}
                    onSelectScenarioTime={setSelectedScenarioTime}
                    onResetFilters={handleResetFilters}
                    isDarkTheme={isDarkTheme}
                    onToggleTheme={toggleTheme}
                  />
                </div>

                {/* 3D MAP STAGE WITH HEXAGONAL RISK WAVE (HERO ELEMENT) */}
                <GovMapStage
                  selectedHabitation={selectedHabitation}
                  selectedHazard={selectedHazard}
                  selectedRegion={selectedRegion}
                  selectedRisk={selectedRisk}
                  selectedScenarioTime={selectedScenarioTime}
                  onSelectHabitation={handleSelectHabitation}
                  onSelectHexCell={handleSelectHexCell}
                  currentTime={currentTime}
                  isDarkTheme={isDarkTheme}
                  className="flex-1 w-full h-full"
                />

                {/* FLOATING TELEMETRY HUD SIDEBAR (UPPER RIGHT OVER MAP) */}
                <div className="absolute top-20 right-4 z-20 pointer-events-auto">
                  <TelemetrySidebar
                    currentBackscatterDb={dynamicBackscatterDb}
                    currentIncidents={dynamicIncidentCount}
                    onSelectHazard={(haz) => {
                      if (haz === 'landslide') setSelectedHazard('Landslide');
                      else if (haz === 'flood') setSelectedHazard('Flash Flood');
                      else if (haz === 'debris-flow') setSelectedHazard('Landslide');
                      else if (haz === 'erosion') setSelectedHazard('Coastal Erosion');
                    }}
                  />
                </div>

                {/* FLOATING RISK LEGEND & SAR OVERPASS (BOTTOM) */}
                <div className="absolute bottom-6 left-4 right-4 z-20 pointer-events-none flex flex-wrap items-end justify-between gap-3">
                  {/* Left: Risk Legend */}
                  <div className="pointer-events-auto">
                    <GovRiskLegend />
                  </div>

                  {/* Right: SATELLITE SAR OVERPASS LIVE BADGE */}
                  <div className="pointer-events-auto">
                    <SarOverpassBadge
                      overpassId="WAYANAD_S1A_RTC_2024"
                      region="INDIA"
                      isLive
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT-SIDE DOSSIER PANEL (SLIDE-OVER DECISION SUPPORT) */}
              {isDossierOpen && selectedHabitation && (
                <GovDossierPanel
                  habitation={selectedHabitation}
                  onClose={() => setIsDossierOpen(false)}
                  onOpenRelocationPlan={handleOpenRelocation}
                  onViewFullDossier={() => setIsHabitationModalOpen(true)}
                />
              )}
            </>
          ) : (
            /* RELOCATION PLANNING WORKSPACE */
            <GovRelocationPlanner
              habitation={selectedHabitation || DEMO_HABITATIONS[0]}
              onBackToMap={handleBackToMap}
              className="flex-1"
            />
          )}
        </div>
      </div>

      {/* COMPREHENSIVE HABITATION DOSSIER MODAL */}
      <GovHabitationModal
        habitation={selectedHabitation}
        isOpen={isHabitationModalOpen}
        onClose={() => setIsHabitationModalOpen(false)}
        onOpenRelocation={handleOpenRelocation}
      />
    </div>
  );
};

export default GovDashboard;
