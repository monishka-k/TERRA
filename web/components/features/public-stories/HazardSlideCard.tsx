'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { StorySlide } from './storyData';

export interface HazardSlideCardProps {
  /** Slide data */
  slide: StorySlide;
  /** Custom root className */
  className?: string;
}

export const HazardSlideCard: React.FC<HazardSlideCardProps> = ({
  slide,
  className = '',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!cardRef.current) return;
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }
    );
  }, { dependencies: [slide.id] });

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'Critical':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'High':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Moderate':
        return 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div
      ref={cardRef}
      className={`grid grid-cols-1 lg:grid-cols-12 gap-6 items-center select-none ${className}`}
    >
      {/* Visual Image Showcase (Col 1-7) */}
      <div className="lg:col-span-7 relative h-64 sm:h-80 lg:h-[420px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl group">
        <Image
          src={slide.image}
          alt={slide.title}
          fill
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Floating Hazard Pill */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider border backdrop-blur-md ${getSeverityColor(
              slide.riskSeverity
            )}`}
          >
            {slide.riskSeverity} :: {slide.hazardType}
          </span>
        </div>

        {/* Bottom Image Caption */}
        <div className="absolute bottom-4 left-4 right-4 text-xs font-mono text-cream/80 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center justify-between">
          <span>InSAR / SAR Geodesy Verified</span>
          <span className="text-m3-accent-foliage">● Active Monitored Zone</span>
        </div>
      </div>

      {/* Narrative & Telemetry Column (Col 8-12) */}
      <div className="lg:col-span-5 flex flex-col justify-between h-full py-2">
        <div>
          <span className="text-xs font-mono text-m3-accent-foliage tracking-widest uppercase">
            {slide.subtitle}
          </span>
          <h3 className="font-display text-2xl sm:text-3xl font-bold text-cream mt-1 mb-3 leading-tight">
            {slide.title}
          </h3>
          <p className="text-xs sm:text-sm text-cream/70 leading-relaxed font-sans mb-5 font-light">
            {slide.description}
          </p>

          {/* Telemetry Chips */}
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            {slide.telemetry.map((metric, idx) => (
              <div
                key={idx}
                className="bg-forest-surface/80 border border-white/10 rounded-xl p-2.5 backdrop-blur-sm"
              >
                <div className="text-[10px] font-mono text-cream/50 uppercase tracking-wider">
                  {metric.label}
                </div>
                <div className="text-sm font-semibold text-cream font-mono mt-0.5">
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Adaptation & Relocation Banner */}
        <div className="p-3 rounded-xl bg-[#22543d]/30 border border-[#a3e635]/30 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-m3-accent-foliage text-lg shrink-0 mt-0.5">
            shield
          </span>
          <p className="text-[11px] text-cream/80 leading-snug font-sans">
            <strong className="text-m3-accent-foliage font-semibold">
              Action Plan:{' '}
            </strong>
            {slide.mitigation}
          </p>
        </div>
      </div>
    </div>
  );
};

export default HazardSlideCard;
