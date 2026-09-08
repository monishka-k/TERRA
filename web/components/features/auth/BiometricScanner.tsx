'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface BiometricScannerProps {
  /** Whether biometric laser scanline is active */
  isScanning?: boolean;
  /** Whether biometric match is verified */
  isVerified?: boolean;
  /** Callback when user clicks or taps fingerprint */
  onScan?: () => void;
  /** Custom root className */
  className?: string;
  /** Granular style overrides */
  classNames?: {
    root?: string;
    token?: string;
  };
}

export const BiometricScanner: React.FC<BiometricScannerProps> = ({
  isScanning = true,
  isVerified = false,
  onScan,
  className = '',
  classNames = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scanlineRef = useRef<HTMLDivElement>(null);

  // Continuous Up & Down Scanning Laser Line Animation
  useGSAP(() => {
    if (!scanlineRef.current) return;

    if (isScanning && !isVerified) {
      gsap.fromTo(
        scanlineRef.current,
        { top: '6%', opacity: 0.9 },
        {
          top: '90%',
          opacity: 0.95,
          duration: 1.8,
          ease: 'power1.inOut',
          yoyo: true,
          repeat: -1,
        }
      );
    } else {
      gsap.killTweensOf(scanlineRef.current);
    }
  }, [isScanning, isVerified]);

  return (
    <div
      ref={containerRef}
      className={`relative w-72 sm:w-80 h-72 sm:h-80 flex items-center justify-center select-none ${className} ${classNames.root || ''}`}
    >
      {/* 1. Large Pulsing Cosmic Rings (Zero clutter, elegant glow) */}
      <div className="absolute w-[20rem] sm:w-[24rem] h-[20rem] sm:h-[24rem] rounded-full border border-citron/15 pointer-events-none" />
      <div className="absolute w-64 sm:w-72 h-64 sm:h-72 rounded-full border border-dashed border-citron/25 animate-radar pointer-events-none" />
      <div className="absolute w-52 sm:w-60 h-52 sm:h-60 rounded-full border border-citron/35 animate-ring-1 pointer-events-none" />
      <div className="absolute w-40 sm:w-48 h-40 sm:h-48 rounded-full border border-citron/30 animate-ring-2 pointer-events-none" />

      {/* 2. Seamless Transparent Bio-Moss Fingerprint Token */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <button
          type="button"
          onClick={onScan}
          aria-label="Scan Biometric Token"
          className="relative group cursor-pointer border-none bg-transparent p-0 focus:outline-none rounded-full"
        >
          <div className="relative w-48 sm:w-56 h-60 sm:h-68 flex items-center justify-center">
            {/* Inline Transparent Vector SVG Thumbprint */}
            <svg
              viewBox="0 0 400 500"
              className={`w-full h-full object-contain filter transition-all duration-500 ${
                isVerified
                  ? 'drop-shadow-[0_0_40px_var(--color-accent-emerald-bright)] scale-105'
                  : 'drop-shadow-[0_0_25px_var(--color-accent-emerald)] group-hover:scale-105'
              } ${classNames.token || ''}`}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <filter id="thumb-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="thumb-moss" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--color-accent-emerald-bright)" />
                  <stop offset="50%" stopColor="var(--color-accent-emerald)" />
                  <stop offset="100%" stopColor="var(--color-forest-light)" />
                </linearGradient>
                <linearGradient id="thumb-neon" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="var(--color-accent-emerald-light)" />
                  <stop offset="50%" stopColor="var(--color-accent-emerald-bright)" />
                  <stop offset="100%" stopColor="var(--color-citron)" />
                </linearGradient>
              </defs>

              <g filter="url(#thumb-glow)" strokeLinecap="round" strokeLinejoin="round">
                {/* Core Center Loop */}
                <path d="M 200 230 C 190 230 185 220 185 205 C 185 185 215 185 215 205 C 215 225 195 245 190 265" stroke="url(#thumb-neon)" strokeWidth="4.5" />
                <path d="M 195 195 C 195 190 205 190 205 195 C 205 205 195 215 195 225" stroke="var(--color-accent-emerald-light)" strokeWidth="3.5" />
                
                {/* Dermal Loops */}
                <path d="M 175 250 C 170 215 170 175 200 170 C 230 175 230 215 225 250 C 220 280 185 300 180 330" stroke="url(#thumb-moss)" strokeWidth="4.5" />
                <path d="M 160 270 C 155 210 155 155 200 150 C 245 155 245 210 240 270 C 235 310 180 340 170 375" stroke="url(#thumb-neon)" strokeWidth="4.5" />
                <path d="M 145 290 C 140 200 140 135 200 130 C 260 135 260 200 255 290 C 250 340 175 375 160 415" stroke="url(#thumb-moss)" strokeWidth="4.5" />
                <path d="M 130 310 C 125 190 125 115 200 110 C 275 115 275 190 270 310 C 265 370 170 410 150 450" stroke="url(#thumb-neon)" strokeWidth="4.5" />
                <path d="M 115 330 C 110 180 110 95 200 90 C 290 95 290 180 285 330 C 280 400 165 440 140 480" stroke="url(#thumb-moss)" strokeWidth="4.5" />
                
                {/* Outer Whorls */}
                <path d="M 100 350 C 95 220 95 75 200 70 C 250 70 280 100 295 140" stroke="url(#thumb-neon)" strokeWidth="4.5" />
                <path d="M 85 370 C 80 250 80 60 200 50 C 265 50 300 80 315 130" stroke="url(#thumb-moss)" strokeWidth="4" />
                <path d="M 305 350 C 310 260 310 160 305 130" stroke="url(#thumb-moss)" strokeWidth="4.5" />
                <path d="M 320 370 C 325 280 325 180 315 130" stroke="url(#thumb-neon)" strokeWidth="4" />
                
                {/* Deltas */}
                <path d="M 70 390 C 65 310 65 240 75 180" stroke="url(#thumb-moss)" strokeWidth="3.5" />
                <path d="M 60 410 C 55 340 55 270 65 210" stroke="url(#thumb-neon)" strokeWidth="3" />
                <path d="M 335 390 C 340 320 340 250 330 190" stroke="url(#thumb-moss)" strokeWidth="3.5" />
                <path d="M 345 410 C 350 350 350 280 340 220" stroke="url(#thumb-neon)" strokeWidth="3" />

                {/* Splices */}
                <path d="M 185 160 C 190 145 195 140 200 135" stroke="var(--color-accent-emerald-light)" strokeWidth="3" />
                <path d="M 215 160 C 210 145 205 140 200 135" stroke="var(--color-accent-emerald-light)" strokeWidth="3" />
                <path d="M 165 210 C 170 195 175 190 180 185" stroke="var(--color-accent-emerald-light)" strokeWidth="3" />
                <path d="M 235 210 C 230 195 225 190 220 185" stroke="var(--color-accent-emerald-light)" strokeWidth="3" />
                <path d="M 150 260 C 155 245 160 240 165 235" stroke="var(--color-accent-emerald-light)" strokeWidth="3" />
                <path d="M 250 260 C 245 245 240 240 235 235" stroke="var(--color-accent-emerald-light)" strokeWidth="3" />
                
                {/* Grooves */}
                <path d="M 195 280 C 190 320 170 350 160 380" stroke="url(#thumb-neon)" strokeWidth="4" />
                <path d="M 210 280 C 215 320 200 360 180 400" stroke="url(#thumb-moss)" strokeWidth="4" />
                <path d="M 225 300 C 220 350 190 390 170 430" stroke="url(#thumb-neon)" strokeWidth="4" />
              </g>
            </svg>

            {/* 3. Glowing Green Laser Scanline (Smooth Up & Down Scanning Loop) */}
            {isScanning && !isVerified && (
              <div
                ref={scanlineRef}
                className="absolute left-0 right-0 h-1 pointer-events-none flex items-center justify-center"
                style={{ top: '10%' }}
              >
                {/* Laser Bar & Glow Haze */}
                <div className="w-full h-[3px] bg-gradient-to-r from-transparent via-accent-emerald-bright to-transparent shadow-[0_0_15px_var(--color-accent-emerald),0_0_30px_var(--color-accent-emerald-bright)]" />
                <div className="absolute w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_12px_#ffffff,0_0_24px_var(--color-accent-emerald-bright)]" />
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};
