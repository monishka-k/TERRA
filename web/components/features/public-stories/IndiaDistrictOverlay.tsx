'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type { ZoneId } from './storyData';
import { DISTRICT_BOUNDARIES } from './districtBoundaries';

export interface IndiaDistrictOverlayProps {
  /** Currently pinned / selected story zone */
  selectedZone: ZoneId;
  /** Currently hovered story zone for preview (null if not hovering) */
  hoveredZone?: ZoneId | null;
  /** Callback triggered when user hovers over a district */
  onHoverZone?: (zone: ZoneId | null) => void;
  /** Callback triggered when user clicks to pin a district */
  onSelectZone: (zone: ZoneId) => void;
  /** Image URL to display inside the active district boundary */
  previewImage: string;
  /** Optional root className for SVG group */
  className?: string;
}

/**
 * Renders the 5 story administrative district outlines across India.
 *
 * Implements Option 1: Scaled Floating District Silhouette Callouts.
 * - 1:1 ground district boundaries on the national map act as interactive anchor nodes.
 * - Active districts project an enlarged (180-220px) floating silhouette callout.
 * - Photographs are clipped inside the authentic district SVG path with cover-fit.
 * - Elegant cartographic guide rays connect the ground location to the elevated callout.
 */
export const IndiaDistrictOverlay: React.FC<IndiaDistrictOverlayProps> = ({
  selectedZone,
  hoveredZone = null,
  onHoverZone,
  onSelectZone,
  previewImage,
  className = '',
}) => {
  const containerRef = useRef<SVGGElement>(null);
  const rayLineRef = useRef<SVGLineElement>(null);
  const focalDotRef = useRef<SVGCircleElement>(null);
  const focalPingRef = useRef<SVGCircleElement>(null);
  const isInitializedRef = useRef(false);

  const displayedZone = hoveredZone ?? selectedZone;
  const activeDistrict = DISTRICT_BOUNDARIES[displayedZone];

  useGSAP(
    () => {
      if (!containerRef.current || !activeDistrict) return;

      // Soft photographic focus entrance for the elevated callout silhouette
      gsap.fromTo(
        '.district-callout-group',
        { opacity: 0, scale: 0.96, transformOrigin: 'center' },
        { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' },
      );

      // On first mount, set ray and beacon position immediately
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        if (rayLineRef.current) {
          gsap.set(rayLineRef.current, {
            attr: {
              x1: activeDistrict.center.x,
              y1: activeDistrict.center.y,
              x2: activeDistrict.callout.center.x,
              y2: activeDistrict.callout.center.y,
            },
            opacity: 0.75,
          });
        }
        if (focalDotRef.current && focalPingRef.current) {
          gsap.set([focalDotRef.current, focalPingRef.current], {
            attr: {
              cx: activeDistrict.center.x,
              cy: activeDistrict.center.y,
            },
          });
        }
        return;
      }

      // Smoothly sweep the cartographic ray to the new ground and callout coordinates
      if (rayLineRef.current) {
        gsap.to(rayLineRef.current, {
          attr: {
            x1: activeDistrict.center.x,
            y1: activeDistrict.center.y,
            x2: activeDistrict.callout.center.x,
            y2: activeDistrict.callout.center.y,
          },
          opacity: 0.75,
          duration: 0.45,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      }

      // Smoothly slide the ground focal beacon
      if (focalDotRef.current && focalPingRef.current) {
        gsap.to([focalDotRef.current, focalPingRef.current], {
          attr: {
            cx: activeDistrict.center.x,
            cy: activeDistrict.center.y,
          },
          duration: 0.45,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      }
    },
    { scope: containerRef, dependencies: [displayedZone] },
  );

  return (
    <g ref={containerRef} className={`district-overlay-group ${className}`}>
      <defs>
        {/* District polygon clipPaths for photographic image masking */}
        {(Object.keys(DISTRICT_BOUNDARIES) as ZoneId[]).map((zone) => {
          const district = DISTRICT_BOUNDARIES[zone];
          return (
            <clipPath key={district.zone} id={`clip-district-${district.zone}`}>
              <path d={district.d} />
            </clipPath>
          );
        })}

        {/* Elevated callout depth shadow to lift the silhouette above the map */}
        <filter id="calloutElevatedShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="0"
            dy="8"
            stdDeviation="10"
            floodColor="#000000"
            floodOpacity="0.45"
          />
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="3"
            floodColor="#000000"
            floodOpacity="0.25"
          />
        </filter>
      </defs>

      {/* Layer 1: Ground 1:1 District Outlines & Interactive Hit Areas on India Map */}
      {(Object.keys(DISTRICT_BOUNDARIES) as ZoneId[]).map((zone) => {
        const district = DISTRICT_BOUNDARIES[zone];
        const isSelected = zone === selectedZone;
        const isDisplayed = zone === displayedZone;

        return (
          <g
            key={district.zone}
            className="cursor-pointer group"
            onClick={() => onSelectZone(district.zone)}
            onMouseEnter={() => onHoverZone?.(district.zone)}
            onMouseLeave={() => onHoverZone?.(null)}
          >
            {/* Expanded transparent hit area */}
            <path
              d={district.d}
              fill="transparent"
              stroke="transparent"
              strokeWidth="12"
              strokeLinejoin="round"
            />

            {/* Visual boundary polygon on national map */}
            <path
              d={district.d}
              className={`transition-all duration-300 ${isDisplayed
                  ? 'fill-[#16a34a]/30 dark:fill-[#fef08a]/25 stroke-[#16a34a] dark:stroke-[#fef08a]'
                  : 'fill-[#16a34a]/10 dark:fill-[#fef08a]/10 hover:fill-[#16a34a]/25 dark:hover:fill-[#fef08a]/20 stroke-[#2d6a4f]/40 dark:stroke-[#fef08a]/35 hover:stroke-[#16a34a] dark:hover:stroke-[#fef08a]'
                }`}
              strokeWidth={isDisplayed ? 1.8 : 1.2}
              strokeDasharray={isDisplayed ? undefined : isSelected ? undefined : '2 2'}
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {/* Layer 2: Cartographic Guide Rays (Ground Location -> Elevated Callout) */}
      <g className="cartographic-rays-group pointer-events-none">
        {/* Dashed connector line from ground district center to elevated callout */}
        <line
          ref={rayLineRef}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeDasharray="4 3"
          style={{ opacity: 0 }}
          className="cartographic-ray text-[#16a34a] dark:text-[#fef08a] transition-colors duration-300"
        />

        {/* Glowing ground focal ring */}
        <circle
          ref={focalDotRef}
          r="4"
          className="fill-[#16a34a] dark:fill-[#fef08a] transition-colors duration-300"
        />
        <circle
          ref={focalPingRef}
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="2 2"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          className="text-[#16a34a] dark:text-[#fef08a] opacity-70 animate-ping"
        />
      </g>

      {/* Layer 3: Scaled Floating District Silhouette Callout (180-220px) */}
      {activeDistrict && (
        <g
          key={`callout-${displayedZone}`}
          className="district-callout-group transition-all duration-300"
          filter="url(#calloutElevatedShadow)"
          onMouseEnter={() => onHoverZone?.(activeDistrict.zone)}
          onMouseLeave={() => onHoverZone?.(null)}
        >
          {/* Matrix transformation: center the enlarged silhouette at callout.center */}
          <g
            transform={`translate(${activeDistrict.callout.center.x}, ${activeDistrict.callout.center.y}) scale(${activeDistrict.callout.scale}) translate(${-activeDistrict.center.x}, ${-activeDistrict.center.y})`}
          >
            {/* 1. Clipped High-Resolution Photographic Image */}
            <g clipPath={`url(#clip-district-${displayedZone})`}>
              <image
                href={previewImage}
                x={activeDistrict.bbox.x}
                y={activeDistrict.bbox.y}
                width={activeDistrict.bbox.width}
                height={activeDistrict.bbox.height}
                preserveAspectRatio="xMidYMid slice"
                className="opacity-95 contrast-105 saturate-110 filter"
              />
            </g>

            {/* 2. Soft Ambient Edge Halo */}
            <path
              d={activeDistrict.d}
              fill="none"
              stroke="currentColor"
              vectorEffect="non-scaling-stroke"
              strokeWidth="5"
              strokeLinejoin="round"
              className="text-[#16a34a]/30 dark:text-[#fef08a]/35 pointer-events-none"
            />

            {/* 3. Sharp Focused Perimeter Stroke */}
            <path
              d={activeDistrict.d}
              fill="none"
              stroke="currentColor"
              vectorEffect="non-scaling-stroke"
              strokeWidth="2.4"
              strokeLinejoin="round"
              className="text-[#16a34a] dark:text-[#fef08a] pointer-events-none"
            />

            {/* 4. Clickable hit area on enlarged silhouette to pin */}
            <path
              d={activeDistrict.d}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => onSelectZone(activeDistrict.zone)}
            />
          </g>

          {/* Administrative District & State Label Tag */}
          <g
            transform={`translate(${activeDistrict.callout.center.x}, ${activeDistrict.callout.center.y + (activeDistrict.bbox.height * activeDistrict.callout.scale) / 2 + 18})`}
            className="pointer-events-none"
          >
            <rect
              x="-65"
              y="-11"
              width="130"
              height="22"
              rx="11"
              className="fill-bg-base/90 dark:fill-[#0c2219]/90 stroke-line-strong dark:stroke-white/15"
              strokeWidth="1"
            />
            <text
              x="0"
              y="3"
              textAnchor="middle"
              className="text-[10px] font-mono font-medium fill-[#2d6a4f] dark:fill-[#fef08a] tracking-wider uppercase"
            >
              {activeDistrict.districtName}
            </text>
          </g>
        </g>
      )}
    </g>
  );
};

export default IndiaDistrictOverlay;
