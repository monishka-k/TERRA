'use client';

import { Slider } from '@/components/ui/Slider';

export interface LayerOpacitySliderProps {
  value: number;
  label?: string;
  onValueChange?: (value: number) => void;
  className?: string;
}

/** Fades the hazard fill so basemap context can be read underneath. */
export const LayerOpacitySlider = ({
  value,
  label = 'Layer opacity',
  onValueChange,
  className = '',
}: LayerOpacitySliderProps) => (
  <Slider
    label={label}
    value={value}
    min={0.15}
    max={1}
    step={0.05}
    formatValue={(v) => `${Math.round(v * 100)}%`}
    onValueChange={onValueChange}
    className={className}
  />
);
