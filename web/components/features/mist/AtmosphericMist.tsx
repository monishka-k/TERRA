'use client';

import React, { useRef, useEffect } from 'react';
import Image from 'next/image';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTheme } from '@/components/providers';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { AtmosphericMistProps } from './types';

/**
 * AtmosphericMist
 *
 * Spreads light, airy, luminous atmospheric mist broadly across the landing page in Light Mode
 * (Daylight Sage / White theme), situated BEHIND the 3D Earth globe (z-0).
 *
 * - Does NOT cover the Earth itself: The Earth sits in front at z-[1] with crisp continents & oceans,
 *   blending its atmospheric rim glow seamlessly into the background mist.
 * - Spread broadly across other areas: Behind the hero typography on the left, under the header dock,
 *   across the bottom horizon, and surrounding the celestial perimeter.
 * - Parallax Depth: Responsive 3D parallax between Earth and mist on both scroll and mouse movement.
 * - Slow Dispersion: Lingers through early narrative storytelling, dispersing gradually up to scroll 0.72.
 * - Strictly inactive in Dark Mode (Night Forest theme).
 */
export const AtmosphericMist: React.FC<AtmosphericMistProps> = ({
  scrollProgress = 0,
  imageUrl = '/atmospheric-mist-transparent.png',
  baseOpacity = 0.75,
  intensity,
  dispersionThreshold = 0.72,
  dispersionScale = 1.28,
  dispersionY = -55,
  blendMode = 'normal',
  className = '',
  classNames,
  animation = {},
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isLight = resolvedTheme === 'light';
  const effectiveOpacity = intensity ?? baseOpacity;

  const {
    enableFloatingDrift = true,
    driftDuration = 16,
    driftOffset = 10,
  } = animation;

  // Interactive 3D Mouse Parallax between background mist and foreground Earth
  useEffect(() => {
    if (prefersReducedMotion || !isLight) return;

    const handleMouseMove = (e: MouseEvent) => {
      const mouseX = (e.clientX / window.innerWidth) - 0.5;
      const mouseY = (e.clientY / window.innerHeight) - 0.5;

      gsap.to('.mist-parallax-horizon', {
        x: mouseX * -20,
        y: mouseY * -15,
        duration: 1.1,
        ease: 'power1.out',
        overwrite: 'auto',
      });

      gsap.to('.mist-parallax-west', {
        x: mouseX * -35,
        y: mouseY * -28,
        duration: 1.2,
        ease: 'power1.out',
        overwrite: 'auto',
      });

      gsap.to('.mist-parallax-south', {
        x: mouseX * -25,
        y: mouseY * -22,
        duration: 1.15,
        ease: 'power1.out',
        overwrite: 'auto',
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [prefersReducedMotion, isLight]);

  // Responsive GSAP slow-dispersion animation on scroll & organic drifting
  useGSAP(
    () => {
      if (!containerRef.current) return;

      if (!isLight) {
        gsap.to('.mist-layer', {
          opacity: 0,
          duration: 0.3,
          ease: 'power2.out',
          overwrite: 'auto',
        });
        return;
      }

      // Very slow, lingering dispersion curve: stays prominent across hero & story 1
      const raw = Math.min(1.0, Math.max(0.0, scrollProgress / dispersionThreshold));
      const dispersion = Math.pow(raw, 1.45); // Lingering slow curve

      const targetOpacity = Math.max(0, (1.0 - dispersion) * effectiveOpacity);
      const targetScaleHorizon = prefersReducedMotion ? 1.0 : 1.0 + dispersion * (dispersionScale - 1.0);
      const targetScaleWest = prefersReducedMotion ? 1.2 : 1.2 + dispersion * 0.32;
      const targetScaleSouth = prefersReducedMotion ? 1.3 : 1.3 + dispersion * 0.38;
      const targetY = prefersReducedMotion ? 0 : dispersion * dispersionY;

      // 1. Horizon Perimeter Layer
      gsap.to('.mist-layer-horizon', {
        opacity: targetOpacity,
        scale: targetScaleHorizon,
        y: targetY * 0.65,
        duration: 0.5,
        ease: 'power1.out',
        overwrite: 'auto',
      });

      // 2. West Typography Veil (behind heading and CTA)
      gsap.to('.mist-layer-west', {
        opacity: targetOpacity * 0.72,
        scale: targetScaleWest,
        y: targetY * 0.95,
        x: -dispersion * 35,
        duration: 0.5,
        ease: 'power1.out',
        overwrite: 'auto',
      });

      // 3. South-East Planetary Cloud Bed (behind and framing the Earth)
      gsap.to('.mist-layer-south', {
        opacity: targetOpacity * 0.75,
        scale: targetScaleSouth,
        y: targetY * 1.25,
        duration: 0.5,
        ease: 'power1.out',
        overwrite: 'auto',
      });

      // Subtle ambient continuous drift when near hero
      if (enableFloatingDrift && !prefersReducedMotion && dispersion < 0.65) {
        gsap.to('.mist-img-horizon', {
          y: driftOffset,
          x: -driftOffset * 0.5,
          duration: driftDuration,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          overwrite: false,
        });

        gsap.to('.mist-img-west', {
          y: -driftOffset * 0.8,
          x: driftOffset * 0.7,
          duration: driftDuration * 1.2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          overwrite: false,
        });

        gsap.to('.mist-img-south', {
          y: driftOffset * 0.9,
          x: -driftOffset * 0.5,
          duration: driftDuration * 1.3,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          overwrite: false,
        });
      }
    },
    {
      scope: containerRef,
      dependencies: [
        scrollProgress,
        isLight,
        effectiveOpacity,
        dispersionThreshold,
        dispersionScale,
        dispersionY,
        prefersReducedMotion,
        enableFloatingDrift,
        driftDuration,
        driftOffset,
      ],
    }
  );

  // Hidden in dark mode
  if (!isLight) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden select-none transition-opacity duration-300 ${className} ${classNames?.root ?? ''}`}
    >
      {/* Layer 1: Full Viewport Horizon Perimeter Mist (Distant Background) */}
      <div
        className={`mist-layer mist-layer-horizon mist-parallax-horizon absolute inset-0 w-full h-full will-change-transform will-change-opacity ${classNames?.wrapper ?? ''}`}
        style={{
          opacity: effectiveOpacity,
          transformOrigin: 'center 40%',
        }}
      >
        <Image
          src={imageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="mist-img-horizon object-cover object-center scale-105 pointer-events-none select-none"
          style={{
            mixBlendMode: blendMode,
            filter: 'contrast(1.02) brightness(1.04)',
          }}
        />
      </div>

      {/* Layer 2: Western Atmosphere (Spreads clouds broadly across left typography & hero text) */}
      <div
        className="mist-layer mist-layer-west mist-parallax-west absolute -top-10 -left-20 w-[95vw] h-[105vh] will-change-transform will-change-opacity pointer-events-none"
        style={{
          opacity: effectiveOpacity * 0.72,
          transformOrigin: '20% 35%',
          transform: 'scale(1.22)',
        }}
      >
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="100vw"
          className="mist-img-west object-cover object-left-top pointer-events-none select-none"
          style={{
            mixBlendMode: blendMode,
            filter: 'contrast(1.02) brightness(1.04)',
          }}
        />
      </div>

      {/* Layer 3: South-East Cloud Bed (Behind the 3D globe, wrapping its lower rim and horizon) */}
      <div
        className="mist-layer mist-layer-south mist-parallax-south absolute -bottom-20 -right-16 w-[105vw] h-[95vh] will-change-transform will-change-opacity pointer-events-none"
        style={{
          opacity: effectiveOpacity * 0.75,
          transformOrigin: '75% 65%',
          transform: 'scale(1.32)',
        }}
      >
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="100vw"
          className="mist-img-south object-cover object-center pointer-events-none select-none"
          style={{
            mixBlendMode: blendMode,
            filter: 'contrast(1.02) brightness(1.04)',
          }}
        />
      </div>

      {children}
    </div>
  );
};
