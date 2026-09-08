'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ZoneId, REGIONAL_STORIES } from './storyData';
import { StoryDiscoverBadge } from './StoryDiscoverBadge';
import {
  HOTSPOT_LONLAT,
  INDIA_OUTLINE_PATHS,
  INDIA_VIEWBOX,
  projectLonLat,
} from './indiaOutline';
import { IndiaHotspotMarkers } from './IndiaHotspotMarkers';
import { IndiaDistrictOverlay } from './IndiaDistrictOverlay';
import { DISTRICT_BOUNDARIES } from './districtBoundaries';

export interface IndiaStoriesMapProps {
  /** Currently selected / pinned zone */
  selectedZone: ZoneId;
  /** Callback when user selects or pins a zone */
  onSelectZone: (zone: ZoneId) => void;
  /** Callback to trigger the slideshow for the active zone */
  onOpenSlideshow: (zone: ZoneId) => void;
  /** Custom root className */
  className?: string;
}

/**
 * Interactive India map rendered from the real Natural Earth 50m
 * national outline (mercator-fit to 800x900) with true administrative district
 * boundary focus cutouts.
 *
 * - Hovering over a district or marker previews its boundary and clipped cover photo.
 * - Clicking pins the zone as the active story hotspot.
 * - Cover-fit photographic imagery is rendered within each district's organic shape.
 */
export const IndiaStoriesMap: React.FC<IndiaStoriesMapProps> = ({
  selectedZone,
  onSelectZone,
  onOpenSlideshow,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeGroupRef = useRef<SVGGElement>(null);
  const leaderLineRef = useRef<SVGLineElement>(null);
  const isInitializedRef = useRef(false);

  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [hoveredZone, setHoveredZone] = useState<ZoneId | null>(null);

  const displayedZone = hoveredZone ?? selectedZone;
  const activeStory = REGIONAL_STORIES[displayedZone];
  const activeDistrict = DISTRICT_BOUNDARIES[displayedZone];

  const hotspots = useMemo(
    () =>
      (Object.keys(HOTSPOT_LONLAT) as ZoneId[]).map((zone) => {
        const { lon, lat, label } = HOTSPOT_LONLAT[zone];
        const { x, y } = projectLonLat(lon, lat);
        return { zone, label, cx: x, cy: y };
      }),
    [],
  );

  // Hover controller with 50ms intent delay and 250ms exit grace period
  const handleHoverZone = (zone: ZoneId | null) => {
    if (zone !== null) {
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
      if (hoveredZone === zone) return;

      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        setHoveredZone(zone);
      }, 50);
    } else {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = setTimeout(() => {
        setHoveredZone(null);
      }, 250);
    }
  };

  const handleSelectZone = (zone: ZoneId) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    onSelectZone(zone);
    setHoveredZone(null);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  // Hotspot pulse animation
  useGSAP(() => {
    if (!containerRef.current) return;
    gsap.fromTo(
      '.hotspot-pulse',
      { scale: 0.8, opacity: 0.8, transformOrigin: '50% 50%' },
      {
        scale: 1.8,
        opacity: 0,
        transformOrigin: '50% 50%',
        duration: 2,
        repeat: -1,
        ease: 'power1.out',
        stagger: 0.4,
      },
    );
  }, { scope: containerRef, dependencies: [displayedZone], revertOnUpdate: true });

  // Smooth continuous GSAP glide motion for the "+ DISCOVER STORIES" badge and leader line
  useGSAP(
    () => {
      if (!badgeGroupRef.current || !leaderLineRef.current || !activeDistrict) return;

      const targetBadgeX = activeDistrict.callout.badge.x;
      const targetBadgeY = activeDistrict.callout.badge.y;
      const targetCenterX = activeDistrict.callout.center.x;
      const targetCenterY = activeDistrict.callout.center.y;

      // On first mount, position immediately without animation
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        gsap.set(badgeGroupRef.current, {
          x: targetBadgeX,
          y: targetBadgeY,
          opacity: 1,
        });
        gsap.set(leaderLineRef.current, {
          attr: {
            x1: targetBadgeX,
            y1: targetBadgeY,
            x2: targetCenterX,
            y2: targetCenterY,
          },
          opacity: 0.65,
        });
        return;
      }

      // Smoothly glide the badge to the target coordinates
      gsap.to(badgeGroupRef.current, {
        x: targetBadgeX,
        y: targetBadgeY,
        opacity: 1,
        duration: 0.45,
        ease: 'power3.out',
        overwrite: 'auto',
      });

      // Smoothly tween the leader line coordinates
      gsap.to(leaderLineRef.current, {
        attr: {
          x1: targetBadgeX,
          y1: targetBadgeY,
          x2: targetCenterX,
          y2: targetCenterY,
        },
        opacity: 0.65,
        duration: 0.45,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    },
    { dependencies: [displayedZone] },
  );

  return (
    <div
      ref={containerRef}
      onMouseLeave={() => handleHoverZone(null)}
      className={`relative w-full h-full flex items-center justify-center select-none ${className}`}
    >
      <svg
        viewBox={INDIA_VIEWBOX}
        className="w-full h-full max-h-[88vh] object-contain drop-shadow-lg dark:drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" className="text-[#95b8a6] dark:text-[#22543d]" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" className="text-[#edf3ef] dark:text-[#0d231a]" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="400" cy="460" r="380" fill="url(#mapGlow)" />

        {/* --- TRUE INDIA NATIONAL OUTLINE (Natural Earth 50m) --- */}
        {INDIA_OUTLINE_PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            className="fill-[#cfe0d5] dark:fill-[#132b21] stroke-[#2d6a4f] dark:stroke-[#fef08a] transition-colors duration-300"
            fillOpacity="0.9"
            strokeOpacity="0.5"
            strokeWidth={i === 0 ? 1.6 : 1}
            strokeLinejoin="round"
          />
        ))}

        {/* --- ADMINISTRATIVE DISTRICT BOUNDARIES & CLIPPED PHOTOGRAPHIC FOCUS --- */}
        <IndiaDistrictOverlay
          selectedZone={selectedZone}
          hoveredZone={hoveredZone}
          onHoverZone={handleHoverZone}
          onSelectZone={handleSelectZone}
          previewImage={activeStory.previewImage}
        />

        {/* --- CARTOGRAPHIC LEADER LINE FROM BADGE TO CALLOUT SILHOUETTE --- */}
        <line
          ref={leaderLineRef}
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="3 3"
          style={{ opacity: 0 }}
          className="text-[#16a34a] dark:text-[#fef08a] pointer-events-none transition-colors duration-300"
        />

        {/* --- HOTSPOT MARKERS --- */}
        <IndiaHotspotMarkers
          hotspots={hotspots}
          selectedZone={selectedZone}
          hoveredZone={hoveredZone}
          onSelectZone={handleSelectZone}
          onHoverZone={handleHoverZone}
        />

        {/* --- FLOATING "+ DISCOVER STORIES" BADGE IN MAP COORDINATE SPACE --- */}
        <g
          ref={badgeGroupRef}
          style={{ opacity: 0 }}
          className="pointer-events-auto"
          onMouseEnter={() => handleHoverZone(displayedZone)}
          onMouseLeave={() => handleHoverZone(null)}
        >
          <foreignObject
            x="-45"
            y="-45"
            width="90"
            height="90"
            className="overflow-visible pointer-events-auto"
          >
            <div className="w-full h-full flex items-center justify-center">
              <StoryDiscoverBadge
                onClick={() => onOpenSlideshow(displayedZone)}
                size={84}
              />
            </div>
          </foreignObject>
        </g>
      </svg>
    </div>
  );
};

export default IndiaStoriesMap;


