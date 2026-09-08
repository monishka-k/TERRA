'use client';

import React from 'react';
import { FooterBrand } from './FooterBrand';
import { FooterNav } from './FooterNav';
import { FooterTelemetry } from './FooterTelemetry';

export interface FrostedFooterProps {
  /** Optional custom className */
  className?: string;
  /** Granular classNames */
  classNames?: {
    container?: string;
    topRow?: string;
    bottomRow?: string;
  };
}

export const FrostedFooter: React.FC<FrostedFooterProps> = ({
  className = '',
  classNames = {},
}) => {
  return (
    <footer
      id="landing-footer"
      className={`relative z-20 w-full rounded-t-3xl border-t border-line/80 dark:border-white/15 bg-surface-0/75 dark:bg-[#0b1612]/75 backdrop-blur-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.12)] transition-colors duration-300 ${className}`}
    >
      {/* Subtle top ambient rim light */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent-emerald/40 to-transparent pointer-events-none" />

      <div
        className={`max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pt-8 pb-10 flex flex-col gap-8 ${
          classNames.container ?? ''
        }`}
      >
        {/* Top Segment: Brand on Left, Telemetry Controls on Right */}
        <div
          className={`flex flex-col md:flex-row md:items-center justify-between gap-6 ${
            classNames.topRow ?? ''
          }`}
        >
          <FooterBrand />
          <FooterTelemetry />
        </div>

        {/* Bottom Segment: Navigation Links & Copyright */}
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-line/60 dark:border-white/10 ${
            classNames.bottomRow ?? ''
          }`}
        >
          <FooterNav />

          <p className="text-[11px] font-mono text-text-muted">
            © 2026 SETU-DRR · NDMD / NDRF · All Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  );
};
