import type { ReactNode } from 'react';

import type { RGBAColor } from '@/lib/map/constants';
import { rgbaToCss } from '@/lib/map/colorScale';

export type LegendSwatchShape = 'solid' | 'outline' | 'hatch';

export interface LegendSwatchProps {
  color: RGBAColor;
  label: ReactNode;
  /** Trailing text, typically a cell count. */
  meta?: ReactNode;
  shape?: LegendSwatchShape;
  title?: string;
  className?: string;
  classNames?: {
    root?: string;
    swatch?: string;
    label?: string;
    meta?: string;
  };
}

/** One legend row. `shape` mirrors how the class is actually drawn on the map. */
export const LegendSwatch = ({
  color,
  label,
  meta,
  shape = 'solid',
  title,
  className = '',
  classNames = {},
}: LegendSwatchProps) => {
  const css = rgbaToCss(color);
  const swatchStyle =
    shape === 'outline'
      ? { borderColor: css, backgroundColor: 'transparent' }
      : shape === 'hatch'
        ? {
            borderColor: css,
            backgroundImage: `repeating-linear-gradient(45deg, ${css} 0 2px, transparent 2px 5px)`,
          }
        : { backgroundColor: css, borderColor: css };

  return (
    <div
      title={title}
      data-legend-row
      className={['flex items-center gap-2', classNames.root ?? '', className].filter(Boolean).join(' ')}
    >
      <span
        aria-hidden
        style={swatchStyle}
        className={[
          'h-2.5 w-4 shrink-0 rounded-[2px] border',
          shape === 'outline' ? 'border-dashed' : '',
          classNames.swatch ?? '',
        ].join(' ')}
      />
      <span className={['flex-1 font-mono text-[10px] text-ink-muted', classNames.label ?? ''].join(' ')}>
        {label}
      </span>
      {meta ? (
        <span className={['font-mono text-[10px] text-ink-faint', classNames.meta ?? ''].join(' ')}>
          {meta}
        </span>
      ) : null}
    </div>
  );
};
