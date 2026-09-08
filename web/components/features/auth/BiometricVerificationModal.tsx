'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface BiometricVerificationModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Officer identifier being verified */
  officerId?: string;
  /** Callback when user cancels or closes modal */
  onClose: () => void;
  /** Callback when verification is completed and authenticated */
  onVerificationSuccess: () => void;
  /** Custom root className */
  className?: string;
}

const STAGES = [
  { threshold: 25, sub: 'READING CELLULAR RIDGES...', title: 'Acquiring Specimen' },
  { threshold: 55, sub: 'COMPUTING TOPOLOGY HASH...', title: 'Matching Topology' },
  { threshold: 85, sub: 'DECRYPTING GEODETIC KEY...', title: 'Finalizing Protocol' },
  { threshold: 100, sub: 'IDENTITY CONFIRMED', title: 'Authenticated' },
];

export const BiometricVerificationModal: React.FC<BiometricVerificationModalProps> = ({
  isOpen,
  officerId = 'NDRF-OFFICER-894',
  onClose,
  onVerificationSuccess,
  className = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const scanBeamRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(15);
  const [stageIndex, setStageIndex] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // GSAP Entrance
  useGSAP(() => {
    if (!modalRef.current) return;
    if (isOpen) {
      gsap.fromTo(
        modalRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: 'power2.out' }
      );
    }
  }, [isOpen]);

  // Laser beam vertical oscillation
  useGSAP(() => {
    if (!scanBeamRef.current) return;
    if (isOpen && !isAuthenticated) {
      gsap.fromTo(
        scanBeamRef.current,
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
      gsap.killTweensOf(scanBeamRef.current);
    }
  }, [isOpen, isAuthenticated]);

  // Biometric Authentication Sequence
  useEffect(() => {
    if (!isOpen) {
      const resetTimer = setTimeout(() => {
        setProgress(15);
        setStageIndex(0);
        setIsAuthenticated(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsAuthenticated(true);
          setStageIndex(3);
          setTimeout(() => {
            onVerificationSuccess();
          }, 1100);
          return 100;
        }

        const next = prev + Math.floor(Math.random() * 5) + 3;
        if (next >= 100) {
          setIsAuthenticated(true);
          setStageIndex(3);
          setTimeout(() => {
            onVerificationSuccess();
          }, 1100);
          return 100;
        }

        if (next > 25 && next <= 55) setStageIndex(1);
        else if (next > 55 && next <= 85) setStageIndex(2);
        else if (next > 85) setStageIndex(3);

        return next;
      });
    }, 90);

    return () => clearInterval(interval);
  }, [isOpen, onVerificationSuccess]);

  if (!isOpen) return null;

  const currentStage = STAGES[stageIndex];

  return (
    <div
      ref={modalRef}
      className={`fixed inset-0 z-50 bg-forest-dark/90 backdrop-blur-2xl flex flex-col items-center justify-center select-none overflow-hidden ${className}`}
    >
      {/* Background Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] rounded-full bg-citron/10 blur-[140px] pointer-events-none" />

      {/* Top Dismiss Button */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 z-20 p-2.5 rounded-full bg-forest-mid/60 border border-white/10 text-text-muted hover:text-white hover:bg-forest-mid transition-all cursor-pointer"
          title="Close Verification"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      )}

      {/* Central Stitch Biometric Capsule Showcase Container */}
      <div className="relative z-10 flex flex-col items-center justify-center max-w-lg w-full px-6">
        
        {/* Outer Solarpunk / Cartography Ambient Ripple Rings */}
        <div className="relative flex items-center justify-center w-full">
          <div
            className={`absolute inset-0 -m-6 rounded-3xl border border-citron/30 pointer-events-none transition-opacity duration-500 ${
              !isAuthenticated ? 'animate-ring-1 opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`absolute inset-0 -m-6 rounded-3xl border border-citron/20 pointer-events-none transition-opacity duration-500 ${
              !isAuthenticated ? 'animate-ring-2 opacity-100' : 'opacity-0'
            }`}
          />

          {/* Stitch Biometric Capsule Pod (100% Seamless Dark Glass, Zero White Box) */}
          <div className="group relative w-full flex items-center gap-6 px-8 py-6 rounded-3xl bg-forest-surface/95 text-text-primary shadow-[0_16px_56px_rgba(0,0,0,0.7)] overflow-hidden border border-citron/40">
            
            {/* Enlarged Left Thumbnail Pod (Pure Vector Transparent Thumbprint) */}
            <div className="relative w-20 h-24 sm:w-24 sm:h-28 rounded-2xl bg-forest-dark flex items-center justify-center overflow-hidden border border-citron/50 shadow-inner flex-shrink-0 p-2">
              <svg
                viewBox="0 0 400 500"
                className="w-full h-full object-contain filter drop-shadow-[0_0_20px_var(--color-accent-emerald)]"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <filter id="modal-thumb-glow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <linearGradient id="mod-moss" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--color-accent-emerald-bright)" />
                    <stop offset="50%" stopColor="var(--color-accent-emerald)" />
                    <stop offset="100%" stopColor="var(--color-forest-light)" />
                  </linearGradient>
                  <linearGradient id="mod-neon" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="var(--color-accent-emerald-light)" />
                    <stop offset="50%" stopColor="var(--color-accent-emerald-bright)" />
                    <stop offset="100%" stopColor="var(--color-citron)" />
                  </linearGradient>
                </defs>

                <g filter="url(#modal-thumb-glow)" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M 200 230 C 190 230 185 220 185 205 C 185 185 215 185 215 205 C 215 225 195 245 190 265" stroke="url(#mod-neon)" strokeWidth="5" />
                  <path d="M 195 195 C 195 190 205 190 205 195 C 205 205 195 215 195 225" stroke="var(--color-accent-emerald-light)" strokeWidth="4" />
                  <path d="M 175 250 C 170 215 170 175 200 170 C 230 175 230 215 225 250 C 220 280 185 300 180 330" stroke="url(#mod-moss)" strokeWidth="5" />
                  <path d="M 160 270 C 155 210 155 155 200 150 C 245 155 245 210 240 270 C 235 310 180 340 170 375" stroke="url(#mod-neon)" strokeWidth="5" />
                  <path d="M 145 290 C 140 200 140 135 200 130 C 260 135 260 200 255 290 C 250 340 175 375 160 415" stroke="url(#mod-moss)" strokeWidth="5" />
                  <path d="M 130 310 C 125 190 125 115 200 110 C 275 115 275 190 270 310 C 265 370 170 410 150 450" stroke="url(#mod-neon)" strokeWidth="5" />
                  <path d="M 115 330 C 110 180 110 95 200 90 C 290 95 290 180 285 330 C 280 400 165 440 140 480" stroke="url(#mod-moss)" strokeWidth="5" />
                  <path d="M 100 350 C 95 220 95 75 200 70 C 250 70 280 100 295 140" stroke="url(#mod-neon)" strokeWidth="5" />
                  <path d="M 85 370 C 80 250 80 60 200 50 C 265 50 300 80 315 130" stroke="url(#mod-moss)" strokeWidth="4.5" />
                  <path d="M 305 350 C 310 260 310 160 305 130" stroke="url(#mod-moss)" strokeWidth="5" />
                  <path d="M 320 370 C 325 280 325 180 315 130" stroke="url(#mod-neon)" strokeWidth="4.5" />
                  <path d="M 70 390 C 65 310 65 240 75 180" stroke="url(#mod-moss)" strokeWidth="4" />
                  <path d="M 60 410 C 55 340 55 270 65 210" stroke="url(#mod-neon)" strokeWidth="3.5" />
                  <path d="M 335 390 C 340 320 340 250 330 190" stroke="url(#mod-moss)" strokeWidth="4" />
                  <path d="M 345 410 C 350 350 350 280 340 220" stroke="url(#mod-neon)" strokeWidth="3.5" />
                  <path d="M 185 160 C 190 145 195 140 200 135" stroke="var(--color-accent-emerald-light)" strokeWidth="3.5" />
                  <path d="M 215 160 C 210 145 205 140 200 135" stroke="var(--color-accent-emerald-light)" strokeWidth="3.5" />
                  <path d="M 165 210 C 170 195 175 190 180 185" stroke="var(--color-accent-emerald-light)" strokeWidth="3.5" />
                  <path d="M 235 210 C 230 195 225 190 220 185" stroke="var(--color-accent-emerald-light)" strokeWidth="3.5" />
                  <path d="M 150 260 C 155 245 160 240 165 235" stroke="var(--color-accent-emerald-light)" strokeWidth="3.5" />
                  <path d="M 250 260 C 245 245 240 240 235 235" stroke="var(--color-accent-emerald-light)" strokeWidth="3.5" />
                  <path d="M 195 280 C 190 320 170 350 160 380" stroke="url(#mod-neon)" strokeWidth="4.5" />
                  <path d="M 210 280 C 215 320 200 360 180 400" stroke="url(#mod-moss)" strokeWidth="4.5" />
                  <path d="M 225 300 C 220 350 190 390 170 430" stroke="url(#mod-neon)" strokeWidth="4.5" />
                </g>
              </svg>

              {/* Vertical Laser Beam Scanline */}
              {!isAuthenticated && (
                <div
                  ref={scanBeamRef}
                  className="absolute inset-x-0 w-full h-3 pointer-events-none z-10"
                  style={{ top: '10%' }}
                >
                  <div className="w-full h-full bg-gradient-to-b from-transparent via-accent-emerald-bright to-transparent opacity-95" />
                  <div className="w-full h-[2px] bg-citron shadow-[0_0_12px_var(--color-citron)]" />
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
            </div>

            {/* Center Info Column */}
            <div className="flex flex-col text-left flex-1 min-w-0 pr-2">
              <span className="text-xs font-mono uppercase tracking-widest text-citron font-semibold transition-colors truncate">
                {currentStage.sub}
              </span>
              <span className="text-lg sm:text-xl font-bold tracking-wide text-text-primary font-sans transition-colors truncate mt-1">
                {isAuthenticated ? 'Authenticated' : currentStage.title}
              </span>
            </div>

            {/* Right Status / Percentage Tag */}
            <div className="pl-4 border-l border-white/10 font-mono text-base text-citron flex items-center gap-1.5 flex-shrink-0">
              {isAuthenticated ? (
                <span className="material-symbols-outlined text-citron text-3xl animate-bounce">
                  check_circle
                </span>
              ) : (
                <span className="font-semibold">{Math.round(progress)}%</span>
              )}
            </div>

            {/* Bottom Progress Bar Fill */}
            <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-emerald via-accent-emerald-bright to-citron transition-all duration-200 shadow-[0_0_10px_var(--color-accent-emerald-bright)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Clean Authenticated Confirmation Badge */}
        {isAuthenticated && (
          <div className="mt-6 inline-flex items-center gap-2 px-6 py-2 rounded-full bg-citron/20 border border-citron text-citron font-display font-semibold text-sm tracking-wider shadow-[0_0_30px_var(--color-citron)]">
            <span className="material-symbols-outlined text-base text-citron">shield_lock</span>
            <span>Officer Node Verified: {officerId}</span>
          </div>
        )}
      </div>
    </div>
  );
};
