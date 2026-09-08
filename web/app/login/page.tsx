'use client';

import React, { useState } from 'react';
import { Header } from '@/components/layout/header';
import { RouteStage } from '@/components/layout/transition';
import { Toast } from '@/components/common/toast';
import { APP_ROUTES, NAV_TABS } from '@/lib/routes';
import { GlobeCanvas } from '@/components/features/globe';
import { LoginCard } from '@/components/features/auth';

export default function LoginPage() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  return (
    <RouteStage
      as="div"
      className="relative w-screen h-screen overflow-hidden bg-bg-base text-text-primary select-none"
    >
      {/* Misty Forest Background Atmosphere */}
      <div className="fixed inset-0 forest-atmosphere z-0 pointer-events-none" />

      {/* 3D WebGL Earth Globe Canvas in Login View Mode */}
      <GlobeCanvas
        viewMode="login"
        isAutoRotating={false}
        isRadarActive={true}
      />

      {/* Minimalist Top Header */}
      <Header
        viewMode="login"
        homeHref={APP_ROUTES.home}
        portalHref={APP_ROUTES.login}
        tabs={NAV_TABS}
        activeTabId="planetary"
      />

      {/* Centered Login Card */}
      <div className="relative z-10 w-full h-full flex items-center px-6 sm:px-12 lg:px-20 pointer-events-none">
        <div className="w-full max-w-3xl pointer-events-auto">
          <LoginCard
            overviewHref={APP_ROUTES.home}
            govHref={APP_ROUTES.gov}
            citizenHref={APP_ROUTES.stories}
          />
        </div>
      </div>

      {/* Toast Feedback Notification Banner */}
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </RouteStage>
  );
}
