'use client';

import React from 'react';
import { RouteStage } from '@/components/layout/transition';
import { HazardWorkspace } from '@/components/features/workspace';

export default function WorkspacePage() {
  return (
    <RouteStage>
      <HazardWorkspace />
    </RouteStage>
  );
}
