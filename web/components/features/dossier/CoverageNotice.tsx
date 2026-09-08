import type { CoverageFlag } from '@/lib/api/types';
import { COVERAGE_DESCRIPTIONS } from '@/lib/map/constants';

export interface CoverageNoticeProps {
  flag: CoverageFlag;
  className?: string;
  classNames?: {
    root?: string;
    text?: string;
  };
}

const VARIANT_CLASSES: Record<CoverageFlag, string> = {
  full: 'border-safe/35 bg-safe/8 text-ink-muted',
  low_coverage: 'border-warning/40 bg-warning/10 text-warning',
  no_coverage: 'border-ink-faint/50 bg-surface-2 text-ink-muted',
};

/**
 * Inline provenance warning on the dossier.
 *
 * Suppressed for fully-measured cells — a banner on every cell would be ignored by the
 * time it appeared on one that mattered.
 */
export const CoverageNotice = ({ flag, className = '', classNames = {} }: CoverageNoticeProps) => {
  if (flag === 'full') return null;

  return (
    <div
      className={[
        'rounded-md border px-2.5 py-2',
        VARIANT_CLASSES[flag],
        classNames.root ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className={['text-[10px] leading-snug', classNames.text ?? ''].join(' ')}>
        {COVERAGE_DESCRIPTIONS[flag]}
      </p>
    </div>
  );
};
