'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Drawer } from '@/components/ui/drawer';
import { HazardCard } from './HazardCard';
import { DidYouKnowCard } from './DidYouKnowCard';

export interface HazardDrawerProps {
  /** Whether drawer is open */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
  /** Callback when Landslide is clicked */
  onSelectLandslide: () => void;
  /** Callback when Zoom to India is clicked */
  onZoomIndia: () => void;
  /** Generic toast / trigger callback */
  onShowHazardMessage: (msg: string) => void;
}

export const HazardDrawer: React.FC<HazardDrawerProps> = ({
  isOpen,
  onClose,
  onSelectLandslide,
  onZoomIndia,
  onShowHazardMessage,
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Stagger entrance of hazard cards on drawer open (Rule #3)
  useGSAP(() => {
    if (!isOpen || !listRef.current) return;
    gsap.fromTo(
      '.hazard-card-item',
      { x: 25, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.35, stagger: 0.04, ease: 'power2.out', delay: 0.15, overwrite: 'auto' }
    );
  }, { scope: listRef, dependencies: [isOpen] });

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Regional Hazard Intelligence"
      subtitle="Select a location or disaster type to assess risk profiles."
      icon={<span className="material-symbols-outlined text-xl">shield</span>}
      footer={
        <>
          <button
            onClick={onZoomIndia}
            className="px-4 py-2 rounded-xl bg-citron/20 text-citron border border-citron/30 text-xs font-semibold hover:bg-citron/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">my_location</span>
            <span>Zoom to India Subcontinent</span>
          </button>
          <button
            onClick={onClose}
            className="text-xs text-text-muted hover:text-text-primary cursor-pointer"
          >
            Close
          </button>
        </>
      }
    >
      <div ref={listRef} className="space-y-6">
        {/* Search Bar */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-3 text-text-muted text-lg">search</span>
          <input
            type="text"
            placeholder="Search state, district or village in India..."
            className="w-full bg-surface-1/90 dark:bg-forest-surface/90 border border-line dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-citron/50 transition-colors"
          />
        </div>

        {/* Welcome Greeting Card */}
        <div className="glass-card p-4 rounded-2xl border border-line dark:border-white/10 bg-gradient-to-r from-surface-1/90 to-surface-2/70 dark:from-forest-deep/60 dark:to-forest-mid/30">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-display font-bold text-ink dark:text-white flex items-center gap-1.5">
                Welcome, Officer <span className="text-base">👋</span>
              </div>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Select a location in India to assess multi-hazard susceptibility and relocation insights.
              </p>
            </div>
            <span className="pill-badge px-2.5 py-1 rounded-lg text-[10px] font-mono text-citron shrink-0">
              HQ Online
            </span>
          </div>
        </div>

        {/* Explore Hazards Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-display font-bold text-ink dark:text-white text-sm tracking-tight">Explore Prominent Hazards</h4>
            <span className="text-[11px] font-mono text-text-muted">India Vulnerability Map</span>
          </div>

          <div className="space-y-2.5">
            <HazardCard
              title="Landslide"
              subtitle="Mountainous & hilly regions (Himalayas, Western Ghats)"
              icon="landslide"
              colorScheme="emerald"
              onClick={onSelectLandslide}
            />
            <HazardCard
              title="Flood"
              subtitle="River basins & lowlands (Assam, Bihar, Kerala)"
              icon="flood"
              colorScheme="cyan"
              onClick={() => onShowHazardMessage('Flood risk analysis loaded for Gangetic plain & Brahmaputra valley.')}
            />
            <HazardCard
              title="Cloudburst"
              subtitle="High rainfall intensity areas & sudden flash floods"
              icon="thunderstorm"
              colorScheme="amber"
              onClick={() => onShowHazardMessage('Cloudburst Doppler radar stream active.')}
            />
            <HazardCard
              title="Coastal Erosion"
              subtitle="Coastal & island regions (Odisha, Sundarbans)"
              icon="tsunami"
              colorScheme="teal"
              onClick={() => onShowHazardMessage('Coastal tide gauge network synchronized.')}
            />
            <HazardCard
              title="Earthquake"
              subtitle="Seismic Zones IV & V (Northeast, Kutch, Himalayas)"
              icon="earthquake"
              colorScheme="rose"
              onClick={() => onShowHazardMessage('Seismic Zone IV & V accelerometers online.')}
            />
          </div>
        </div>

        {/* Did You Know Banner */}
        <DidYouKnowCard />
      </div>
    </Drawer>
  );
};
