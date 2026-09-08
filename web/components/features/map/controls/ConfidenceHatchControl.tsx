'use client';

import { Slider } from '@/components/ui/Slider';
import { Toggle } from '@/components/ui/Toggle';

export interface ConfidenceHatchControlProps {
  enabled: boolean;
  /** Cut applied to normalised confidence, not to the raw value. */
  threshold: number;
  onEnabledChange?: (enabled: boolean) => void;
  onThresholdChange?: (threshold: number) => void;
  className?: string;
  classNames?: {
    root?: string;
    toggle?: string;
    slider?: string;
  };
}

/**
 * Toggles the FR-9.3 confidence hatch and sets its cut.
 *
 * The threshold applies to *normalised* confidence. An absolute cut would be useless here:
 * raw confidence on the flood layer never exceeds 0.167, so any threshold above that would
 * hatch every cell and any below it would hatch none.
 */
export const ConfidenceHatchControl = ({
  enabled,
  threshold,
  onEnabledChange,
  onThresholdChange,
  className = '',
  classNames = {},
}: ConfidenceHatchControlProps) => (
  <div
    className={['flex flex-col gap-2.5', classNames.root ?? '', className].filter(Boolean).join(' ')}
  >
    <Toggle
      label="Confidence hatch"
      description="Marks provisional cells (FR-9.3)"
      checked={enabled}
      onCheckedChange={onEnabledChange}
      className={classNames.toggle}
    />
    <Slider
      label="Hatch below"
      value={threshold}
      min={0}
      max={1}
      step={0.05}
      disabled={!enabled}
      formatValue={(v) => v.toFixed(2)}
      description="Normalised against the layer's confidence ceiling."
      onValueChange={onThresholdChange}
      className={classNames.slider}
    />
  </div>
);
