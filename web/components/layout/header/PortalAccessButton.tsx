'use client';

import React, { useCallback, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, M3_DURATION, M3_EASE } from '@/lib/motion/m3';
import { StateLayer, type StateLayerHandle } from '@/components/ui/state-layer';
import { ContainerTransformLink } from '@/components/layout/transition';

export type PortalAccessButtonSize = 'md' | 'lg';

export interface PortalAccessButtonProps {
  /** Destination route (default '/login') */
  href?: string;
  /** Label text (default 'Portal Access') */
  label?: string;
  /** Pill scale. 'lg' matches the tall hero dock. */
  size?: PortalAccessButtonSize;
  /** Optional click handler */
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Custom root className */
  className?: string;
  /** Suppress the hover tween and ripple */
  disableAnimation?: boolean;
}

const SIZE_STYLES: Record<PortalAccessButtonSize, { root: string; icon: string }> = {
  md: { root: 'gap-2 px-4 py-1.5 text-xs', icon: 'text-[17px]' },
  lg: { root: 'gap-2 sm:gap-2.5 px-4 sm:px-5 lg:px-6 py-2.5 sm:py-3 lg:py-3.5 text-[13px] lg:text-[14px]', icon: 'text-[18px] lg:text-[20px]' },
};

export const PortalAccessButton: React.FC<PortalAccessButtonProps> = ({
  href = '/login',
  label = 'Portal Access',
  size = 'md',
  onClick,
  className = '',
  disableAnimation = false,
}) => {
  const sizing = SIZE_STYLES[size];
  const containerRef = useRef<HTMLAnchorElement>(null);
  const stateLayerRef = useRef<StateLayerHandle>(null);

  useGSAP(
    () => {
      const el = containerRef.current;
      if (!el || disableAnimation) return;
      const icon = el.querySelector('.portal-icon');

      const onEnter = () => {
        gsap.to(el, { scale: 1.04, duration: M3_DURATION.short4, ease: M3_EASE.emphasized });
        if (icon) {
          gsap.to(icon, { x: 2, y: -2, duration: M3_DURATION.short4, ease: M3_EASE.emphasized });
        }
      };

      const onLeave = () => {
        gsap.to(el, { scale: 1, duration: M3_DURATION.medium2, ease: M3_EASE.standard });
        if (icon) {
          gsap.to(icon, { x: 0, y: 0, duration: M3_DURATION.medium2, ease: M3_EASE.standard });
        }
      };

      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);

      return () => {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mouseleave', onLeave);
      };
    },
    { scope: containerRef, dependencies: [disableAnimation] }
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    stateLayerRef.current?.spawn(event);
  }, []);

  return (
    <ContainerTransformLink
      ref={containerRef}
      href={href}
      onClick={onClick}
      onPointerDown={handlePointerDown}
      className={`group m3-state-layer inline-flex items-center ${sizing.root} rounded-full bg-m3-dock-inverse text-m3-dock-on-inverse border border-m3-dock-outline font-semibold shadow-m3-1 transition-colors duration-200 ease-m3-standard cursor-pointer select-none ${className}`}
    >
      <StateLayer ref={stateLayerRef} disabled={disableAnimation} />
      <span className={`portal-icon material-symbols-outlined ${sizing.icon}`}>open_in_new</span>
      <span>{label}</span>
    </ContainerTransformLink>
  );
};
