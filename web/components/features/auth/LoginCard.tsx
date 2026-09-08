'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useAuth } from '@/components/providers/AuthProvider';
import { ApiError } from '@/lib/api/client';

export interface LoginCardProps {
  /** Target link for returning to overview (default '/') */
  overviewHref?: string;
  /** Target link for Government Official login (default '/gov') */
  govHref?: string;
  /** Target link for Citizen Portal (default '/stories') */
  citizenHref?: string;
  /** Optional callback on successful login with authenticated role */
  onLoginSuccess?: (role: string) => void;
  /** Custom root className */
  className?: string;
}

interface DemoAccountPreset {
  id: string;
  label: string;
  sublabel: string;
  email: string;
  pass: string;
  roleBadge: string;
}

const DEMO_PRESETS: DemoAccountPreset[] = [
  {
    id: 'government',
    label: 'Government',
    sublabel: 'National Operations • All districts',
    email: 'gov@setu.gov.in',
    pass: 'DemoOfficer123!',
    roleBadge: 'OFFICIAL',
  },
  {
    id: 'civilian',
    label: 'Citizen Demo',
    sublabel: 'Civilian • Public',
    email: 'civilian@setu.gov.in',
    pass: 'DemoCivilian123!',
    roleBadge: 'CIVILIAN',
  },
];

export const LoginCard: React.FC<LoginCardProps> = ({
  overviewHref = '/',
  govHref = '/gov',
  citizenHref = '/stories',
  onLoginSuccess,
  className = '',
}) => {
  const router = useRouter();
  const { login } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  const [email, setEmail] = useState<string>('gov@setu.gov.in');
  const [password, setPassword] = useState<string>('DemoOfficer123!');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useGSAP(() => {
    if (!containerRef.current) return;
    gsap.fromTo(
      containerRef.current,
      { x: -50, opacity: 0, scale: 0.97 },
      { x: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' }
    );
  }, { scope: containerRef });

  const applyPreset = (preset: DemoAccountPreset) => {
    setEmail(preset.email);
    setPassword(preset.pass);
    setErrorMessage(null);

    // Subtle GSAP highlight on inputs
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current.querySelectorAll('.auth-input'),
        { backgroundColor: 'rgba(163, 230, 53, 0.15)' },
        { backgroundColor: '', duration: 0.5, ease: 'power2.out' }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const user = await login({ email, password });
      onLoginSuccess?.(user.role);

      if (user.role === 'GOVERNMENT_OFFICIAL' || user.role === 'SYSTEM_ADMIN') {
        router.push(govHref);
      } else {
        router.push(citizenHref);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setErrorMessage('Invalid credentials. Please verify your email and password.');
        } else if (err.status === 422) {
          setErrorMessage('Please enter a valid email address and password.');
        } else if (err.status === 429) {
          setErrorMessage('Too many login attempts. Please wait 60 seconds before retrying.');
        } else {
          setErrorMessage(err.message || 'Authentication failed. Please try again.');
        }
      } else {
        setErrorMessage('Unable to reach authentication service.');
      }

      // Haptic shake animation on failure
      if (containerRef.current) {
        gsap.fromTo(
          containerRef.current,
          { x: -8 },
          { x: 8, duration: 0.08, repeat: 4, yoyo: true, ease: 'sine.inOut' }
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`w-full max-w-xl glass-card p-8 sm:p-10 rounded-[28px] border border-line dark:border-white/15 shadow-2xl relative z-20 backdrop-blur-2xl transition-colors duration-200 ${className}`}
    >
      {/* Top Header Pill */}
      <div className="flex items-center justify-between mb-6">
        <span className="pill-badge px-3 py-1 rounded-full text-[11px] font-mono font-medium text-citron border border-citron/30 bg-citron/10 flex items-center gap-2 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-citron animate-ping" />
          <span>SETU-DRR :: AUTHENTICATION</span>
        </span>
        <Link
          href={overviewHref}
          className="text-xs font-mono text-text-muted hover:text-text-primary transition-colors flex items-center gap-1.5 cursor-pointer py-1 px-2.5 rounded-lg hover:bg-surface-2 dark:hover:bg-white/5"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          <span>Overview</span>
        </Link>
      </div>

      {/* Title & Subtitle */}
      <div className="mb-6">
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight leading-tight">
          Sign In to SETU-DRR
        </h2>
        <p className="text-xs sm:text-sm text-text-secondary mt-1.5 leading-relaxed font-sans">
          Connect to disaster response intelligence. Official credentials unlock the high-resolution GIS hazard matrix.
        </p>
      </div>

      {/* Demo Quick-Fill Presets */}
      <div className="mb-6">
        <span className="block text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2">
          Demo Evaluation Presets (Click to Auto-Fill)
        </span>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_PRESETS.map((p) => {
            const isSelected = email === p.email;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-citron/15 border-citron text-text-primary shadow-sm'
                    : 'bg-surface-1 hover:bg-surface-2 border-line text-text-secondary hover:text-text-primary'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-bold truncate">{p.label}</span>
                  <span className="text-[9px] font-mono px-1 rounded bg-surface-2 dark:bg-white/10 text-text-muted">
                    {p.roleBadge}
                  </span>
                </div>
                <span className="block text-[10px] text-text-muted truncate mt-0.5">
                  {p.sublabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5 animate-fadeIn">
          <span className="material-symbols-outlined text-base shrink-0 mt-0.5">
            error
          </span>
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="auth-email"
            className="block text-xs font-mono font-medium text-text-secondary mb-1.5"
          >
            Email Address
          </label>
          <div className="relative">
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="officer@setu.gov.in"
              className="auth-input w-full px-3.5 py-2.5 rounded-xl bg-surface-1 border border-line focus:border-citron focus:outline-none text-sm text-text-primary font-mono transition-colors"
            />
            <span className="material-symbols-outlined absolute right-3 top-2.5 text-text-muted text-lg pointer-events-none">
              badge
            </span>
          </div>
        </div>

        <div>
          <label
            htmlFor="auth-password"
            className="block text-xs font-mono font-medium text-text-secondary mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="auth-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="auth-input w-full px-3.5 py-2.5 rounded-xl bg-surface-1 border border-line focus:border-citron focus:outline-none text-sm text-text-primary font-mono transition-colors"
            />
            <span className="material-symbols-outlined absolute right-3 top-2.5 text-text-muted text-lg pointer-events-none">
              lock
            </span>
          </div>
        </div>

        <button
          ref={submitBtnRef}
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 py-3 px-4 rounded-xl bg-citron text-[#06100c] font-display font-bold text-sm shadow-md hover:bg-citron/90 active:scale-[0.99] disabled:opacity-60 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 border-2 border-[#06100c] border-t-transparent rounded-full animate-spin" />
              <span>Verifying Argon2id Hash…</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">login</span>
              <span>Authenticate & Enter Portal</span>
            </>
          )}
        </button>
      </form>

      {/* Footer Security Notice */}
      <div className="mt-6 pt-4 border-t border-line dark:border-white/[0.08] flex items-center justify-between text-[11px] text-text-muted font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-citron" />
          <span>HTTP-only Session Cookie</span>
        </span>
        <span>Argon2id Timing-Safe</span>
      </div>
    </div>
  );
};

export default LoginCard;
