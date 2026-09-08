'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export interface ToastProps {
  /** Message to display */
  message: string | null;
  /** Callback when toast auto-dismisses */
  onDismiss?: () => void;
  /** Duration in milliseconds before dismiss */
  durationMs?: number;
  /** Optional custom icon */
  icon?: React.ReactNode;
  /** Custom root className */
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  onDismiss,
  durationMs = 2800,
  icon = <span className="material-symbols-outlined text-citron text-sm">info</span>,
  className = '',
}) => {
  const toastRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!toastRef.current || !message) return;

    const el = toastRef.current;
    const tl = gsap.timeline({
      onComplete: () => {
        if (onDismiss) onDismiss();
      },
    });

    tl.fromTo(
      el,
      { y: 20, opacity: 0, scale: 0.95 },
      { y: 0, opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.4)' }
    ).to(el, {
      y: 15,
      opacity: 0,
      scale: 0.95,
      duration: 0.25,
      ease: 'power2.in',
      delay: durationMs / 1000,
    });

    return () => {
      tl.kill();
    };
  }, { scope: toastRef, dependencies: [message, durationMs] });

  if (!message) return null;

  return (
    <div
      ref={toastRef}
      style={{ opacity: 0 }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-card px-5 py-2.5 rounded-full border border-citron/40 text-xs font-medium text-citron shadow-2xl flex items-center space-x-2.5 pointer-events-none ${className}`}
    >
      {icon}
      <span>{message}</span>
    </div>
  );
};
