'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { Flip, gsap, M3_DURATION, M3_EASE, type M3AnimationConfig } from '@/lib/motion/m3';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { NavSegmentTab, type NavSegmentTabSize } from './NavSegmentTab';

export interface NavTabItem {
  id: string;
  label: string;
  icon: string;
  /** When set, selecting the tab navigates through the container transform. */
  href?: string;
  badge?: string;
}

export interface NavSegmentTabsProps {
  /** List of tabs to display */
  tabs?: NavTabItem[];
  /** Currently active tab ID */
  activeTabId?: string;
  /** Segment scale forwarded to every tab. 'lg' matches the tall hero dock. */
  size?: NavSegmentTabSize;
  /** Callback when tab is selected */
  onSelectTab?: (tabId: string) => void;
  /** Custom root className */
  className?: string;
  /** Granular styling overrides */
  classNames?: {
    indicator?: string;
    tab?: string;
  };
  /** Animation overrides for the sliding indicator */
  animation?: M3AnimationConfig;
}

/**
 * Fallback set, kept for components that render the strip without a config.
 * The canonical list (with routes) lives in `@/lib/routes`.
 */
export const DEFAULT_NAV_TABS: NavTabItem[] = [
  { id: 'planetary', label: 'Planetary View', icon: 'public' },
  { id: 'sar_mesh', label: 'Real-time SAR Mesh', icon: 'vital_signs' },
  { id: 'hazards', label: 'Hazards', icon: 'warning' },
  { id: 'data', label: 'Data', icon: 'database' },
  { id: 'research', label: 'Research', icon: 'menu_book' },
  { id: 'about', label: 'About', icon: 'info', href: '/about' },
];

/**
 * Material 3 segmented navigation.
 *
 * Selection is drawn by one shared indicator that slides between tabs via GSAP
 * Flip, rather than each tab toggling its own background. Flip measures the
 * indicator before and after it is re-parented into the newly active tab and
 * interpolates the difference, so the pill travels and resizes in a single
 * emphasized move regardless of how far apart or how differently sized the two
 * tabs are.
 */
export const NavSegmentTabs: React.FC<NavSegmentTabsProps> = ({
  tabs = DEFAULT_NAV_TABS,
  activeTabId = 'planetary',
  size = 'md',
  onSelectTab,
  className = '',
  classNames = {},
  animation = {},
}) => {
  const containerRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasPositioned = useRef(false);

  const { disabled: animationDisabled = false, duration = M3_DURATION.medium4 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      const container = containerRef.current;
      const indicator = indicatorRef.current;
      if (!container || !indicator) return;

      const target = container.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
      if (!target) {
        gsap.set(indicator, { autoAlpha: 0 });
        return;
      }

      const state = Flip.getState(indicator);
      gsap.set(indicator, { autoAlpha: 1 });
      Flip.fit(indicator, target);

      // The first paint has no previous position to travel from, so the
      // indicator simply appears where it belongs.
      if (!hasPositioned.current || !animate) {
        hasPositioned.current = true;
        return;
      }

      Flip.from(state, {
        duration,
        ease: M3_EASE.emphasized,
        absolute: true,
      });
    },
    { scope: containerRef, dependencies: [activeTabId, tabs, size, animate, duration] }
  );

  return (
    <nav
      ref={containerRef}
      className={`relative inline-flex items-center ${size === 'lg' ? 'gap-2' : 'gap-1.5'} p-1 rounded-full ${className}`}
      aria-label="Main Navigation Tabs"
    >
      {/* Shared selection indicator; Flip moves this between tabs. */}
      <span
        ref={indicatorRef}
        aria-hidden
        className={`nav-indicator pointer-events-none absolute left-0 top-0 opacity-0 rounded-full bg-m3-primary shadow-m3-1 ${classNames.indicator ?? ''}`}
      />
      {tabs.map((tab) => (
        <NavSegmentTab
          key={tab.id}
          tab={tab}
          size={size}
          isActive={tab.id === activeTabId}
          onSelect={onSelectTab}
          disableAnimation={!animate}
          className={classNames.tab}
        />
      ))}
    </nav>
  );
};
