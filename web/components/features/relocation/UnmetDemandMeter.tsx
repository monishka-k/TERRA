export interface UnmetDemandMeterProps {
  placedHouseholds: number;
  unmetHouseholds: number;
  totalHouseholds: number;
  label?: React.ReactNode;
  className?: string;
  classNames?: {
    root?: string;
    label?: string;
    track?: string;
    placed?: string;
    legend?: string;
  };
}

/**
 * Share of demand the solver could place.
 *
 * The unmet remainder is given equal visual weight to the placed share — a plan that houses
 * two thirds of a village is not a success story told with one number.
 */
export const UnmetDemandMeter = ({
  placedHouseholds,
  unmetHouseholds,
  totalHouseholds,
  label = 'Demand coverage',
  className = '',
  classNames = {},
}: UnmetDemandMeterProps) => {
  const placedFraction = totalHouseholds > 0 ? placedHouseholds / totalHouseholds : 0;

  return (
    <div
      className={['flex flex-col gap-1.5', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={['text-[10px] uppercase tracking-wide text-ink-faint', classNames.label ?? ''].join(' ')}>
          {label}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-ink">
          {(placedFraction * 100).toFixed(1)}%
        </span>
      </div>

      <div className={['flex h-2 w-full overflow-hidden rounded-full bg-critical/30', classNames.track ?? ''].join(' ')}>
        <div
          className={['h-full bg-safe transition-[width] duration-500 ease-out', classNames.placed ?? ''].join(' ')}
          style={{ width: `${placedFraction * 100}%` }}
        />
      </div>

      <div className={['flex justify-between text-[10px]', classNames.legend ?? ''].join(' ')}>
        <span className="text-safe">{placedHouseholds.toLocaleString()} HH placed</span>
        <span className="text-critical">{unmetHouseholds.toLocaleString()} HH unmet</span>
      </div>
    </div>
  );
};
