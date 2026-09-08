'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useGSAP } from '@gsap/react';
import { gsap } from '@/lib/motion/m3';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { StorySectionData } from './storyData';

export interface LandingSectionCardProps {
  /** Section story data */
  data: StorySectionData;
  /** Custom className for the root container */
  className?: string;
  /** Custom classNames for inner elements */
  classNames?: {
    card?: string;
    badge?: string;
    title?: string;
    description?: string;
  };
}

export const LandingSectionCard: React.FC<LandingSectionCardProps> = ({
  data,
  className = '',
  classNames = {},
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Robust IntersectionObserver to trigger smooth entrance without ScrollTrigger plugin warnings
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useGSAP(
    () => {
      if (!isVisible || !cardRef.current) return;

      if (prefersReducedMotion) {
        gsap.set(cardRef.current, { opacity: 1, y: 0, scale: 1 });
        return;
      }

      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 32, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.85,
          ease: 'power3.out',
        }
      );
    },
    { scope: cardRef, dependencies: [isVisible, prefersReducedMotion] }
  );

  const getBadgeStyle = (tone?: StorySectionData['badgeTone']) => {
    switch (tone) {
      case 'critical':
        return 'text-critical border-critical/30 bg-critical/10';
      case 'emerald':
        return 'text-accent-emerald-bright border-accent-emerald/30 bg-accent-emerald/10';
      case 'citron':
        return 'text-citron border-citron/30 bg-citron/10';
      default:
        return 'text-accent border-accent/30 bg-accent/10';
    }
  };

  return (
    <div
      ref={cardRef}
      className={`max-w-xl w-full p-6 sm:p-8 rounded-2xl bg-surface-0/85 dark:bg-forest-surface/85 backdrop-blur-xl border border-line dark:border-white/10 shadow-xl transition-all duration-300 hover:border-line-strong dark:hover:border-white/20 ${className}`}
    >
      {/* Top Meta Line: Section Number & Badge */}
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-xs font-bold text-text-muted tracking-wider">
          {`//${data.index}`}
        </span>
        <span
          className={`px-2.5 py-0.5 text-[10px] font-mono font-semibold tracking-wider uppercase rounded-full border ${getBadgeStyle(
            data.badgeTone
          )} ${classNames.badge ?? ''}`}
        >
          {data.badge}
        </span>
      </div>

      {/* Main Headline & Subtitle */}
      <h2
        className={`text-2xl sm:text-3xl font-display font-bold text-ink dark:text-text-primary tracking-tight mb-2 ${classNames.title ?? ''}`}
      >
        {data.title}
      </h2>
      <p className="text-sm font-medium text-text-secondary mb-4 leading-snug">
        {data.subtitle}
      </p>

      {/* Narrative Description */}
      <p
        className={`text-sm text-text-muted mb-6 leading-relaxed ${classNames.description ?? ''}`}
      >
        {data.description}
      </p>

      {/* Capability Feature Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {data.pills.map((pill) => (
          <span
            key={pill}
            className="px-2.5 py-1 text-xs font-mono rounded-md bg-surface-1 dark:bg-forest-deep/90 border border-line dark:border-white/10 text-ink dark:text-text-secondary"
          >
            {pill}
          </span>
        ))}
      </div>

      {/* Key Metric Counters */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-line dark:border-white/10 mb-6">
        {data.metrics.map((m) => (
          <div key={m.label} className="flex flex-col">
            <span className="text-xl sm:text-2xl font-mono font-black text-ink dark:text-text-primary">
              {m.value}
            </span>
            <span className="text-[11px] font-sans text-text-muted mt-0.5">
              {m.label}
            </span>
          </div>
        ))}
      </div>

      {/* Action CTA Button */}
      {data.actionLabel && (
        <Link
          href={data.actionHref || '/login'}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-mono font-semibold tracking-wider uppercase transition-transform duration-200 active:scale-95 bg-ink text-surface-0 dark:bg-citron dark:text-forest-dark hover:opacity-90"
        >
          <span>{data.actionLabel}</span>
          <span className="text-base leading-none">→</span>
        </Link>
      )}
    </div>
  );
};
