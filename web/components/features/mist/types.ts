import React from 'react';

/**
 * Blend mode configuration for atmospheric mist rendering.
 */
export type MistBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';

/**
 * Granular class name overrides for AtmosphericMist sub-elements.
 */
export interface AtmosphericMistClassNames {
  /** Root container div */
  root?: string;
  /** Inner motion wrapper that scales and translates */
  wrapper?: string;
  /** Mist image element */
  image?: string;
}

/**
 * Animation overrides for atmospheric mist dynamics.
 */
export interface AtmosphericMistAnimationConfig {
  /** Whether continuous micro-drift / breathing is enabled at rest (default true) */
  enableFloatingDrift?: boolean;
  /** Duration in seconds of one cycle of subtle floating (default 12) */
  driftDuration?: number;
  /** Translation drift range in pixels (default 8) */
  driftOffset?: number;
}

/**
 * Comprehensive properties interface for the AtmosphericMist component.
 */
export interface AtmosphericMistProps {
  /**
   * Normalized scroll progress across narrative track (0.0 at top hero to 1.0 at footer).
   * @default 0
   */
  scrollProgress?: number;

  /**
   * Source image URL for the mist artifact.
   * @default '/atmospheric-mist-transparent.png'
   */
  imageUrl?: string;

  /**
   * Peak base opacity when at the top hero section (scrollProgress = 0).
   * Lightly applied for subtlety.
   * @default 0.55
   */
  baseOpacity?: number;

  /**
   * Alias for baseOpacity (for backwards compatibility).
   */
  intensity?: number;

  /**
   * Normalized scroll progress threshold at which mist is 100% dispersed and invisible.
   * Increased to 0.52 so mist disperses slowly as the user scrolls down.
   * @default 0.52
   */
  dispersionThreshold?: number;

  /**
   * Scale multiplier when mist fully disperses outward (e.g. 1.15 = 15% expansion).
   * @default 1.15
   */
  dispersionScale?: number;

  /**
   * Vertical drift distance in pixels as mist disperses upwards/outwards.
   * @default -30
   */
  dispersionY?: number;

  /**
   * CSS blend mode for blending mist over the background.
   * @default 'normal'
   */
  blendMode?: MistBlendMode;

  /**
   * Top-level CSS class name for the root fixed container.
   */
  className?: string;

  /**
   * Granular class name overrides for internal elements.
   */
  classNames?: AtmosphericMistClassNames;

  /**
   * Fine-grained animation configuration.
   */
  animation?: AtmosphericMistAnimationConfig;

  /**
   * Optional custom child elements rendered within the mist layer.
   */
  children?: React.ReactNode;
}
