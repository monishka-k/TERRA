'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface DrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
  /** Header title or element */
  title?: React.ReactNode;
  /** Subtitle or description */
  subtitle?: React.ReactNode;
  /** Drawer content */
  children: React.ReactNode;
  /** Optional footer action bar */
  footer?: React.ReactNode;
  /** Optional icon in header */
  icon?: React.ReactNode;
  /** Max width class */
  maxWidthClassName?: string;
  /** Custom root className */
  className?: string;
  /** Granular styling overrides */
  classNames?: {
    root?: string;
    header?: string;
    body?: string;
    footer?: string;
  };
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  icon,
  maxWidthClassName = 'max-w-2xl',
  className = '',
  classNames = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!drawerRef.current) return;

    if (isOpen) {
      gsap.to(drawerRef.current, {
        x: '0%',
        duration: 0.55,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    } else {
      gsap.to(drawerRef.current, {
        x: '100%',
        duration: 0.4,
        ease: 'power3.in',
        overwrite: 'auto',
      });
    }
  }, { scope: containerRef, dependencies: [isOpen] });

  return (
    <div ref={containerRef}>
      <div
        ref={drawerRef}
        style={{ transform: 'translateX(100%)' }}
        className={`fixed inset-y-0 right-0 ${maxWidthClassName} w-full z-50 bg-surface-0/95 dark:bg-forest-dark/95 backdrop-blur-2xl border-l border-line dark:border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col text-ink dark:text-text-primary transition-colors duration-200 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'} ${classNames.root || ''} ${className}`}
      >
        {/* Header */}
        {(title || icon) && (
          <div className={`p-6 border-b border-line dark:border-white/10 flex items-center justify-between ${classNames.header || ''}`}>
            <div className="flex items-center space-x-3">
              {icon && (
                <div className="w-9 h-9 rounded-xl bg-citron/15 border border-citron/30 flex items-center justify-center text-citron">
                  {icon}
                </div>
              )}
              <div>
                {title && <h3 className="font-display text-lg font-bold text-ink dark:text-white tracking-tight">{title}</h3>}
                {subtitle && <p className="text-xs text-ink-faint dark:text-text-muted">{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-ink-muted dark:text-text-muted hover:text-ink dark:hover:text-white hover:bg-surface-2 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${classNames.body || ''}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className={`p-4 border-t border-line dark:border-white/10 bg-surface-1/80 dark:bg-forest-deep/60 flex items-center justify-between ${classNames.footer || ''}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
