'use client';

import React from 'react';
import { RouteStage } from '@/components/layout/transition';
import { GovWorkspace } from '@/components/features/gov-workspace';

export default function GovPage() {
  return (
    <RouteStage>
      <GovWorkspace initialViewMode="3d" />
    </RouteStage>
  );
}
