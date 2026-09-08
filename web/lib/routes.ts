import type { NavTabItem } from '@/components/layout/header/NavSegmentTabs';

/**
 * Every route the app actually serves. Hrefs were previously duplicated as prop
 * defaults across the header, nav rail, login card and the gov/stories screens;
 * this is the single source of truth.
 */
export const APP_ROUTES = {
  home: '/',
  login: '/login',
  gov: '/gov',
  relocation: '/relocation',
  stories: '/stories',
  workspace: '/workspace',
  about: '/about',
} as const;

export type AppRouteKey = keyof typeof APP_ROUTES;
export type AppRoute = (typeof APP_ROUTES)[AppRouteKey];

/**
 * Header navigation. A tab with an `href` navigates through the container
 * transform; a tab without one stays on the page and drives globe state (that
 * is the case for the SAR mesh sweep, which has no route of its own).
 */
export const NAV_TABS: NavTabItem[] = [
  { id: 'planetary', label: 'Planetary View', icon: 'public', href: APP_ROUTES.home },
  { id: 'sar_mesh', label: 'Real-time SAR Mesh', icon: 'vital_signs' },
  { id: 'hazards', label: 'Hazards', icon: 'warning', href: APP_ROUTES.workspace },
  { id: 'relocation', label: 'Relocation', icon: 'moving', href: APP_ROUTES.relocation },
  { id: 'data', label: 'Data', icon: 'database', href: APP_ROUTES.gov },
  { id: 'research', label: 'Research', icon: 'menu_book', href: APP_ROUTES.stories },
  { id: 'about', label: 'About', icon: 'info', href: APP_ROUTES.about },
];

/** Maps a pathname back to the tab that should read as selected. */
export function navTabIdForPath(pathname: string, fallback = 'planetary'): string {
  const match = NAV_TABS.find((tab) => tab.href === pathname);
  return match ? match.id : fallback;
}
