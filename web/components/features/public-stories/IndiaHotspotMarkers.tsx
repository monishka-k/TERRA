'use client';

import React from 'react';
import type { ZoneId } from './storyData';

export interface HotspotPoint {
  /** Story zone this hotspot belongs to */
  zone: ZoneId;
  /** Human-readable hotspot label */
  label: string;
  /** SVG x in the 800x900 viewBox space */
  cx: number;
  /** SVG y in the 800x900 viewBox space */
  cy: number;
}

export interface IndiaHotspotMarkersProps {
  /** Projected hotspot points (from real lon/lat) */
  hotspots: HotspotPoint[];
  /** Currently pinned / selected zone */
  selectedZone: ZoneId;
  /** Currently hovered zone for preview */
  hoveredZone?: ZoneId | null;
  /** Callback when user clicks to pin a zone */
  onSelectZone: (zone: ZoneId) => void;
  /** Callback when user hovers a zone */
  onHoverZone?: (zone: ZoneId | null) => void;
  /** Additional className for the markers group */
  className?: string;
}

/**
 * Interactive hotspot markers (pulsing ring + tactile dot).
 * Positions come from true WGS84 lon/lat via `projectLonLat`,
 * so dots sit on the real geography — not a stylised blob.
 */
export const IndiaHotspotMarkers: React.FC<IndiaHotspotMarkersProps> = ({
  hotspots,
  selectedZone,
  hoveredZone = null,
  onSelectZone,
  onHoverZone,
  className = '',
}) => {
  const displayedZone = hoveredZone ?? selectedZone;

  return (
    <g className={className}>
      {hotspots.map((hotspot) => {
        const isSelected = hotspot.zone === selectedZone;
        const isDisplayed = hotspot.zone === displayedZone;
        return (
          <g
            key={hotspot.zone}
            onClick={() => onSelectZone(hotspot.zone)}
            onMouseEnter={() => onHoverZone?.(hotspot.zone)}
            onMouseLeave={() => onHoverZone?.(null)}
            className="cursor-pointer group"
          >
            {/* Pulsing Outer Ring for active / displayed hotspot */}
            {isDisplayed && (
              <circle
                cx={hotspot.cx}
                cy={hotspot.cy}
                r="18"
                fill="none"
                stroke={isSelected ? '#16a34a' : '#a3e635'}
                className="hotspot-pulse text-[#16a34a] dark:text-[#fef08a]"
                strokeWidth="1.8"
              />
            )}
            {/* Secondary fixed ring for pinned hotspot */}
            {isSelected && (
              <circle
                cx={hotspot.cx}
                cy={hotspot.cy}
                r="10"
                fill="none"
                stroke="currentColor"
                className="text-[#16a34a] dark:text-[#fef08a] opacity-60"
                strokeWidth="1.2"
                strokeDasharray="2 2"
              />
            )}
            {/* Solid Tactile Dot */}
            <circle
              cx={hotspot.cx}
              cy={hotspot.cy}
              r={isDisplayed ? 6.5 : 4.5}
              fill={isSelected ? '#16a34a' : isDisplayed ? '#22c55e' : 'currentColor'}
              className="text-[#2d6a4f] dark:text-[#fef08a] transition-all duration-200 shadow-md"
            />
          </g>
        );
      })}
    </g>
  );
};

export default IndiaHotspotMarkers;
