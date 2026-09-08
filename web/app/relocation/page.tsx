'use client';

import React from 'react';
import { RouteStage } from '@/components/layout/transition';
import { RelocationWorkspace } from '@/components/features/relocation';

export default function RelocationPage() {
  return (
    <RouteStage>
      <RelocationWorkspace />
    </RouteStage>
  );
}
