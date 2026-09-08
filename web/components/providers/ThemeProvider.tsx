'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  /** The configured theme setting: 'light', 'dark', or 'system' */
  theme: Theme;
  /** The actively resolved theme applied to the document ('light' or 'dark') */
  resolvedTheme: ResolvedTheme;
  /** Update the active theme setting */
  setTheme: (theme: Theme) => void;
  /** Convenience toggle: alternates between light and dark */
  toggleTheme: () => void;
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default theme if none is stored in localStorage. Defaults to 'dark' */
  defaultTheme?: Theme;
  /** Storage key for persisting theme preference in localStorage */
  storageKey?: string;
  /** Attribute name to apply on the root element (defaults to 'class') */
  attribute?: 'class' | 'data-theme';
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const SYSTEM_MEDIA_QUERY = '(prefers-color-scheme: dark)';

function subscribeSystemTheme(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mediaQuery = window.matchMedia(SYSTEM_MEDIA_QUERY);
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

function getSystemSnapshot(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia(SYSTEM_MEDIA_QUERY).matches ? 'dark' : 'light';
}

function getServerSystemSnapshot(): ResolvedTheme {
  return 'dark';
}

const emptySubscribe = () => () => {};

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Reads the persisted preference, tolerating environments without storage. */
function getStoredTheme(storageKey: string): Theme | null {
  try {
    const saved = localStorage.getItem(storageKey);
    return isTheme(saved) ? saved : null;
  } catch {
    return null;
  }
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'dark',
  storageKey = 'setu-drr-theme',
}) => {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemSnapshot,
    getServerSystemSnapshot
  );

  /*
   * The persisted preference is read through useSyncExternalStore, matching how
   * `systemTheme` above is read. React uses the server snapshot for the
   * hydration render and only then swaps in the client value, so the first
   * client render agrees with the server's HTML. Reading localStorage directly
   * in a state initialiser instead makes them disagree, and React reports a
   * hydration mismatch on every element that varies by theme (icons, labels,
   * titles). The blocking script in the document head has already painted the
   * right theme on <html>, so this costs no flash.
   */
  const getStoredSnapshot = useCallback(() => getStoredTheme(storageKey), [storageKey]);
  const storedTheme = useSyncExternalStore(emptySubscribe, getStoredSnapshot, () => null);

  /** An explicit choice made in this session, which outranks what was stored. */
  const [chosenTheme, setChosenTheme] = useState<Theme | null>(null);
  const theme: Theme = chosenTheme ?? storedTheme ?? defaultTheme;

  // Compute resolved theme
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return isMounted ? systemTheme : defaultTheme === 'system' ? 'dark' : defaultTheme;
    }
    return theme;
  }, [theme, systemTheme, isMounted, defaultTheme]);

  // Apply classes and attributes to documentElement whenever resolvedTheme updates
  useEffect(() => {
    if (!isMounted) return;
    const root = document.documentElement;

    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    root.setAttribute('data-theme', resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme, isMounted]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setChosenTheme(newTheme);
      try {
        localStorage.setItem(storageKey, newTheme);
      } catch {
        // Ignore quota/security errors
      }
    },
    [storageKey]
  );

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/**
 * Access the global theme state and controls.
 * Must be used within a <ThemeProvider>.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
