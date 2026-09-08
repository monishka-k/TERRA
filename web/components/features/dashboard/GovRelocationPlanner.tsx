'use client';

import React, { useState } from 'react';
import { DEMO_RELOCATION_CANDIDATES, HabitationData, RelocationCandidate } from './demoData';

export interface GovRelocationPlannerProps {
  habitation: HabitationData;
  onBackToMap: () => void;
  className?: string;
}

export const GovRelocationPlanner: React.FC<GovRelocationPlannerProps> = ({
  habitation,
  onBackToMap,
  className = ''
}) => {
  const [selectedCandidate, setSelectedCandidate] = useState<RelocationCandidate>(
    DEMO_RELOCATION_CANDIDATES[1] // Default Site B
  );
  const [isApproved, setIsApproved] = useState<boolean>(false);

  return (
    <div
      className={`w-full h-full flex flex-col bg-gov-bg-light dark:bg-gov-bg text-gov-bg dark:text-cream overflow-y-auto ${className}`}
    >
      {/* TOP SUB-HEADER BAR */}
      <div className="p-4 md:px-8 bg-gov-surface-light/60 dark:bg-gov-surface/60 border-b border-gov-bg/10 dark:border-gov-bg-light/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToMap}
            className="p-1.5 rounded-md hover:bg-gov-bg/10 dark:hover:bg-gov-bg-light/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>←</span>
            <span>Back to Map</span>
          </button>
          <span className="text-gov-bg/30 dark:text-cream/30">|</span>
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-gov-bg/60 dark:text-cream/60 uppercase">
              RELOCATION SUITABILITY MATRIX
            </span>
            <h1
              className="text-lg md:text-xl font-bold tracking-tight"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              Origin: {habitation.name}, {habitation.state}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-gov-red/10 border border-gov-red/30 text-gov-red font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-gov-red" />
            <span>Caseload: {habitation.households} Households</span>
          </div>
          <div className="px-3 py-1 rounded bg-gov-surface-light dark:bg-gov-bg border border-gov-bg/15 dark:border-gov-bg-light/15 font-mono">
            Origin Risk: {habitation.riskScore.toFixed(2)}
          </div>
        </div>
      </div>

      {/* MAIN COMPARISON WORKSPACE */}
      <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
        {/* CANDIDATE SITE COMPARISON CARDS */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-wider uppercase text-gov-bg/70 dark:text-cream/70">
              Candidate Relocation Sites ({DEMO_RELOCATION_CANDIDATES.length})
            </span>
            <span className="text-xs text-gov-bg/50 dark:text-cream/50 font-mono">
              Select a candidate site to inspect constraints
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {DEMO_RELOCATION_CANDIDATES.map((candidate) => {
              const isSelected = selectedCandidate.id === candidate.id;
              const capacityPercent = Math.min(
                100,
                Math.round((candidate.capacity / candidate.totalRequired) * 100)
              );

              return (
                <div
                  key={candidate.id}
                  onClick={() => setSelectedCandidate(candidate)}
                  className={`p-5 rounded-xl border transition-all duration-200 cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-gov-surface-light dark:bg-gov-surface-hover border-gov-orange shadow-lg ring-1 ring-gov-orange/50'
                      : 'bg-gov-surface-light/70 dark:bg-gov-surface/70 border-gov-bg/10 dark:border-gov-bg-light/10 hover:border-gov-bg/25 dark:hover:border-gov-bg-light/25'
                  }`}
                >
                  {/* CARD HEADER */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono font-bold tracking-wider text-gov-orange uppercase">
                          {candidate.code}
                        </span>
                        <h3
                          className="text-lg font-bold tracking-tight mt-0.5 text-gov-bg dark:text-cream"
                          style={{ fontFamily: 'Fraunces, Georgia, serif' }}
                        >
                          {candidate.name}
                        </h3>
                        <div className="text-[11px] text-gov-bg/60 dark:text-cream/60">
                          {candidate.location} · {candidate.distanceKm} km from origin
                        </div>
                      </div>

                      {/* SUITABILITY PILL */}
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-gov-bg/50 dark:text-cream/50 uppercase font-mono">
                          Suitability
                        </span>
                        <span
                          className="text-2xl font-bold font-serif text-gov-green"
                          style={{ fontFamily: 'Fraunces, Georgia, serif' }}
                        >
                          {candidate.suitabilityScore}%
                        </span>
                      </div>
                    </div>

                    {/* CAPACITY PROGRESS */}
                    <div className="mt-4 p-3 rounded-lg bg-gov-bg-light/80 dark:bg-gov-bg/80 border border-gov-bg/8 dark:border-gov-bg-light/8">
                      <div className="flex justify-between text-xs mb-1 font-mono">
                        <span className="text-gov-bg/70 dark:text-cream/70">Households Accommodated:</span>
                        <span className="font-bold">
                          {candidate.capacity} / {candidate.totalRequired}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-gov-bg/10 dark:bg-gov-bg-light/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gov-orange rounded-full transition-all duration-300"
                          style={{ width: `${capacityPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* BINDING CONSTRAINT BADGE */}
                  <div className="mt-4 pt-3 border-t border-gov-bg/10 dark:border-gov-bg-light/10 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gov-bg/50 dark:text-cream/50 uppercase">
                      Binding Constraint:
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-gov-red/15 text-gov-red border border-gov-red/30 uppercase">
                      {candidate.bindingConstraint}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DETAILED INSPECTION FOR SELECTED CANDIDATE */}
        <div className="p-6 rounded-xl bg-gov-surface-light dark:bg-gov-surface-hover border border-gov-bg/15 dark:border-gov-bg-light/15 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gov-bg/10 dark:border-gov-bg-light/10">
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-gov-orange uppercase">
                DETAILED SUITABILITY ANALYSIS
              </span>
              <h2
                className="text-xl font-bold mt-1"
                style={{ fontFamily: 'Fraunces, Georgia, serif' }}
              >
                {selectedCandidate.code}: {selectedCandidate.name} ({selectedCandidate.location})
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gov-bg/70 dark:text-cream/70">
                Land Parcel: <strong>{selectedCandidate.landTenure}</strong>
              </span>
              <span className="text-xs text-gov-bg/70 dark:text-cream/70 font-mono">
                Slope: <strong>{selectedCandidate.slope}</strong>
              </span>
            </div>
          </div>

          {/* CRITERIA BARS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
            {/* Land Suitability */}
            <div className="p-3 rounded-lg bg-gov-bg-light/60 dark:bg-gov-bg/60 border border-gov-bg/8 dark:border-gov-bg-light/8">
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span>Land Suitability</span>
                <span className="font-mono text-gov-green">
                  {selectedCandidate.landSuitability}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-gov-bg/10 dark:bg-gov-bg-light/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gov-green rounded-full"
                  style={{ width: `${selectedCandidate.landSuitability}%` }}
                />
              </div>
            </div>

            {/* Water Availability */}
            <div className="p-3 rounded-lg bg-gov-bg-light/60 dark:bg-gov-bg/60 border border-gov-bg/8 dark:border-gov-bg-light/8">
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span>Water Availability</span>
                <span className="font-mono text-gov-orange">
                  {selectedCandidate.waterAvailability}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-gov-bg/10 dark:bg-gov-bg-light/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gov-orange rounded-full"
                  style={{ width: `${selectedCandidate.waterAvailability}%` }}
                />
              </div>
            </div>

            {/* Road & Accessibility */}
            <div className="p-3 rounded-lg bg-gov-bg-light/60 dark:bg-gov-bg/60 border border-gov-bg/8 dark:border-gov-bg-light/8">
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span>Road & Transport Access</span>
                <span className="font-mono text-gov-amber">
                  {selectedCandidate.roadAccess}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-gov-bg/10 dark:bg-gov-bg-light/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gov-amber rounded-full"
                  style={{ width: `${selectedCandidate.roadAccess}%` }}
                />
              </div>
            </div>

            {/* School Access */}
            <div className="p-3 rounded-lg bg-gov-bg-light/60 dark:bg-gov-bg/60 border border-gov-bg/8 dark:border-gov-bg-light/8">
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span>School & Education Access</span>
                <span className="font-mono text-gov-green">
                  {selectedCandidate.schoolAccess}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-gov-bg/10 dark:bg-gov-bg-light/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gov-green rounded-full"
                  style={{ width: `${selectedCandidate.schoolAccess}%` }}
                />
              </div>
            </div>

            {/* Healthcare Access */}
            <div className="p-3 rounded-lg bg-gov-bg-light/60 dark:bg-gov-bg/60 border border-gov-bg/8 dark:border-gov-bg-light/8">
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span>Healthcare / PHC Access</span>
                <span className="font-mono text-gov-green">
                  {selectedCandidate.healthcareAccess}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-gov-bg/10 dark:bg-gov-bg-light/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gov-green rounded-full"
                  style={{ width: `${selectedCandidate.healthcareAccess}%` }}
                />
              </div>
            </div>

            {/* Elevation Buffer */}
            <div className="p-3 rounded-lg bg-gov-bg-light/60 dark:bg-gov-bg/60 border border-gov-bg/8 dark:border-gov-bg-light/8">
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span>Safe Elevation</span>
                <span className="font-mono text-gov-bg dark:text-cream">
                  {selectedCandidate.elevationM} m MSL
                </span>
              </div>
              <div className="text-[11px] text-gov-bg/60 dark:text-cream/60 mt-1">
                Outside 500-yr flash flood contour line
              </div>
            </div>
          </div>

          {/* ACTION SUBMIT BAR */}
          <div className="mt-8 pt-5 border-t border-gov-bg/10 dark:border-gov-bg-light/10 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-gov-bg/70 dark:text-cream/70">
              Selected Site: <strong>{selectedCandidate.name}</strong> ({selectedCandidate.capacity} Households)
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBackToMap}
                className="px-4 py-2 rounded-md border border-gov-bg/20 dark:border-gov-bg-light/20 text-xs font-semibold hover:bg-gov-bg/5 dark:hover:bg-gov-bg-light/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => setIsApproved(true)}
                disabled={isApproved}
                className={`px-5 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-150 shadow-md cursor-pointer ${
                  isApproved
                    ? 'bg-gov-green text-white cursor-default'
                    : 'bg-gov-red hover:bg-gov-red/85 text-white'
                }`}
              >
                {isApproved ? '✓ RELOCATION ORDER INITIATED' : `APPROVE ${selectedCandidate.code} FOR RELOCATION →`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GovRelocationPlanner;
