'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Modal } from '@/components/ui/modal';
import { Pill } from '@/components/ui/pill';
import { MetricCard } from '@/components/common/metric-card';
import { PrepActionCard } from './PrepActionCard';

export interface LandslideModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
  /** Callback when Learn More is clicked */
  onLearnMore?: () => void;
}

export const LandslideModal: React.FC<LandslideModalProps> = ({
  isOpen,
  onClose,
  onLearnMore,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Stagger entrance of action cards when modal opens (Rule #3)
  useGSAP(() => {
    if (!isOpen || !containerRef.current) return;
    gsap.fromTo(
      '.prep-card-item',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, stagger: 0.04, ease: 'power2.out', delay: 0.15, overwrite: 'auto' }
    );
  }, { scope: containerRef, dependencies: [isOpen] });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      header={
        <>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-text-muted hover:text-ink dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-1 text-xs font-mono cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>Back to Map</span>
            </button>
            <span className="text-line-strong dark:text-white/20">•</span>
            <span className="text-xs font-mono uppercase tracking-wider text-citron font-semibold">
              Disaster Profile #01
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-ink dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </>
      }
      footer={
        <>
          <div className="text-xs text-text-muted flex items-center gap-1.5">
            <span className="material-symbols-outlined text-citron text-sm">verified_user</span>
            <span>
              Remember: Early awareness and preparedness can <strong className="text-citron">save lives</strong>.
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-text-secondary hover:text-ink dark:hover:text-white transition-colors cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={onLearnMore}
              className="px-5 py-2.5 rounded-xl bg-citron text-forest-dark font-bold text-xs hover:bg-citron-hover shadow-[0_0_20px_rgba(212,241,93,0.3)] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Learn More Guidelines</span>
              <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
            </button>
          </div>
        </>
      }
    >
      <div ref={containerRef} className="space-y-8">
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="text-xs font-mono uppercase tracking-widest text-citron font-semibold">
              You Selected
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-ink dark:text-white flex items-center gap-2 tracking-tight">
              Landslide 🏔️
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Landslides are sudden movements of rock, soil or debris down a slope, often triggered by heavy rainfall, earthquakes or rapid human infrastructure development.
            </p>

            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-semibold text-text-muted">Common in:</div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Pill>• Hilly & mountainous regions</Pill>
                <Pill>• Steep deforested slopes</Pill>
                <Pill>• Areas with loose saturated soil</Pill>
              </div>
            </div>

            {/* Statistics Row with Animated Counters */}
            <div className="grid grid-cols-3 gap-3 pt-3">
              <MetricCard
                value={2847}
                label="Landslide Events (2010–2024)"
                variant="rose"
              />
              <MetricCard
                value="1.2M+"
                label="People Affected"
                variant="amber"
                animateNumber={false}
              />
              <MetricCard
                value={8450}
                label="Estimated Losses"
                prefix="₹"
                suffix=" Cr"
                variant="emerald"
              />
            </div>
          </div>

          {/* Rescue Image */}
          <div className="lg:col-span-5 rounded-2xl overflow-hidden border border-line dark:border-white/15 relative h-64 lg:h-72 bg-surface-1 dark:bg-forest-surface shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1541888946425-d0fbb186f5f7?auto=format&fit=crop&w=800&q=80"
              alt="Rescue Operations"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs">
              <span className="pill-badge px-2.5 py-1 rounded-md text-[10px] text-citron font-mono">
                NDRF Rapid Deployment
              </span>
              <span className="text-[10px] text-white/80 font-mono">Status: Alert Level 3</span>
            </div>
          </div>
        </div>

        {/* Guidance & Preparedness Section */}
        <div className="pt-6 border-t border-line dark:border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-citron font-semibold">
                From Risk to Readiness
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-ink dark:text-white tracking-tight">
                Safety Measures & Readiness Guidance
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className="pill-badge px-3 py-1 rounded-full text-xs text-citron font-semibold border-citron/30">
                01 Before a Landslide: Prevention is Key
              </span>
            </div>
          </div>

          {/* 6 Preparedness Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <PrepActionCard
              title="Know the Risk"
              description="Identify landslide-prone areas and historical slip paths in your district."
              icon="nature_people"
              iconBgClass="bg-citron/15"
              iconColorClass="text-citron"
            />
            <PrepActionCard
              title="Monitor Weather"
              description="Stay updated with heavy rainfall alerts from IMD and district disaster telemetry."
              icon="rainy"
              iconBgClass="bg-accent-emerald-light/15"
              iconColorClass="text-accent-emerald-light"
            />
            <PrepActionCard
              title="Secure Surroundings"
              description="Avoid construction on steep slopes. Maintain storm drainage channels free of debris."
              icon="foundation"
              iconBgClass="bg-hazard-amber/15"
              iconColorClass="text-hazard-amber"
            />
            <PrepActionCard
              title="Check Warning Signs"
              description="Watch for cracks in ground or retaining walls, tilted trees, or unusual rumblings."
              icon="warning"
              iconBgClass="bg-hazard-red/15"
              iconColorClass="text-hazard-red"
            />
            <PrepActionCard
              title="Prepare Emergency Kit"
              description="Keep essentials, legal documents, dry rations, torch, and first-aid kits ready to go."
              icon="medical_services"
              iconBgClass="bg-citron/15"
              iconColorClass="text-citron"
            />
            <PrepActionCard
              title="Plan Evacuation Routes"
              description="Memorize designated safe assembly zones and multiple evacuation pathways."
              icon="route"
              iconBgClass="bg-accent-emerald-bright/15"
              iconColorClass="text-accent-emerald-bright"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};
