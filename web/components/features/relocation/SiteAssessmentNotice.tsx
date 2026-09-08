import type { CandidateSiteItem } from '@/lib/api/types';

export interface SiteAssessmentNoticeProps {
  sites: CandidateSiteItem[];
  className?: string;
  classNames?: {
    root?: string;
    text?: string;
  };
}

/**
 * States how far the listed sites have actually been assessed.
 *
 * Derived from each site's `assessment_status` rather than asserted, so the notice cannot drift
 * from the data: a screening-only site has had no geotechnical or hydraulic investigation, and
 * its capacity figures are norm-derived rather than observed.
 */
export const SiteAssessmentNotice = ({
  sites,
  className = '',
  classNames = {},
}: SiteAssessmentNoticeProps) => {
  if (sites.length === 0) return null;

  const partial = sites.filter((site) => site.assessment_status !== 'fully_assessed');
  if (partial.length === 0) return null;

  return (
    <div
      className={[
        'rounded-lg border border-line/60 bg-surface-1/40 px-3 py-2',
        classNames.root ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className={['text-[10px] leading-snug text-ink-muted', classNames.text ?? ''].join(' ')}>
        <span className="font-semibold text-ink">
          {partial.length} of {sites.length} sites
        </span>{' '}
        are not fully assessed. Their capacity figures are derived from policy norms, not from
        measured yield or surveyed infrastructure.
      </p>
    </div>
  );
};
