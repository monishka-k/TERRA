export interface AllocationWarningsProps {
  warnings: string[];
  title?: React.ReactNode;
  className?: string;
  classNames?: {
    root?: string;
    title?: string;
    list?: string;
  };
}

/** Solver caveats — group splits and unsatisfiable demand — kept next to the result, not buried. */
export const AllocationWarnings = ({
  warnings,
  title = 'Solver notes',
  className = '',
  classNames = {},
}: AllocationWarningsProps) => {
  if (warnings.length === 0) return null;

  return (
    <div
      className={[
        'flex flex-col gap-1 rounded-lg border border-warning/35 bg-warning/5 px-3 py-2',
        classNames.root ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={['text-[10px] font-semibold uppercase tracking-wide text-warning', classNames.title ?? ''].join(' ')}
      >
        {title}
      </span>
      <ul className={['flex flex-col gap-0.5', classNames.list ?? ''].join(' ')}>
        {warnings.map((warning) => (
          <li key={warning} className="text-[10px] leading-snug text-ink-muted">
            · {warning}
          </li>
        ))}
      </ul>
    </div>
  );
};
