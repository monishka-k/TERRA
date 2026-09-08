'use client';

import React from 'react';
import { ANIMATION_STAGES, ANIMATION_DURATION_SEC, getCurrentStage } from './propagationEngine';
import { StageCard } from './StageCard';

export interface StoryboardScrubberProps {
  currentTime: number;
  isPlaying: boolean;
  isLooping: boolean;
  playbackSpeed: number;
  onTimeChange: (timeSec: number) => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onSpeedChange: (speed: number) => void;
  onReset: () => void;
  className?: string;
}

export const StoryboardScrubber: React.FC<StoryboardScrubberProps> = ({
  currentTime,
  isPlaying,
  isLooping,
  playbackSpeed,
  onTimeChange,
  onTogglePlay,
  onToggleLoop,
  onSpeedChange,
  onReset,
  className = '',
}) => {
  const currentStage = getCurrentStage(currentTime);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1).padStart(4, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div
      className={`w-full bg-gov-bg-light/95 dark:bg-gov-bg/95 backdrop-blur-md border-b border-gov-bg/15 dark:border-gov-bg-light/15 p-2.5 sm:p-3 transition-colors duration-200 select-none ${className}`}
    >
      {/* 1. TOP HEADER & PLAYBACK CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 mb-2 border-b border-gov-bg/10 dark:border-gov-bg-light/10">
        {/* Left: Simulation Title & Stage Headline */}
        <div className="flex items-center space-x-2.5">
          <span className="w-2 h-2 rounded-full bg-gov-amber animate-pulse" />
          <div className="flex items-baseline space-x-2">
            <span className="text-[11px] sm:text-xs font-mono font-bold tracking-wider text-gov-bg dark:text-cream uppercase">
              Hexagonal Risk Propagation
            </span>
            <span className="text-[10px] text-gov-amber font-mono font-semibold hidden md:inline-block">
              Stage {currentStage.id}: {currentStage.title}
            </span>
          </div>
        </div>

        {/* Center: Play/Pause/Scrub bar buttons */}
        <div className="flex items-center space-x-2">
          {/* Reset Button */}
          <button
            type="button"
            onClick={onReset}
            title="Reset to 0:00"
            className="p-1 rounded text-gov-bg/60 dark:text-cream/60 hover:text-gov-bg dark:hover:text-cream hover:bg-gov-bg/10 dark:hover:bg-gov-bg-light/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">skip_previous</span>
          </button>

          {/* Play / Pause Primary Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex items-center justify-center w-7 h-7 rounded-md bg-gov-amber text-gov-surface hover:bg-gov-amber/90 font-bold transition-all shadow-xs cursor-pointer"
            title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
          >
            <span className="material-symbols-outlined text-base">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          {/* Time Readout */}
          <span className="font-mono text-xs font-bold text-gov-bg dark:text-cream min-w-[76px] text-center">
            {formatTime(currentTime)} / {formatTime(ANIMATION_DURATION_SEC)}
          </span>

          {/* Speed Toggle */}
          <div className="hidden sm:flex items-center space-x-0.5 bg-gov-surface-light dark:bg-gov-surface rounded p-0.5 border border-gov-border/20 text-[10px] font-mono">
            {[0.5, 1, 2].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onSpeedChange(spd)}
                className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                  playbackSpeed === spd
                    ? 'bg-gov-amber text-gov-surface font-bold'
                    : 'text-gov-bg/60 dark:text-cream/60 hover:text-gov-bg dark:hover:text-cream'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Loop Toggle */}
          <button
            type="button"
            onClick={onToggleLoop}
            title={isLooping ? 'Auto-looping ON' : 'Looping OFF'}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isLooping
                ? 'text-gov-amber bg-gov-amber/15'
                : 'text-gov-bg/40 dark:text-cream/40 hover:text-gov-bg dark:hover:text-cream'
            }`}
          >
            <span className="material-symbols-outlined text-base">repeat</span>
          </button>
        </div>
      </div>

      {/* 2. CONTINUOUS TIME SCRUBBER SLIDER */}
      <div className="relative mb-2.5 flex items-center">
        <input
          type="range"
          min="0"
          max={ANIMATION_DURATION_SEC}
          step="0.05"
          value={currentTime}
          onChange={(e) => onTimeChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-gov-bg/15 dark:bg-gov-bg-light/15 rounded-lg appearance-none cursor-pointer accent-gov-amber focus:outline-none"
        />
      </div>

      {/* 3. SIX STORYBOARD STAGE CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 overflow-x-auto">
        {ANIMATION_STAGES.map((stage) => {
          const isActive = currentStage.id === stage.id;
          const isPast = currentTime > stage.endTime;
          const stageDuration = stage.endTime - stage.startTime;
          const progressPercent = isActive
            ? ((currentTime - stage.startTime) / stageDuration) * 100
            : isPast
            ? 100
            : 0;

          return (
            <StageCard
              key={stage.id}
              stage={stage}
              isActive={isActive}
              isPast={isPast}
              progressPercent={progressPercent}
              onClick={(stg) => onTimeChange(stg.startTime + 0.1)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default StoryboardScrubber;
