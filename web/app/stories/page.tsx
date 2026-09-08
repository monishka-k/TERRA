'use client';

import React from 'react';
import { RouteStage } from '@/components/layout/transition';
import { PublicStoriesPage } from '@/components/features/public-stories';
import { APP_ROUTES } from '@/lib/routes';

export default function StoriesPage() {
  return (
    <RouteStage>
      <PublicStoriesPage overviewHref={APP_ROUTES.home} govHref={APP_ROUTES.gov} />
    </RouteStage>
  );
}
