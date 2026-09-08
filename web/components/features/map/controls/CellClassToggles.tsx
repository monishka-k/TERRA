'use client';

import { Toggle } from '@/components/ui/Toggle';

export interface CellClassTogglesProps {
  showHardZero: boolean;
  showNoCoverage: boolean;
  onShowHardZeroChange?: (show: boolean) => void;
  onShowNoCoverageChange?: (show: boolean) => void;
  className?: string;
}

/** Shows or hides the two zero-score classes independently of the ramp. */
export const CellClassToggles = ({
  showHardZero,
  showNoCoverage,
  onShowHardZeroChange,
  onShowNoCoverageChange,
  className = '',
}: CellClassTogglesProps) => (
  <div className={['flex flex-col gap-2.5', className].filter(Boolean).join(' ')}>
    <Toggle
      label="Safe by terrain"
      description="HAND > 30 m or slope > 15° (FR-3.17)"
      checked={showHardZero}
      onCheckedChange={onShowHardZeroChange}
    />
    <Toggle
      label="No-data cells"
      description="Outlined, never filled"
      checked={showNoCoverage}
      onCheckedChange={onShowNoCoverageChange}
    />
  </div>
);
