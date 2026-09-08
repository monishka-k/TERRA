'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import type { AboutFeatureCardProps } from './types';

export const AboutFeatureCard: React.FC<AboutFeatureCardProps> = ({
  data,
  onActionClick,
  className = '',
  classNames = {},
  animation = {},
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { disabled: animationDisabled = false } = animation;
  const enableInteractions = !animationDisabled && !prefersReducedMotion;

  useGSAP(
    () => {
      const card = cardRef.current;
      const arrow = arrowRef.current;
      if (!card || !enableInteractions) return;

      const onEnter = () => {
        gsap.to(card, {
          y: -6,
          duration: 0.35,
          ease: 'power2.out',
        });
        if (arrow) {
          gsap.to(arrow, {
            x: 2,
            y: -2,
            duration: 0.25,
            ease: 'back.out(2)',
          });
        }
      };

      const onLeave = () => {
        gsap.to(card, {
          y: 0,
          duration: 0.35,
          ease: 'power2.out',
        });
        if (arrow) {
          gsap.to(arrow, {
            x: 0,
            y: 0,
            duration: 0.25,
            ease: 'power2.out',
          });
        }
      };

      card.addEventListener('mouseenter', onEnter);
      card.addEventListener('mouseleave', onLeave);

      return () => {
        card.removeEventListener('mouseenter', onEnter);
        card.removeEventListener('mouseleave', onLeave);
      };
    },
    { scope: cardRef, dependencies: [enableInteractions] }
  );

  const handleClick = () => {
    if (onActionClick) {
      onActionClick(data);
    }
  };

  const actionButtonContent = (
    <div className={`inline-flex items-center gap-3.5 group/action ${classNames.footer ?? ''}`}>
      {/* Circular Arrow Button */}
      <span
        ref={arrowRef}
        className={`w-9 h-9 rounded-full bg-surface-1/90 dark:bg-white/10 border border-line/80 dark:border-white/15 flex items-center justify-center text-ink dark:text-text-primary shadow-sm group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-500 dark:group-hover:text-ink transition-colors duration-300 ${
          classNames.actionButton ?? ''
        }`}
      >
        <svg
          className="w-4 h-4 transition-transform duration-200"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7V17" />
        </svg>
      </span>

      {/* Tracked Uppercase Action Label */}
      <span
        className={`text-[11.5px] font-mono font-semibold tracking-[0.2em] text-ink/80 dark:text-text-primary/90 group-hover:text-ink dark:group-hover:text-white transition-colors duration-200 ${
          classNames.actionLabel ?? ''
        }`}
      >
        {data.actionLabel}
      </span>
    </div>
  );

  return (
    <div
      ref={cardRef}
      className={`about-feature-card group relative rounded-[28px] bg-surface-0/80 dark:bg-forest-surface/75 border border-line/80 dark:border-white/10 backdrop-blur-2xl p-6 sm:p-7 flex flex-col justify-between shadow-[0_10px_36px_rgba(0,0,0,0.05)] dark:shadow-[0_14px_44px_rgba(0,0,0,0.35)] transition-shadow duration-300 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_20px_52px_rgba(0,0,0,0.5)] ${className} ${
        classNames.root ?? ''
      }`}
    >
      {/* Top Header: Index & Category */}
      <div>
        <div
          className={`flex items-center justify-between gap-4 mb-4 ${classNames.header ?? ''}`}
        >
          <span
            className={`text-xl font-bold font-sans text-ink dark:text-text-primary tracking-tight ${
              classNames.index ?? ''
            }`}
          >
            {data.index}
          </span>
          <span
            className={`text-[11px] font-mono tracking-[0.22em] text-text-muted dark:text-neutral-400 uppercase font-medium ${
              classNames.category ?? ''
            }`}
          >
            {data.category}
          </span>
        </div>

        {/* Feature Image Region */}
        <div
          className={`relative w-full aspect-[16/9.5] rounded-2xl overflow-hidden mb-6 bg-surface-1/50 dark:bg-black/30 border border-line/60 dark:border-white/10 shadow-inner ${
            classNames.imageContainer ?? ''
          }`}
        >
          <Image
            src={data.imageSrc}
            alt={data.imageAlt}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className={`object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105 ${
              classNames.image ?? ''
            }`}
          />
        </div>

        {/* Editorial Heading & Narrative Description */}
        <div className={`mb-6 ${classNames.content ?? ''}`}>
          <h3
            className={`text-xl sm:text-2xl font-bold tracking-tight text-ink dark:text-text-primary leading-snug mb-2.5 ${
              classNames.title ?? ''
            }`}
          >
            {data.title}
          </h3>
          <p
            className={`text-sm sm:text-[14.5px] leading-relaxed text-text-secondary dark:text-neutral-300 font-normal ${
              classNames.description ?? ''
            }`}
          >
            {data.description}
          </p>
        </div>
      </div>

      {/* Action Footer (Link or Button) */}
      <div className="pt-2">
        {data.actionHref ? (
          <Link
            href={data.actionHref}
            onClick={handleClick}
            className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald rounded-full"
            aria-label={`${data.actionLabel} - ${data.title}`}
          >
            {actionButtonContent}
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            className="inline-block text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald rounded-full"
            aria-label={`${data.actionLabel} - ${data.title}`}
          >
            {actionButtonContent}
          </button>
        )}
      </div>
    </div>
  );
};
