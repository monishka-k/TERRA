'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export interface NavRailProps {
  /** Callback for Global Overview click */
  onGlobalOverviewClick?: () => void;
  /** Callback for Hazard Map click */
  onHazardMapClick?: () => void;
  /** Callback for Habitations & Risk click */
  onHabitationsClick?: () => void;
  /** Callback for Relocation Sites click */
  onRelocationClick?: () => void;
  /** Callback for Sensor Alerts click */
  onSensorAlertsClick?: () => void;
  /** Custom root className */
  className?: string;
}

export const NavRail: React.FC<NavRailProps> = ({
  onGlobalOverviewClick,
  onHazardMapClick,
  onHabitationsClick,
  onRelocationClick,
  onSensorAlertsClick,
  className = '',
}) => {
  const pathname = usePathname();

  return (
    <aside
      id="app-aside"
      className={`fixed left-0 top-16 bottom-0 w-16 border-r border-line bg-surface-0/80 dark:bg-forest-dark/60 backdrop-blur-xl z-30 hidden sm:flex flex-col items-center py-5 space-y-4 transition-colors duration-200 ${className}`}
    >
      {/* 1. Global Overview */}
      {onGlobalOverviewClick ? (
        <button
          onClick={onGlobalOverviewClick}
          title="Global Overview"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${
            pathname === '/'
              ? 'bg-citron/15 text-citron border border-citron/30'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
          }`}
        >
          <span className="material-symbols-outlined text-xl">travel_explore</span>
        </button>
      ) : (
        <Link
          href="/"
          title="Global Overview"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${
            pathname === '/'
              ? 'bg-citron/15 text-citron border border-citron/30'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
          }`}
        >
          <span className="material-symbols-outlined text-xl">travel_explore</span>
        </Link>
      )}

      {/* 2. Operational Decision Workspace */}
      {onHazardMapClick ? (
        <button
          onClick={onHazardMapClick}
          title="SETU-DRR Workspace"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${
            pathname === '/workspace'
              ? 'bg-citron/15 text-citron border border-citron/30'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
          }`}
        >
          <span className="material-symbols-outlined text-xl">map</span>
        </button>
      ) : (
        <Link
          href="/workspace"
          title="SETU-DRR Workspace"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${
            pathname === '/workspace'
              ? 'bg-citron/15 text-citron border border-citron/30'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
          }`}
        >
          <span className="material-symbols-outlined text-xl">map</span>
        </Link>
      )}

      {/* 3. Hex Simulation / Gov View */}
      {onHabitationsClick ? (
        <button
          onClick={onHabitationsClick}
          title="Hex Simulation"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${
            pathname === '/gov'
              ? 'bg-citron/15 text-citron border border-citron/30'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
          }`}
        >
          <span className="material-symbols-outlined text-xl">hexagon</span>
        </button>
      ) : (
        <Link
          href="/gov"
          title="Hex Simulation"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${
            pathname === '/gov'
              ? 'bg-citron/15 text-citron border border-citron/30'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
          }`}
        >
          <span className="material-symbols-outlined text-xl">hexagon</span>
        </Link>
      )}

      {/* 4. Citizen Stories */}
      {onRelocationClick ? (
        <button
          onClick={onRelocationClick}
          title="Citizen Stories"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${
            pathname === '/stories'
              ? 'bg-citron/15 text-citron border border-citron/30'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
          }`}
        >
          <span className="material-symbols-outlined text-xl">explore</span>
        </button>
      ) : (
        <Link
          href="/stories"
          title="Citizen Stories"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${
            pathname === '/stories'
              ? 'bg-citron/15 text-citron border border-citron/30'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
          }`}
        >
          <span className="material-symbols-outlined text-xl">explore</span>
        </Link>
      )}

      {/* 5. Sensor Alerts */}
      <button
        onClick={onSensorAlertsClick}
        title="Sensor Alerts"
        className="w-10 h-10 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-2 flex items-center justify-center transition-all hover:scale-105 cursor-pointer relative"
      >
        <span className="material-symbols-outlined text-xl">notifications_active</span>
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-hazard-red animate-pulse" />
      </button>

      <div className="flex-grow" />

      {/* Theme Toggle in Rail */}
      <ThemeToggle variant="icon" size="sm" />

      {/* Officer Avatar */}
      <div
        title="Duty Officer"
        className="w-8 h-8 rounded-full bg-surface-1 border border-citron/40 text-citron text-xs font-bold flex items-center justify-center select-none"
      >
        DO
      </div>
    </aside>
  );
};
