'use client';

import { useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export interface AppHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Target link for returning to overview (default '/') */
  homeHref?: string;
  /** Contextual chips (district, model version, dataset). */
  metaSlot?: ReactNode;
  /** Right-aligned controls. */
  actionSlot?: ReactNode;
  className?: string;
  classNames?: {
    root?: string;
    title?: string;
    subtitle?: string;
    meta?: string;
  };
  animation?: {
    disabled?: boolean;
    duration?: number;
  };
}

export const AppHeader = ({
  title,
  subtitle,
  homeHref = '/',
  metaSlot,
  actionSlot,
  className = '',
  classNames = {},
  animation = {},
}: AppHeaderProps) => {
  const rootRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false, duration = 0.5 } = animation;
  const animate = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!animate) return;
      gsap.from('[data-header-item]', {
        y: -8,
        opacity: 0,
        duration,
        stagger: 0.05,
        ease: 'power3.out',
      });
    },
    { scope: rootRef, dependencies: [animate, duration] },
  );

  return (
    <header
      ref={rootRef}
      className={[
        'flex h-12 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface-0 px-4 transition-colors duration-200',
        classNames.root ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-baseline gap-3" data-header-item>
        <Link
          href={homeHref}
          className="hover:opacity-80 transition-opacity flex items-center gap-1.5 group"
          title="Return to Global Overview"
        >
          <span className="material-symbols-outlined text-xs text-citron group-hover:rotate-45 transition-transform">
            emergency
          </span>
          <h1 className={['text-sm font-semibold tracking-tight text-ink group-hover:text-citron transition-colors', classNames.title ?? ''].join(' ')}>
            {title}
          </h1>
        </Link>
        {subtitle ? (
          <p className={['text-[11px] text-ink-faint', classNames.subtitle ?? ''].join(' ')}>{subtitle}</p>
        ) : null}
      </div>

      <div className={['flex items-center gap-2', classNames.meta ?? ''].join(' ')} data-header-item>
        {metaSlot}
        {actionSlot || (
          <div className="flex items-center gap-2">
            <Link
              href="/gov"
              className="px-2.5 py-1 rounded-md text-xs font-mono bg-surface-1 hover:bg-surface-2 text-ink-muted hover:text-ink border border-line transition-colors flex items-center gap-1"
              title="View Hex Simulation"
            >
              <span className="material-symbols-outlined text-xs">hexagon</span>
              <span>Hex Sim</span>
            </Link>
            <Link
              href="/stories"
              className="px-2.5 py-1 rounded-md text-xs font-mono bg-surface-1 hover:bg-surface-2 text-ink-muted hover:text-ink border border-line transition-colors flex items-center gap-1"
              title="View Citizen Stories"
            >
              <span className="material-symbols-outlined text-xs">explore</span>
              <span>Stories</span>
            </Link>
            <ThemeToggle variant="icon" size="sm" />
          </div>
        )}
      </div>
    </header>
  );
};
