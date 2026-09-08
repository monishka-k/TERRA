'use client';

import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/common/SectionHeader';
import type { HazardLayerSummary, HazardType } from '@/lib/api/types';
import { HAZARD_LABELS } from '@/lib/map/constants';
import { formatCount } from '@/lib/map/format';

export interface HazardLayerSelectProps {
  layers: HazardLayerSummary[];
  value: HazardType;
  title?: string;
  isLoading?: boolean;
  onValueChange?: (hazardType: HazardType) => void;
  className?: string;
  classNames?: {
    root?: string;
    list?: string;
    option?: string;
  };
}

/** Picks which published `hazard_static` layer the map renders. */
export const HazardLayerSelect = ({
  layers,
  value,
  title = 'Hazard layer',
  isLoading = false,
  onValueChange,
  className = '',
  classNames = {},
}: HazardLayerSelectProps) => {
  // One row per hazard type; the map always requests the published source resolution.
  const uniqueLayers = layers.filter(
    (layer, index, all) => all.findIndex((l) => l.hazard_type === layer.hazard_type) === index,
  );

  return (
    <div className={['flex flex-col gap-2', classNames.root ?? '', className].filter(Boolean).join(' ')}>
      <SectionHeader title={title} />
      <div className={['flex flex-col gap-1', classNames.list ?? ''].join(' ')}>
        {isLoading && uniqueLayers.length === 0 ? (
          <div className="h-7 animate-pulse rounded-md bg-surface-2" />
        ) : null}
        {uniqueLayers.map((layer) => (
          <Button
            key={layer.hazard_type}
            size="sm"
            variant="ghost"
            fullWidth
            isActive={layer.hazard_type === value}
            onClick={() => onValueChange?.(layer.hazard_type)}
            className={['justify-between !px-2', classNames.option ?? ''].join(' ')}
            rightIcon={
              <span className="font-mono text-[10px] text-ink-faint">
                {formatCount(layer.cell_count)}
              </span>
            }
          >
            {HAZARD_LABELS[layer.hazard_type] ?? layer.hazard_type}
          </Button>
        ))}
      </div>
    </div>
  );
};
