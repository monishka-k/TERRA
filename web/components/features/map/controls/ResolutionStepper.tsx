'use client';

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SOURCE_RESOLUTION, SUPPORTED_RESOLUTIONS } from '@/lib/map/constants';

export interface ResolutionStepperProps {
  value: number;
  label?: string;
  resolutions?: readonly number[];
  onValueChange?: (resolution: number) => void;
  className?: string;
}

/**
 * Switches display resolution.
 *
 * Only resolution 8 is published; coarser levels are `h3.cellToParent` roll-ups computed
 * in the browser, which avoids waiting on the `mhi_res6`/`mhi_res7` Martin views.
 */
export const ResolutionStepper = ({
  value,
  label = 'H3 resolution',
  resolutions = SUPPORTED_RESOLUTIONS,
  onValueChange,
  className = '',
}: ResolutionStepperProps) => (
  <SegmentedControl<number>
    label={label}
    value={value}
    onValueChange={onValueChange}
    className={className}
    options={resolutions.map((res) => ({
      value: res,
      label: `R${res}`,
      title:
        res === SOURCE_RESOLUTION
          ? 'Published resolution — one row per pipeline cell.'
          : `Rolled up from resolution ${SOURCE_RESOLUTION} in the browser (max of children).`,
    }))}
  />
);
