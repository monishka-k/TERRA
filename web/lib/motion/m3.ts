'use client';

import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Flip } from 'gsap/Flip';
import { CustomEase } from 'gsap/CustomEase';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Single registration point for the GSAP plugins the Material 3 motion system
 * needs. Importing this module anywhere guarantees `Flip`, `CustomEase`, and
 * `ScrollTrigger` are registered before any timeline references them.
 *
 * All plugins ship inside the public `gsap` package (3.15) — no extra install.
 */
gsap.registerPlugin(useGSAP, Flip, CustomEase, ScrollTrigger);

/**
 * M3's `emphasized` curve is specified as two chained beziers, so a single CSS
 * `cubic-bezier()` cannot reproduce it. CustomEase can, which is why it is
 * registered rather than approximated. The CSS side falls back to the standard
 * curve (see `--m3-ease-standard` in globals.css).
 */
CustomEase.create(
  'm3-emphasized',
  'M0,0 C0.05,0 0.133333,0.06 0.166666,0.4 0.208333,0.82 0.25,1 1,1'
);

/** Named easings, matching the Material 3 motion spec. */
export const M3_EASE = {
  /** Two-segment emphasized curve — the M3 default for on-screen movement. */
  emphasized: 'm3-emphasized',
  /** Entering elements: fast start, long settle. */
  decelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  /** Exiting elements: slow start, fast exit. */
  accelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
  /** Small, utilitarian changes (state layers, colour shifts). */
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

/** Durations in seconds (GSAP's unit), matching the M3 duration tokens. */
export const M3_DURATION = {
  short2: 0.1,
  short4: 0.2,
  medium2: 0.3,
  medium4: 0.4,
  long2: 0.5,
  extraLong2: 0.7,
} as const;

export type M3EaseName = keyof typeof M3_EASE;
export type M3DurationName = keyof typeof M3_DURATION;

/**
 * Shared shape for the `animation` prop mandated by the frontend guidelines.
 * Components spread their own defaults over whatever the consumer supplies.
 */
export interface M3AnimationConfig {
  /** Skip the animation entirely and render at the final state. */
  disabled?: boolean;
  /** Override the base duration, in seconds. */
  duration?: number;
  /** Offset the start, in seconds. Used to sequence a page-level intro. */
  delay?: number;
}

export { gsap, Flip, CustomEase, ScrollTrigger, useGSAP };
