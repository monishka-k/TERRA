'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, M3_DURATION, M3_EASE, type M3AnimationConfig } from '@/lib/motion/m3';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { MenuButton } from './MenuButton';
import { NavSegmentTabs, NavTabItem, DEFAULT_NAV_TABS } from './NavSegmentTabs';
import { PortalAccessButton } from './PortalAccessButton';

import { useAuth } from '@/lib/hooks/useAuth';

export interface HeaderProps {
  /** Tonal treatment. 'login' sits the dock a shade deeper against the globe. */
  viewMode?: 'landing' | 'login';
  /** Target link for the brand menu button (default '/') */
  homeHref?: string;
  /** Target link for portal access (default '/login') */
  portalHref?: string;
  /** Available tabs */
  tabs?: NavTabItem[];
  /** Currently active tab ID */
  activeTabId?: string;
  /** Callback when tab is selected */
  onSelectTab?: (tabId: string) => void;
  /** Custom root className */
  className?: string;
  /** Granular styling overrides */
  classNames?: {
    dock?: string;
    tabs?: string;
  };
  /** Entrance animation overrides. `delay` sequences it against the page intro. */
  animation?: M3AnimationConfig;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode = 'landing',
  homeHref = '/',
  portalHref = '/login',
  tabs = DEFAULT_NAV_TABS,
  activeTabId = 'planetary',
  onSelectTab,
  className = '',
  classNames = {},
  animation = {},
}) => {
  const containerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { user, isAuthenticated, logout } = useAuth();

  const {
    disabled: animationDisabled = false,
    duration = M3_DURATION.long2,
    delay = 0,
  } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!animate) return;

      // Emphasized-decelerate: the dock arrives fast and settles, which is the
      // M3 entrance for a persistent surface.
      gsap
        .timeline({ delay })
        .fromTo(
          '.header-dock',
          { y: -28, opacity: 0 },
          { y: 0, opacity: 1, duration, ease: M3_EASE.decelerate }
        )
        .fromTo(
          '.header-slot',
          { y: -10, opacity: 0 },
          { y: 0, opacity: 1, duration: M3_DURATION.medium4, stagger: 0.04, ease: M3_EASE.emphasized },
          '-=0.32'
        );
    },
    { scope: containerRef, dependencies: [animate, duration, delay] }
  );

  const authTargetHref = user
    ? user.role === 'GOVERNMENT_OFFICIAL' || user.role === 'SYSTEM_ADMIN'
      ? '/gov'
      : '/stories'
    : portalHref;

  const authLabel = user
    ? user.role === 'GOVERNMENT_OFFICIAL' || user.role === 'SYSTEM_ADMIN'
      ? 'Gov Workspace'
      : 'Citizen Portal'
    : 'Portal Access';

  return (
    <header
      ref={containerRef}
      id="app-header"
      className={`fixed top-4 left-0 right-0 z-40 px-4 sm:px-8 lg:px-12 flex items-center justify-center pointer-events-none ${className}`}
    >
      {/* Floating Dark Pill Dock Container (Material 3 Style) */}
      <div
        className={`header-dock pointer-events-auto m3-floating-dock px-2 py-1.5 flex items-center justify-between gap-3 sm:gap-6 max-w-6xl w-full ${viewMode === 'login' ? 'shadow-m3-4' : ''
          } ${classNames.dock ?? ''}`}
      >
        {/* Left Brand / Close Button Pill */}
        <div className="header-slot flex items-center shrink-0">
          <MenuButton href={homeHref} label="SETU-DRR" disableAnimation={!animate} />
        </div>

        {/* Center Segmented Navigation Tabs */}
        <div className="header-slot hidden md:flex items-center justify-center flex-1 overflow-x-auto no-scrollbar">
          <NavSegmentTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={onSelectTab}
            className={classNames.tabs}
            animation={{ disabled: !animate }}
          />
        </div>

        {/* Right Portal Access / Auth Controls */}
        <div className="header-slot flex items-center gap-2 shrink-0">
          <PortalAccessButton
            href={authTargetHref}
            label={authLabel}
            disableAnimation={!animate}
          />
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-1 hover:bg-surface-2 text-text-muted hover:text-red-500 border border-line text-xs font-mono transition-colors cursor-pointer"
              title="Log out from SETU-DRR"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

