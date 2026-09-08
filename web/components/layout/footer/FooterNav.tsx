'use client';

import React from 'react';
import Link from 'next/link';

export interface FooterNavLink {
  label: string;
  href: string;
  isExternal?: boolean;
}

export interface FooterNavProps {
  /** Navigation links */
  links?: FooterNavLink[];
  /** Optional custom className */
  className?: string;
}

const DEFAULT_FOOTER_LINKS: FooterNavLink[] = [
  { label: 'About SETU-DRR', href: '/about' },
  { label: 'Command Portal', href: '/login' },
  { label: 'Public Stories', href: '/stories' },
  { label: 'Gov Console', href: '/gov' },
  { label: 'Triage Workspace', href: '/workspace' },
];

export const FooterNav: React.FC<FooterNavProps> = ({
  links = DEFAULT_FOOTER_LINKS,
  className = '',
}) => {
  return (
    <nav
      aria-label="Footer Navigation"
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono font-medium ${className}`}
    >
      {links.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          className="text-text-muted hover:text-ink dark:hover:text-text-primary transition-colors py-1 hover:underline underline-offset-4 decoration-accent/40"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
};
