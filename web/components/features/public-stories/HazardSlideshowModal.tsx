'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ZoneId, REGIONAL_STORIES } from './storyData';
import { HazardSlideCard } from './HazardSlideCard';

export interface HazardSlideshowModalProps {
  /** Modal open status */
  isOpen: boolean;
  /** Active zone being explored */
  zone: ZoneId;
  /** Callback to close modal */
  onClose: () => void;
  /** Custom root className */
  className?: string;
}

export const HazardSlideshowModal: React.FC<HazardSlideshowModalProps> = ({
  isOpen,
  zone,
  onClose,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const modalBoxRef = useRef<HTMLDivElement>(null);
  const [prevZone, setPrevZone] = useState(zone);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  if (prevZone !== zone) {
    setPrevZone(zone);
    setCurrentSlideIndex(0);
  }

  const activeRegion = REGIONAL_STORIES[zone];
  const slides = activeRegion ? activeRegion.slides : [];

  const handleNext = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev < slides.length - 1 ? prev + 1 : 0));
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev > 0 ? prev - 1 : slides.length - 1));
  }, [slides.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev]);

  useGSAP(() => {
    if (!isOpen || !modalBoxRef.current) return;
    gsap.fromTo(
      modalBoxRef.current,
      { scale: 0.94, opacity: 0, y: 20 },
      { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }
    );
  }, { dependencies: [isOpen] });

  if (!isOpen || !activeRegion || slides.length === 0) return null;

  const currentSlide = slides[currentSlideIndex];

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-black/80 backdrop-blur-xl ${className}`}
    >
      <div
        ref={modalBoxRef}
        className="w-full max-w-5xl glass-card bg-surface-0/95 dark:bg-[#0e261d]/95 border border-line dark:border-white/15 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl flex flex-col relative overflow-hidden text-ink dark:text-cream"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-line dark:border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-citron animate-ping" />
            <span className="font-mono text-xs uppercase tracking-widest text-m3-accent-foliage font-semibold">
              Hazard Intelligence Slideshow
            </span>
            <span className="text-ink-faint dark:text-white/30">|</span>
            <span className="text-xs font-mono text-ink-muted dark:text-cream/70 font-medium">
              {activeRegion.regionName}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-1 hover:bg-surface-2 dark:bg-white/10 dark:hover:bg-white/20 text-ink-muted hover:text-ink dark:text-cream/80 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close Slideshow"
          >
            ✕
          </button>
        </div>

        {/* Active Slide Body */}
        <div className="flex-1 my-auto">
          <HazardSlideCard slide={currentSlide} />
        </div>

        {/* Bottom Pagination & Nav Controls */}
        <div className="flex items-center justify-between border-t border-line dark:border-white/10 pt-5 mt-6">
          {/* Slide Counter */}
          <div className="font-mono text-xs text-ink-muted dark:text-cream/60 tracking-wider">
            SLIDE{' '}
            <span className="text-m3-accent-foliage font-bold">
              0{currentSlideIndex + 1}
            </span>{' '}
            / 0{slides.length}
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlideIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentSlideIndex
                    ? 'w-7 bg-citron'
                    : 'w-2 bg-ink-faint/30 dark:bg-white/25 hover:bg-ink-faint/60 dark:hover:bg-white/50'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Prev / Next Arrows */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="p-2 rounded-xl bg-surface-1 hover:bg-surface-2 dark:bg-white/10 dark:hover:bg-white/20 text-ink dark:text-cream transition-colors flex items-center justify-center cursor-pointer active:scale-95 border border-line dark:border-transparent"
              aria-label="Previous Slide"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-3.5 py-2 rounded-xl bg-citron hover:bg-citron-hover text-[#06100c] font-semibold text-xs transition-transform hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md"
              aria-label="Next Slide"
            >
              <span>Next</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HazardSlideshowModal;
