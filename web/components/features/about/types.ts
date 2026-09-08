import React from 'react';

/**
 * Data definition for an editorial feature card on the About page.
 */
export interface AboutFeatureCardData {
  /** Two-digit index label, e.g. '01', '02', '03' */
  index: string;
  /** Small uppercase category name, e.g. 'OUR MISSION' */
  category: string;
  /** Image source path */
  imageSrc: string;
  /** Image alt text */
  imageAlt: string;
  /** Bold editorial heading */
  title: string;
  /** Descriptive narrative copy */
  description: string;
  /** Action button label, e.g. 'A SAFER TOMORROW' */
  actionLabel: string;
  /** Optional link destination */
  actionHref?: string;
  /** Optional custom badge label inside image */
  badgeText?: string;
  /** Optional overlay text lines in image */
  overlayLines?: string[];
}

/**
 * Props for the AboutHero component.
 */
export interface AboutHeroProps {
  /** Eyebrow badge text */
  eyebrow?: string;
  /** Main headline */
  headline?: React.ReactNode;
  /** Secondary supporting copy */
  description?: React.ReactNode;
  /** Optional custom className */
  className?: string;
  /** Granular styling overrides */
  classNames?: {
    root?: string;
    eyebrow?: string;
    headline?: string;
    description?: string;
  };
  /** Animation control overrides */
  animation?: {
    disabled?: boolean;
    delay?: number;
    duration?: number;
  };
}

/**
 * Props for a single editorial feature card.
 */
export interface AboutFeatureCardProps {
  /** Card configuration and content */
  data: AboutFeatureCardData;
  /** Optional custom click handler */
  onActionClick?: (data: AboutFeatureCardData) => void;
  /** Custom root className */
  className?: string;
  /** Granular styling overrides */
  classNames?: {
    root?: string;
    header?: string;
    index?: string;
    category?: string;
    imageContainer?: string;
    image?: string;
    content?: string;
    title?: string;
    description?: string;
    footer?: string;
    actionButton?: string;
    actionLabel?: string;
  };
  /** Animation control overrides */
  animation?: {
    disabled?: boolean;
    delay?: number;
    duration?: number;
  };
}

/**
 * Props for the 3-column feature grid.
 */
export interface AboutFeatureGridProps {
  /** Custom card data list; defaults to canonical 3 cards */
  cards?: AboutFeatureCardData[];
  /** Optional action callback */
  onCardAction?: (card: AboutFeatureCardData) => void;
  /** Custom root className */
  className?: string;
  /** Animation control overrides */
  animation?: {
    disabled?: boolean;
    delay?: number;
    stagger?: number;
  };
}

/**
 * Props for the atmospheric background backdrop.
 */
export interface AboutAtmosphereProps {
  /** Optional custom backdrop image url */
  backdropUrl?: string;
  /** Base opacity for the image layer */
  backdropOpacity?: number;
  /** Whether to render floating mist particles/layer */
  enableMist?: boolean;
  /** Custom root className */
  className?: string;
}

/**
 * Props for decorative geospatial metadata markings (coordinates, crosshair, editorial labels).
 */
export interface AboutMetadataMarkingsProps {
  /** Latitude coordinate string */
  latitude?: string;
  /** Longitude coordinate string */
  longitude?: string;
  /** Spaced editorial pillar words */
  editorialPillars?: string[];
  /** Custom root className */
  className?: string;
}
