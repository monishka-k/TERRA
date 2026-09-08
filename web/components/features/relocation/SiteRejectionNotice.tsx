export interface SiteRejectionNoticeProps {
  /** Policy reasons the site cannot receive an allocation. */
  reasons: string[];
  eligibilityStatus?: string;
  className?: string;
  classNames?: {
    root?: string;
    title?: string;
    list?: string;
  };
}

/**
 * Why a screened site is not allocatable.
 *
 * Rejected sites stay visible with their reasons rather than disappearing — an official needs
 * to know a nearby site was considered and excluded, and on what ground.
 */
export const SiteRejectionNotice = ({
  reasons,
  eligibilityStatus,
  className = '',
  classNames = {},
}: SiteRejectionNoticeProps) => {
  if (reasons.length === 0) return null;

  const unverified = eligibilityStatus === 'unknown';

  return (
    <div
      className={[
        'flex flex-col gap-1 rounded-lg border px-3 py-2',
        unverified ? 'border-warning/35 bg-warning/5' : 'border-critical/35 bg-critical/5',
        classNames.root ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={[
          'text-[10px] font-semibold uppercase tracking-wide',
          unverified ? 'text-warning' : 'text-critical',
          classNames.title ?? '',
        ].join(' ')}
      >
        {unverified ? 'Not allocatable — unverified' : 'Not allocatable — excluded'}
      </span>
      <ul className={['flex flex-col gap-0.5', classNames.list ?? ''].join(' ')}>
        {reasons.map((reason) => (
          <li key={reason} className="text-[10px] leading-snug text-ink-muted">
            · {reason}
          </li>
        ))}
      </ul>
    </div>
  );
};
