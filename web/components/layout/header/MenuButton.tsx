'use client';

import React, { useCallback, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, M3_DURATION, M3_EASE } from '@/lib/motion/m3';
import { StateLayer, type StateLayerHandle } from '@/components/ui/state-layer';
import { ContainerTransformLink } from '@/components/layout/transition';

export interface MenuButtonProps {
  /** Target link when clicked */
  href?: string;
  /** Brand label text */
  label?: string;
  /** Optional click handler */
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Custom root className */
  className?: string;
  /** Custom icon */
  icon?: React.ReactNode;
  /** Suppress the hover tween and ripple */
  disableAnimation?: boolean;
}

export const MenuButton: React.FC<MenuButtonProps> = ({
  href = '/',
  label = 'SETU-DRR',
  onClick,
  className = '',
  icon,
  disableAnimation = false,
}) => {
  const containerRef = useRef<HTMLAnchorElement>(null);
  const stateLayerRef = useRef<StateLayerHandle>(null);

  useGSAP(() => {
    if (!containerRef.current || disableAnimation) return;
    const el = containerRef.current;

    const onEnter = () => {
      gsap.to(el, { scale: 1.03, duration: M3_DURATION.short4, ease: M3_EASE.emphasized });
      gsap.to(el.querySelector('.menu-icon-circle'), {
        rotate: 90,
        scale: 1.05,
        duration: M3_DURATION.medium2,
        ease: M3_EASE.emphasized,
      });
    };

    const onLeave = () => {
      gsap.to(el, { scale: 1, duration: M3_DURATION.medium2, ease: M3_EASE.standard });
      gsap.to(el.querySelector('.menu-icon-circle'), {
        rotate: 0,
        scale: 1,
        duration: M3_DURATION.medium2,
        ease: M3_EASE.standard,
      });
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, { scope: containerRef, dependencies: [disableAnimation] });

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    stateLayerRef.current?.spawn(event);
  }, []);

  return (
    <ContainerTransformLink
      ref={containerRef}
      href={href}
      onClick={onClick}
      onPointerDown={handlePointerDown}
      className={`group m3-state-layer inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-m3-dock-surface text-m3-dock-on-surface shadow-m3-1 hover:shadow-m3-2 transition-shadow duration-200 ease-m3-standard cursor-pointer select-none ${className}`}
      aria-label={`${label} home`}
    >
      <StateLayer ref={stateLayerRef} disabled={disableAnimation} />
      <span className="menu-icon-circle w-7 h-7 rounded-full bg-m3-dock-surface-variant text-m3-dock-on-surface flex items-center justify-center border border-m3-dock-outline group-hover:border-m3-primary transition-colors duration-200 ease-m3-standard">
        {icon || (
          <span className="material-symbols-outlined text-base font-bold">close</span>
        )}
      </span>
      <span className="font-sans font-bold text-xs tracking-wider pr-2 text-m3-dock-on-surface">
        {label}
      </span>
    </ContainerTransformLink>
  );
};
