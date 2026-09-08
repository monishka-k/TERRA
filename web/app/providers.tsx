'use client';

import React from 'react';
import { ThemeProvider, AuthProvider } from '@/components/providers';
import { RouteTransitionProvider } from '@/components/layout/transition';

export interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * Client shell for the root layout.
 *
 * The route transition surface must outlive individual pages, so it is mounted
 * here — a sibling of `{children}` inside the persistent layout — rather than
 * inside any page.
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => (
  <ThemeProvider defaultTheme="light">
    <AuthProvider>
      <RouteTransitionProvider>{children}</RouteTransitionProvider>
    </AuthProvider>
  </ThemeProvider>
);

