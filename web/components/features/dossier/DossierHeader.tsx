'use client';

import { Badge } from '@/components/ui/Badge';
import { CoverageStatusPill } from '@/components/common/StatusPill';
import type { HazardCellDetail } from '@/lib/api/types';
import { HAZARD_LABELS } from '@/lib/map/constants';
import { formatH3 } from '@/lib/map/format';

export interface DossierHeaderProps {
  detail: HazardCellDetail;
  className?: string;
  classNames?: {
    root?: string;
    title?: string;
    meta?: string;
    badges?: string;
  };
}

/** Identity block for the selected cell: where it is, what layer, how well observed. */
export const DossierHeader = ({ detail, className = '', classNames = {} }: DossierHeaderProps) => (
  <div className={['flex flex-col gap-2', classNames.root ?? '', className].filter(Boolean).join(' ')}>
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 className={['text-sm font-semibold text-ink', classNames.title ?? ''].join(' ')}>
          {detail.admin_name ?? 'Unassigned district'}
        </h2>
        <p className={['font-mono text-[10px] text-ink-faint', classNames.meta ?? ''].join(' ')}>
          {formatH3(detail.h3)} · R{detail.res} · {detail.centroid[1].toFixed(4)},{' '}
          {detail.centroid[0].toFixed(4)}
        </p>
      </div>
      <CoverageStatusPill flag={detail.quality_flag} showDescription />
    </div>

    <div className={['flex flex-wrap gap-1.5', classNames.badges ?? ''].join(' ')}>
      <Badge variant="info">{HAZARD_LABELS[detail.hazard_type] ?? detail.hazard_type}</Badge>
      {detail.is_permanent_red_candidate ? (
        <Badge variant="critical" title="Susceptibility at or above the FR-3.9 PRZ threshold of 0.85.">
          PRZ candidate
        </Badge>
      ) : null}
      <Badge variant="neutral" title={`Model version ${detail.model_version}`}>
        {detail.model_version}
      </Badge>
    </div>
  </div>
);
