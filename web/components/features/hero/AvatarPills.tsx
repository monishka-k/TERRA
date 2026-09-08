'use client';

import React from 'react';
import { AvatarPill } from './AvatarPill';

export interface AvatarPillsProps {
  /** Initials or labels for the avatars */
  items?: string[];
  /** Custom root className */
  className?: string;
  /** Granular styling overrides */
  classNames?: { pill?: string };
}

export const AvatarPills: React.FC<AvatarPillsProps> = ({
  items = ['N', 'N'],
  className = '',
  classNames = {},
}) => {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {items.map((item, index) => (
        <AvatarPill key={`${item}-${index}`} label={item} className={classNames.pill} />
      ))}
    </div>
  );
};
