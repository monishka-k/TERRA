'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface BiometricCapsuleButtonProps {
  /** Whether the biometric authentication is actively in progress */
  isAuthenticating?: boolean;
  /** Whether authentication is complete */
  isComplete?: boolean;
  /** Callback when user clicks to start authentication */
  onClick?: () => void;
  /** Custom root className */
  className?: string;
  /** Custom label when idle */
  defaultTitle?: string;
  /** Custom sub-label when idle */
  defaultSubtitle?: string;
}

const STAGES = [
  { threshold: 25, sub: 'READING RIDGES...', title: 'Acquiring Specimen' },
  { threshold: 55, sub: 'COMPUTING HASH...', title: 'Matching Topology' },
  { threshold: 85, sub: 'DECRYPTING KEY...', title: 'Finalizing Protocol' },
  { threshold: 100, sub: 'IDENTITY SECURED', title: 'Access Granted' },
];

export const BiometricCapsuleButton: React.FC<BiometricCapsuleButtonProps> = ({
  isAuthenticating = false,
  isComplete = false,
  onClick,
  className = '',
  defaultTitle = 'Scan Biometric Specimen & Enter',
  defaultSubtitle = 'STITCH BIO-CAPSULE PROTOCOL',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scanLaserRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(isComplete ? 100 : 0);
  const [stageIndex, setStageIndex] = useState(0);

  // Scanline laser animation
  useGSAP(() => {
    if (!scanLaserRef.current) return;
    if (isAuthenticating && !isComplete) {
      gsap.fromTo(
        scanLaserRef.current,
        { top: '-5%', opacity: 0 },
        {
          top: '100%',
          opacity: 0.95,
          duration: 1.3,
          ease: 'power1.inOut',
          yoyo: true,
          repeat: -1,
        }
      );
    } else {
      gsap.killTweensOf(scanLaserRef.current);
    }
  }, [isAuthenticating, isComplete]);

  // Simulation progress timer when authenticating
  useEffect(() => {
    if (!isAuthenticating || isComplete) return;

    const timer = setTimeout(() => {
      setProgress(15);
    }, 0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const next = prev + Math.floor(Math.random() * 6) + 3;
        if (next >= 100) {
          setStageIndex(3);
          return 100;
        }
        if (next > 25 && next <= 55) setStageIndex(1);
        else if (next > 55 && next <= 85) setStageIndex(2);
        else if (next > 85) setStageIndex(3);

        return next;
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [isAuthenticating, isComplete]);

  const currentStage = isAuthenticating || isComplete ? STAGES[stageIndex] : null;

  return (
    <div ref={containerRef} className={`relative flex items-center justify-center select-none w-full ${className}`}>
      {/* 1. Ambient Ripple Glow Rings */}
      <div
        className={`absolute inset-0 -m-3 rounded-2xl border border-citron/30 pointer-events-none transition-opacity duration-500 ${
          isAuthenticating && !isComplete ? 'animate-ring-1 opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`absolute inset-0 -m-3 rounded-2xl border border-citron/20 pointer-events-none transition-opacity duration-500 ${
          isAuthenticating && !isComplete ? 'animate-ring-2 opacity-100' : 'opacity-0'
        }`}
      />

      {/* 2. Enlarged Biometric Capsule Button Enclosure */}
      <button
        type="button"
        onClick={onClick}
        className="group relative w-full flex items-center justify-between gap-5 px-6 sm:px-7 py-4 sm:py-5 rounded-2xl bg-forest-surface/90 hover:bg-forest-surface-hover text-text-primary transition-all duration-300 shadow-[0_10px_36px_rgba(0,0,0,0.55)] active:scale-[0.99] overflow-hidden border border-citron/35 hover:border-citron cursor-pointer"
      >
        {/* Enlarged Left Thumbnail Pod (100% Transparent, No White Box) */}
        <div className="relative w-14 h-18 sm:w-16 sm:h-20 rounded-xl bg-forest-dark flex items-center justify-center overflow-hidden border border-citron/40 shadow-inner flex-shrink-0 p-1.5">
          {/* Inline Transparent Vector Thumbprint */}
          <svg
            viewBox="0 0 400 500"
            className="w-full h-full object-contain filter drop-shadow-[0_0_15px_var(--color-accent-emerald)] group-hover:scale-105 transition-transform"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <filter id="capsule-thumb-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="cap-moss" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--color-accent-emerald-bright)" />
                <stop offset="50%" stopColor="var(--color-accent-emerald)" />
                <stop offset="100%" stopColor="var(--color-forest-light)" />
              </linearGradient>
              <linearGradient id="cap-neon" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="var(--color-accent-emerald-light)" />
                <stop offset="50%" stopColor="var(--color-accent-emerald-bright)" />
                <stop offset="100%" stopColor="var(--color-citron)" />
              </linearGradient>
            </defs>

            <g filter="url(#capsule-thumb-glow)" strokeLinecap="round" strokeLinejoin="round">
              <path d="M 200 230 C 190 230 185 220 185 205 C 185 185 215 185 215 205 C 215 225 195 245 190 265" stroke="url(#cap-neon)" strokeWidth="5" />
              <path d="M 195 195 C 195 190 205 190 205 195 C 205 205 195 215 195 225" stroke="var(--color-accent-emerald-light)" strokeWidth="4" />
              <path d="M 175 250 C 170 215 170 175 200 170 C 230 175 230 215 225 250 C 220 280 185 300 180 330" stroke="url(#cap-moss)" strokeWidth="5" />
              <path d="M 160 270 C 155 210 155 155 200 150 C 245 155 245 210 240 270 C 235 310 180 340 170 375" stroke="url(#cap-neon)" strokeWidth="5" />
              <path d="M 145 290 C 140 200 140 135 200 130 C 260 135 260 200 255 290 C 250 340 175 375 160 415" stroke="url(#cap-moss)" strokeWidth="5" />
              <path d="M 130 310 C 125 190 125 115 200 110 C 275 115 275 190 270 310 C 265 370 170 410 150 450" stroke="url(#cap-neon)" strokeWidth="5" />
              <path d="M 115 330 C 110 180 110 95 200 90 C 290 95 290 180 285 330 C 280 400 165 440 140 480" stroke="url(#cap-moss)" strokeWidth="5" />
              <path d="M 100 350 C 95 220 95 75 200 70 C 250 70 280 100 295 140" stroke="url(#cap-neon)" strokeWidth="5" />
              <path d="M 85 370 C 80 250 80 60 200 50 C 265 50 300 80 315 130" stroke="url(#cap-moss)" strokeWidth="4.5" />
              <path d="M 305 350 C 310 260 310 160 305 130" stroke="url(#cap-moss)" strokeWidth="5" />
              <path d="M 320 370 C 325 280 325 180 315 130" stroke="url(#cap-neon)" strokeWidth="4.5" />
              <path d="M 70 390 C 65 310 65 240 75 180" stroke="url(#cap-moss)" strokeWidth="4" />
              <path d="M 60 410 C 55 340 55 270 65 210" stroke="url(#cap-neon)" strokeWidth="3.5" />
              <path d="M 335 390 C 340 320 340 250 330 190" stroke="url(#cap-moss)" strokeWidth="4" />
              <path d="M 345 410 C 350 350 350 280 340 220" stroke="url(#cap-neon)" strokeWidth="3.5" />
              <path d="M 185 160 C 190 145 195 140 200 135" stroke="var(--color-accent-emerald-light)" strokeWidth="3.5" />
              <path d="M 215 160 C 210 145 205 140 200 135" stroke="var(--color-accent-emerald-light)" strokeWidth="3.5" />
              <path d="M 165 210 C 170 195 175 190 180 185" stroke="var(--color-accent-emerald-light)" strokeWidth="3.5" />
              <path d="M 235 210 C 230 195 225 190 220 185" stroke="var(--color-accent-emerald-light)" strokeWidth="3.5" />
              <path d="M 150 260 C 155 245 160 240 165 235" stroke="var(--color-accent-emerald-light)" strokeWidth="3.5" />
              <path d="M 250 260 C 245 245 240 240 235 235" stroke="var(--color-accent-emerald-light)" strokeWidth="3.5" />
              <path d="M 195 280 C 190 320 170 350 160 380" stroke="url(#cap-neon)" strokeWidth="4.5" />
              <path d="M 210 280 C 215 320 200 360 180 400" stroke="url(#cap-moss)" strokeWidth="4.5" />
              <path d="M 225 300 C 220 350 190 390 170 430" stroke="url(#cap-neon)" strokeWidth="4.5" />
            </g>
          </svg>

          {/* Up & Down Scanning Laser Line */}
          <div
            ref={scanLaserRef}
            className="absolute inset-x-0 w-full h-2.5 pointer-events-none z-10"
            style={{ top: '10%' }}
          >
            <div className="w-full h-full bg-gradient-to-b from-transparent via-accent-emerald-bright/80 to-transparent opacity-95" />
            <div className="w-full h-[1.5px] bg-citron shadow-[0_0_10px_var(--color-citron)]" />
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
        </div>

        {/* Center Info Column */}
        <div className="flex flex-col text-left flex-1 min-w-0 pr-2">
          <span className="text-[11px] font-mono uppercase tracking-widest text-citron font-semibold transition-colors truncate">
            {currentStage ? currentStage.sub : defaultSubtitle}
          </span>
          <span className="text-base sm:text-lg font-bold tracking-wide text-text-primary font-sans transition-colors truncate mt-0.5">
            {currentStage ? currentStage.title : defaultTitle}
          </span>
        </div>

        {/* Right Percentage & Status Tag */}
        <div className="pl-3 sm:pl-4 border-l border-white/10 font-mono text-sm text-citron flex items-center gap-1.5 flex-shrink-0">
          {isComplete ? (
            <span className="material-symbols-outlined text-citron text-2xl">check_circle</span>
          ) : isAuthenticating ? (
            <span className="font-semibold">{Math.round(progress)}%</span>
          ) : (
            <span className="material-symbols-outlined text-text-muted group-hover:text-citron transition-colors text-xl">
              arrow_forward
            </span>
          )}
        </div>

        {/* Bottom Embedded Progress Bar Fill */}
        <div className="absolute bottom-0 left-0 right-0 h-[3.5px] bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-emerald via-accent-emerald-bright to-citron transition-all duration-300 shadow-[0_0_8px_var(--color-accent-emerald-bright)]"
            style={{ width: `${isAuthenticating || isComplete ? progress : 0}%` }}
          />
        </div>
      </button>
    </div>
  );
};
