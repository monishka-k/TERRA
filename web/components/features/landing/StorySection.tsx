'use client';

import React from 'react';
import { StorySectionData } from './storyData';
import { LandingSectionCard } from './LandingSectionCard';

export interface StorySectionProps {
  /** Story section dataset */
  data: StorySectionData;
  /** Section HTML id */
  id?: string;
  /** Custom className for the root container */
  className?: string;
}

export const StorySection: React.FC<StorySectionProps> = ({
  data,
  id,
  className = '',
}) => {
  const isRightAlign = data.align === 'right';

  return (
    <section
      id={id || data.id}
      className={`relative min-h-screen shrink-0 w-full flex items-center px-6 sm:px-12 lg:px-20 pointer-events-none py-16 snap-start snap-always ${
        isRightAlign ? 'justify-end' : 'justify-start'
      } ${className}`}
    >
      <div
        className={`pointer-events-auto z-20 w-full max-w-xl ${
          isRightAlign ? 'ml-auto' : 'mr-auto'
        }`}
      >
        <LandingSectionCard data={data} />
      </div>
    </section>
  );
};
