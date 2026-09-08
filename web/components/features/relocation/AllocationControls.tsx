'use client';

import { Button, SegmentedControl, Slider, Toggle } from '@/components/ui';
import type { Tier } from '@/lib/api/types';

import { TIER_LABELS } from './constants';

export interface AllocationSettings {
  maxSearchRadiusKm: number;
  targetTier: Tier;
  allowGroupSplits: boolean;
  distancePenaltyWeight: number;
}

export interface AllocationControlsProps {
  settings: AllocationSettings;
  onSettingsChange: (settings: AllocationSettings) => void;
  onSolve: () => void;
  isSolving?: boolean;
  disabled?: boolean;
  /** Tiers offered in the picker. */
  tiers?: Tier[];
  solveLabel?: React.ReactNode;
  className?: string;
  classNames?: {
    root?: string;
    field?: string;
    action?: string;
  };
}

/**
 * Solver parameters and the run trigger.
 *
 * Running is an explicit action, never a live re-solve on slider input: each run persists an
 * audited `allocation_run`, so it happens when an official asks for it and not before.
 */
export const AllocationControls = ({
  settings,
  onSettingsChange,
  onSolve,
  isSolving = false,
  disabled = false,
  tiers = ['immediate', 'short_term', 'medium_term'],
  solveLabel = 'Run allocation',
  className = '',
  classNames = {},
}: AllocationControlsProps) => {
  const update = <K extends keyof AllocationSettings>(key: K, value: AllocationSettings[K]) =>
    onSettingsChange({ ...settings, [key]: value });

  return (
    <div
      className={['flex flex-col gap-4', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      <SegmentedControl<Tier>
        label="Target tier"
        options={tiers.map((tier) => ({ value: tier, label: TIER_LABELS[tier] }))}
        value={settings.targetTier}
        onValueChange={(tier) => update('targetTier', tier)}
        className={classNames.field}
      />

      <Slider
        label="Search radius"
        value={settings.maxSearchRadiusKm}
        min={1}
        max={50}
        step={1}
        formatValue={(value) => `${value} km`}
        description="Maximum distance a household may be relocated from its origin."
        disabled={disabled}
        onValueChange={(value) => update('maxSearchRadiusKm', value)}
        className={classNames.field}
      />

      <Slider
        label="Distance penalty"
        value={settings.distancePenaltyWeight}
        min={0}
        max={5}
        step={0.5}
        formatValue={(value) => value.toFixed(1)}
        description="How strongly the solver prefers nearer sites over higher-suitability ones."
        disabled={disabled}
        onValueChange={(value) => update('distancePenaltyWeight', value)}
        className={classNames.field}
      />

      <Toggle
        label="Allow group splits"
        description="Permits one habitation's households to be divided across several sites."
        checked={settings.allowGroupSplits}
        disabled={disabled}
        onCheckedChange={(checked) => update('allowGroupSplits', checked)}
        className={classNames.field}
      />

      <Button
        variant="primary"
        fullWidth
        disabled={disabled || isSolving}
        onClick={onSolve}
        className={classNames.action}
      >
        {isSolving ? 'Solving…' : solveLabel}
      </Button>
    </div>
  );
};
