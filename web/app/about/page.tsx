'use client';

import React from 'react';
import { RouteStage } from '@/components/layout/transition';
import { Header } from '@/components/layout/header';
import { FrostedFooter } from '@/components/layout/footer';
import {
  AboutHero,
  AboutFeatureGrid,
  AboutAtmosphere,
  AboutMetadataMarkings,
} from '@/components/features/about';
import { APP_ROUTES, NAV_TABS } from '@/lib/routes';

export default function AboutPage() {
  return (
    <RouteStage
      as="div"
      className="relative min-h-screen w-full bg-bg-base text-ink dark:text-text-primary flex flex-col justify-between overflow-x-hidden transition-colors duration-500"
    >
      {/* Background Atmosphere & Mountain Ridges in Mist */}
      <AboutAtmosphere />

      {/* Geospatial Metadata Markings & Topographic Contours */}
      <AboutMetadataMarkings />

      {/* Floating Header Navigation Dock */}
      <Header
        homeHref={APP_ROUTES.home}
        portalHref={APP_ROUTES.login}
        tabs={NAV_TABS}
        activeTabId="about"
      />

      {/* Main Editorial Body */}
      <main className="relative z-10 flex-1 flex flex-col pt-28 sm:pt-32 md:pt-36">
        <AboutHero />
        <AboutFeatureGrid />
      </main>

      {/* Frosted Footnote & Telemetry */}
      <FrostedFooter />
    </RouteStage>
  );
}
