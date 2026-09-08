'use client';

import React from 'react';

export interface HazardTypeItem {
  id: string;
  label: string;
  colorClass: string;
  indicatorColor: string;
}

export const HAZARD_TYPES: HazardTypeItem[] = [
  { id: 'landslide', label: 'LANDSLIDE', colorClass: 'text-gov-red', indicatorColor: '#b9433f' },
  { id: 'flood', label: 'FLOOD', colorClass: 'text-gov-amber', indicatorColor: '#d49a45' },
  { id: 'debris-flow', label: 'DEBRIS FLOW', colorClass: 'text-gov-orange', indicatorColor: '#c96b3b' },
  { id: 'erosion', label: 'EROSION', colorClass: 'text-gov-sage', indicatorColor: '#6f8f72' },
];

export interface HazardTypeLegendProps {
  className?: string;
  onSelectHazard?: (hazardId: string) => void;
}

export const HazardTypeLegend: React.FC<HazardTypeLegendProps> = ({
  className = '',
  onSelectHazard,
}) => {
  return (
    <div className={`space-y-1.5 select-none ${className}`}>
      <span className="text-[10px] font-mono font-bold tracking-widest text-gov-bg/60 dark:text-cream/60 uppercase">
        Hazard Type
      </span>
      <div className="space-y-1 mt-1">
        {HAZARD_TYPES.map((h) => (
          <div
            key={h.id}
            onClick={() => onSelectHazard && onSelectHazard(h.id)}
            className="flex items-center justify-between text-[10px] font-mono hover:bg-gov-bg/5 dark:hover:bg-gov-bg-light/5 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
          >
            <span className="text-gov-bg/80 dark:text-cream/80 font-medium tracking-wider">
              {h.label}
            </span>
            <span
              className="w-4 h-1 rounded-sm shadow-xs"
              style={{ backgroundColor: h.indicatorColor }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default HazardTypeLegend;
