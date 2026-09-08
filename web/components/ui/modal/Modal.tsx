'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
  /** Optional header title or component */
  header?: React.ReactNode;
  /** Modal body content */
  children: React.ReactNode;
  /** Optional footer action bar */
  footer?: React.ReactNode;
  /** Max width container class */
  maxWidthClassName?: string;
  /** Custom root className */
  className?: string;
  /** Granular styling overrides */
  classNames?: {
    root?: string;
    container?: string;
    header?: string;
    body?: string;
    footer?: string;
  };
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  header,
  children,
  footer,
  maxWidthClassName = 'max-w-4xl',
  className = '',
  classNames = {},
}) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!backdropRef.current || !containerRef.current) return;

    if (isOpen) {
      gsap.to(backdropRef.current, {
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out',
        overwrite: 'auto',
      });
      gsap.fromTo(
        containerRef.current,
        { scale: 0.9, y: 30, opacity: 0 },
        { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.2)', overwrite: 'auto' }
      );
    } else {
      gsap.to(containerRef.current, {
        scale: 0.92,
        y: 20,
        opacity: 0,
        duration: 0.25,
        ease: 'power2.in',
        overwrite: 'auto',
      });
      gsap.to(backdropRef.current, {
        opacity: 0,
        duration: 0.25,
        ease: 'power2.in',
        overwrite: 'auto',
      });
    }
  }, { scope: backdropRef, dependencies: [isOpen] });

  return (
    <div
      ref={backdropRef}
      style={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === backdropRef.current) {
          onClose();
        }
      }}
      className={`fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'} ${classNames.root || ''} ${className}`}
    >
      <div
        ref={containerRef}
        className={`${maxWidthClassName} w-full max-h-[90vh] glass-card rounded-3xl border border-line dark:border-white/15 overflow-hidden flex flex-col shadow-2xl bg-surface-0/95 dark:bg-forest-dark/95 text-ink dark:text-text-primary ${classNames.container || ''}`}
      >
        {/* Header */}
        {header && (
          <div className={`p-6 border-b border-line dark:border-white/10 flex items-center justify-between bg-surface-1/70 dark:bg-forest-deep/50 ${classNames.header || ''}`}>
            {header}
          </div>
        )}

        {/* Content */}
        <div className={`flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 ${classNames.body || ''}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className={`p-5 border-t border-line dark:border-white/10 bg-surface-1/80 dark:bg-forest-deep/80 flex flex-col sm:flex-row items-center justify-between gap-3 ${classNames.footer || ''}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
