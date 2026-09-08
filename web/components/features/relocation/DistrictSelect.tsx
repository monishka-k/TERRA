'use client';

import { SegmentedControl } from '@/components/ui';
import type { HabitationListItem } from '@/lib/api/types';

export interface DistrictOption {
  id: number;
  name: string;
}

export interface DistrictSelectProps {
  options: DistrictOption[];
  value: number | null;
  onValueChange?: (adminId: number) => void;
  label?: React.ReactNode;
  className?: string;
}

/** District scope for the queue and the solver. */
export const DistrictSelect = ({
  options,
  value,
  onValueChange,
  label = 'District',
  className = '',
}: DistrictSelectProps) => {
  if (options.length === 0) return null;

  return (
    <SegmentedControl<number>
      label={label}
      options={options.map((option) => ({ value: option.id, label: option.name }))}
      value={value ?? options[0].id}
      onValueChange={(next) => onValueChange?.(next)}
      className={className}
    />
  );
};

/** Derives the district list from a loaded queue — the API exposes no districts endpoint. */
export function deriveDistricts(habitations: HabitationListItem[]): DistrictOption[] {
  const seen = new Map<number, string>();
  for (const habitation of habitations) {
    if (habitation.admin_id != null && !seen.has(habitation.admin_id)) {
      seen.set(habitation.admin_id, habitation.admin_name ?? `District ${habitation.admin_id}`);
    }
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}
