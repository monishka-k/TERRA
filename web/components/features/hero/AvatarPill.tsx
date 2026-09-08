'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, M3_DURATION, M3_EASE } from '@/lib/motion/m3';

export interface AvatarPillProps {
  /** Initial or short label shown in the pill. */
  label: React.ReactNode;
  /** Tooltip text. */
  title?: string;
  /** Extra classes on the pill. */
  className?: string;
  /** Suppress the hover tween. */
  disableAnimation?: boolean;
}

/** A single node/telemetry agent avatar in the hero's bottom-left cluster. */
export const AvatarPill: React.FC<AvatarPillProps> = ({
  label,
  title,
  className = '',
  disableAnimation = false,
}) => {
  const pillRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = pillRef.current;
      if (!el || disableAnimation) return;

      const enter = () =>
        gsap.to(el, { scale: 1.1, duration: M3_DURATION.short4, ease: M3_EASE.emphasized });
      const leave = () =>
        gsap.to(el, { scale: 1, duration: M3_DURATION.medium2, ease: M3_EASE.standard });

      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      return () => {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseleave', leave);
      };
    },
    { scope: pillRef, dependencies: [disableAnimation] }
  );

  return (
    <div
      ref={pillRef}
      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-m3-dock-inverse text-m3-dock-on-inverse border border-m3-outline-variant flex items-center justify-center font-sans font-bold text-xs shadow-m3-2 cursor-default ${className}`}
      title={title ?? `Node / Telemetry Agent: ${label}`}
    >
      {label}
    </div>
  );
};
