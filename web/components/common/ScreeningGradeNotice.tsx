import type { ReactNode } from 'react';

export interface ScreeningGradeNoticeProps {
  /** Notice text; defaults to the API's `screening_grade` string when passed through. */
  notice?: ReactNode;
  className?: string;
  classNames?: {
    root?: string;
    label?: string;
    text?: string;
  };
}

const DEFAULT_NOTICE =
  'Screening Grade: Cell-level screening and prioritisation tool. Geotechnical investigation, hydraulic study, and community consultation required before executing relocation orders.';

/**
 * Persistent screening-grade label (FR-10.8, NFR-8).
 *
 * Required on every output surface — the scores rank cells for investigation, they do not
 * authorise a relocation order.
 */
export const ScreeningGradeNotice = ({
  notice = DEFAULT_NOTICE,
  className = '',
  classNames = {},
}: ScreeningGradeNoticeProps) => (
  <div
    className={[
      'flex items-start gap-2 border-t border-line bg-surface-0 px-3 py-1.5',
      classNames.root ?? '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <span
      className={[
        'mt-px shrink-0 rounded-sm border border-warning/50 bg-warning/12 px-1 text-[9px] font-semibold uppercase tracking-wider text-warning',
        classNames.label ?? '',
      ].join(' ')}
    >
      Screening
    </span>
    <p className={['text-[10px] leading-snug text-ink-faint', classNames.text ?? ''].join(' ')}>
      {notice}
    </p>
  </div>
);
