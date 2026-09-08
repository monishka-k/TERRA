'use client';

import React, { useCallback, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, M3_DURATION, M3_EASE } from '@/lib/motion/m3';
import { StateLayer, type StateLayerHandle } from '@/components/ui/state-layer';

export interface QuickControlFabProps {
  /** Material Symbols ligature name. */
  icon: string;
  /** Accessible label and tooltip text. */
  label: string;
  /** Click handler. */
  onClick?: () => void;
  /** Marks the control as engaged (tinted, not just pressed). */
  isActive?: boolean;
  /** Extra classes on the button. */
  className?: string;
  /** Granular overrides. */
  classNames?: { icon?: string };
  /** Suppress the hover lift and ripple. */
  disableAnimation?: boolean;
}

/**
 * A single circular control in the globe's right-edge rail.
 *
 * The hover lift lives here rather than in CSS: `.m3-fab` deliberately no
 * longer transitions `transform`, so GSAP owns every transform on these
 * elements and the rail's staggered entrance cannot fight a CSS transition.
 */
export const QuickControlFab: React.FC<QuickControlFabProps> = ({
  icon,
  label,
  onClick,
  isActive = false,
  className = '',
  classNames = {},
  disableAnimation = false,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const stateLayerRef = useRef<StateLayerHandle>(null);

  useGSAP(
    () => {
      const el = buttonRef.current;
      if (!el || disableAnimation) return;

      const enter = () =>
        gsap.to(el, { y: -2, scale: 1.05, duration: M3_DURATION.short4, ease: M3_EASE.emphasized });
      const leave = () =>
        gsap.to(el, { y: 0, scale: 1, duration: M3_DURATION.medium2, ease: M3_EASE.standard });
      const press = () =>
        gsap.to(el, { scale: 0.96, duration: M3_DURATION.short2, ease: M3_EASE.standard });

      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      el.addEventListener('pointerdown', press);
      return () => {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseleave', leave);
        el.removeEventListener('pointerdown', press);
      };
    },
    { scope: buttonRef, dependencies: [disableAnimation] }
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    stateLayerRef.current?.spawn(event);
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      onPointerDown={handlePointerDown}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      className={`quick-control-fab group m3-fab m3-state-layer w-11 h-11 flex items-center justify-center cursor-pointer ${className}`}
    >
      <StateLayer ref={stateLayerRef} disabled={disableAnimation} />
      <span className={`material-symbols-outlined text-[21px] ${classNames.icon ?? ''}`}>
        {icon}
      </span>
    </button>
  );
};
