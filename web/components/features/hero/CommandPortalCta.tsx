'use client';

import React, { useCallback, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, M3_DURATION, M3_EASE } from '@/lib/motion/m3';
import { StateLayer, type StateLayerHandle } from '@/components/ui/state-layer';
import { ContainerTransformLink } from '@/components/layout/transition';

export interface CommandPortalCtaProps {
  /** Target link href */
  href?: string;
  /** Button label */
  label?: string;
  /** Optional click handler */
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Custom root className */
  className?: string;
  /** Trailing icon ligature */
  icon?: string;
  /** Suppress the hover tween and ripple */
  disableAnimation?: boolean;
}

export const CommandPortalCta: React.FC<CommandPortalCtaProps> = ({
  href = '/login',
  label = 'Access Command Portal',
  onClick,
  className = '',
  icon = 'arrow_forward',
  disableAnimation = false,
}) => {
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const stateLayerRef = useRef<StateLayerHandle>(null);

  useGSAP(() => {
    if (!buttonRef.current || disableAnimation) return;
    const el = buttonRef.current;
    const arrow = el.querySelector('.cta-arrow');

    const onEnter = () => {
      gsap.to(el, {
        y: -3,
        scale: 1.03,
        boxShadow: '0 16px 36px rgba(210, 248, 63, 0.45)',
        duration: M3_DURATION.short4,
        ease: M3_EASE.emphasized,
      });
      if (arrow) {
        gsap.to(arrow, { x: 5, duration: M3_DURATION.short4, ease: M3_EASE.emphasized });
      }
    };

    const onLeave = () => {
      gsap.to(el, {
        y: 0,
        scale: 1,
        boxShadow: '0 10px 24px rgba(210, 248, 63, 0.35)',
        duration: M3_DURATION.medium2,
        ease: M3_EASE.standard,
      });
      if (arrow) {
        gsap.to(arrow, { x: 0, duration: M3_DURATION.medium2, ease: M3_EASE.standard });
      }
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, { scope: buttonRef, dependencies: [disableAnimation] });

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    stateLayerRef.current?.spawn(event);
  }, []);

  return (
    <ContainerTransformLink
      ref={buttonRef}
      href={href}
      onClick={onClick}
      onPointerDown={handlePointerDown}
      className={`group m3-state-layer btn-citron inline-flex items-center gap-3 px-8 py-3.5 font-sans text-sm sm:text-base tracking-wide cursor-pointer select-none ${className}`}
    >
      <StateLayer ref={stateLayerRef} disabled={disableAnimation} />
      <span>{label}</span>
      <span className="cta-arrow material-symbols-outlined text-xl font-bold">{icon}</span>
    </ContainerTransformLink>
  );
};
