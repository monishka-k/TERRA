/**
 * First-load choreography for the landing page.
 *
 * Rather than a new orchestration context, each element keeps its own scoped
 * `useGSAP` timeline and is simply handed a start offset through the standard
 * `animation.delay` prop. Components therefore still animate correctly in
 * isolation, and the whole sequence is retimed by editing this one map.
 *
 * Offsets are in seconds, measured from first paint.
 */
export const INTRO_TIMINGS = {
  /** Floating dock drops in first so the frame is established. */
  header: 0.1,
  /** WebGL scene resolves in behind the copy. */
  globe: 0.2,
  heroBadge: 0.35,
  heroHeadline: 0.5,
  heroTagline: 0.85,
  heroDescription: 1.0,
  heroCta: 1.15,
  fabRail: 1.1,
  heroAvatars: 1.3,
  statusCard: 1.35,
} as const;

export type IntroTimingKey = keyof typeof INTRO_TIMINGS;
