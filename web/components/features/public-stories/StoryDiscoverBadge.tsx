'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface StoryDiscoverBadgeProps {
  /** Callback when user clicks the discover badge */
  onClick: () => void;
  /** Custom root className */
  className?: string;
  /** Size in pixels (default 80) */
  size?: number;
}

export const StoryDiscoverBadge: React.FC<StoryDiscoverBadgeProps> = ({
  onClick,
  className = '',
  size = 84,
}) => {
  const containerRef = useRef<HTMLButtonElement>(null);
  const textRingRef = useRef<SVGSVGElement>(null);

  useGSAP(() => {
    if (!textRingRef.current) return;
    gsap.to(textRingRef.current, {
      rotation: 360,
      duration: 22,
      repeat: -1,
      ease: 'none',
      transformOrigin: '50% 50%',
    });
  }, { scope: containerRef });

  return (
    <button
      ref={containerRef}
      type="button"
      onClick={onClick}
      className={`group relative flex items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-110 active:scale-95 focus:outline-none ${className}`}
      style={{ width: size, height: size }}
      aria-label="Discover Stories"
    >
      {/* Outer Rotating Circular Text */}
      <svg
        ref={textRingRef}
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-md select-none"
      >
        <path
          id="discoverTextPath"
          d="M 50,50 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0"
          fill="none"
        />
        <text
          fontSize="9.2"
          letterSpacing="0.28em"
          fill="currentColor"
          fontWeight="600"
          className="font-mono uppercase opacity-95 text-[#2d6a4f] dark:text-[#fef08a]"
        >
          <textPath href="#discoverTextPath" startOffset="0%">
            + DISCOVER STORIES +
          </textPath>
        </text>
      </svg>

      {/* Central Tactile Ivory Pill with + */}
      <div className="w-10 h-10 rounded-full bg-[#fde68a] text-[#162a21] shadow-lg flex items-center justify-center font-bold text-xl transition-all duration-300 group-hover:bg-white group-hover:shadow-[0_0_20px_rgba(253,230,138,0.7)]">
        <span className="leading-none transition-transform duration-300 group-hover:rotate-90">
          +
        </span>
      </div>
    </button>
  );
};

export default StoryDiscoverBadge;
