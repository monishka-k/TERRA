'use client';

import React, { useCallback, useRef } from 'react';
import { gsap, M3_DURATION, M3_EASE } from '@/lib/motion/m3';
import { useGSAP } from '@gsap/react';
import { StateLayer, type StateLayerHandle } from '@/components/ui/state-layer';
import { ContainerTransformLink } from '@/components/layout/transition';
import type { NavTabItem } from './NavSegmentTabs';

export type NavSegmentTabSize = 'sm' | 'md' | 'lg';

export interface NavSegmentTabProps {
  /** Tab definition. A tab with an `href` navigates; one without stays in page. */
  tab: NavTabItem;
  /** Whether this tab is the selected one. */
  isActive?: boolean;
  /** Segment scale. 'lg' matches the tall hero dock. */
  size?: NavSegmentTabSize;
  /** Fired on selection, for both navigating and in-page tabs. */
  onSelect?: (tabId: string) => void;
  /** Suppress the ripple and hover tween. */
  disableAnimation?: boolean;
  /** Extra classes on the tab root. */
  className?: string;
  /** Granular overrides for inner elements. */
  classNames?: {
    icon?: string;
    label?: string;
    badge?: string;
  };
}

/**
 * A single segment in the header's navigation strip.
 *
 * The selected background is *not* drawn here — a shared indicator slides
 * between tabs (see `NavSegmentTabs`), which is the Material 3 selection
 * behaviour. This component only owns its content, state layer and ripple.
 */
export const NavSegmentTab: React.FC<NavSegmentTabProps> = ({
  tab,
  isActive = false,
  size = 'md',
  onSelect,
  disableAnimation = false,
  className = '',
  classNames = {},
}) => {
  const rootRef = useRef<HTMLElement>(null);
  const stateLayerRef = useRef<StateLayerHandle>(null);

  useGSAP(
    () => {
      const el = rootRef.current;
      if (!el || disableAnimation) return;
      const icon = el.querySelector('.nav-tab-icon');
      if (!icon) return;

      const enter = () =>
        gsap.to(icon, { scale: 1.12, duration: M3_DURATION.short4, ease: M3_EASE.emphasized });
      const leave = () =>
        gsap.to(icon, { scale: 1, duration: M3_DURATION.short4, ease: M3_EASE.standard });

      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      return () => {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseleave', leave);
      };
    },
    { scope: rootRef, dependencies: [disableAnimation] }
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    stateLayerRef.current?.spawn(event);
  }, []);

  const handleSelect = useCallback(() => onSelect?.(tab.id), [onSelect, tab.id]);

  const sizeClasses =
    size === 'lg'
      ? 'px-4 py-2 text-sm gap-2.5'
      : size === 'sm'
      ? 'px-3 py-1 text-[11px] gap-1.5'
      : 'px-3.5 py-1.5 text-xs gap-2';

  const iconSizeClass =
    size === 'lg' ? 'text-[19px]' : size === 'sm' ? 'text-[15px]' : 'text-[17px]';

  const body = (
    <>
      <StateLayer ref={stateLayerRef} disabled={disableAnimation} />
      <span
        className={`nav-tab-icon material-symbols-outlined ${iconSizeClass} ${classNames.icon ?? ''}`}
      >
        {tab.icon}
      </span>
      <span className={`whitespace-nowrap ${classNames.label ?? ''}`}>{tab.label}</span>
      {tab.badge && (
        <span
          className={`px-1.5 rounded-full text-[9px] bg-m3-dock-on-surface/10 ${classNames.badge ?? ''}`}
        >
          {tab.badge}
        </span>
      )}
    </>
  );

  const shared = {
    'data-tab-id': tab.id,
    'aria-current': isActive ? ('page' as const) : undefined,
    onPointerDown: handlePointerDown,
    className: [
      'nav-tab m3-state-layer group relative flex items-center',
      sizeClasses,
      'rounded-full font-medium cursor-pointer select-none',
      'transition-colors duration-200 ease-m3-standard',
      isActive
        ? 'nav-tab-active text-m3-on-primary font-bold'
        : 'bg-m3-dock-surface-variant text-m3-dock-on-surface-variant hover:text-m3-dock-on-surface',
      className,
    ].join(' '),
  };

  if (tab.href) {
    return (
      <ContainerTransformLink
        href={tab.href}
        ref={rootRef as React.RefObject<HTMLAnchorElement>}
        onClick={handleSelect}
        {...shared}
      >
        {body}
      </ContainerTransformLink>
    );
  }

  return (
    <button
      ref={rootRef as React.RefObject<HTMLButtonElement>}
      type="button"
      onClick={handleSelect}
      {...shared}
    >
      {body}
    </button>
  );
};
