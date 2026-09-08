'use client';

import React from 'react';

export type NavTab = 'overview' | 'risk-map' | 'habitations' | 'relocation' | 'alerts';

export interface GovNavRailProps {
  /** Current active navigation tab */
  activeTab: NavTab;
  /** Tab change callback */
  onTabChange: (tab: NavTab) => void;
  /** Officer identifier */
  officerId?: string;
  /** Custom root className */
  className?: string;
}

export const GovNavRail: React.FC<GovNavRailProps> = ({
  activeTab,
  onTabChange,
  officerId = 'NDRF-894',
  className = '',
}) => {
  const navItems: { id: NavTab; label: string; icon: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'risk-map', label: 'Risk Map', icon: 'map' },
    { id: 'habitations', label: 'Habitations', icon: 'home_pin' },
    { id: 'relocation', label: 'Relocation', icon: 'moving' },
    { id: 'alerts', label: 'Alerts', icon: 'notifications_active', badge: 18 },
  ];

  return (
    <aside
      className={`w-16 sm:w-20 bg-gov-bg border-r border-gov-border/20 flex flex-col items-center justify-between py-6 z-30 select-none flex-shrink-0 ${className}`}
      aria-label="Government Dashboard Navigation"
    >
      {/* Top Brand Logo / Solarpunk Crest */}
      <div className="flex flex-col items-center space-y-6 w-full">
        <button
          type="button"
          onClick={() => onTabChange('overview')}
          title="SETU-DRR Platform"
          className="w-10 h-10 rounded-xl bg-gov-surface border border-gov-sage/30 text-gov-sage-light flex items-center justify-center shadow-inner hover:scale-105 transition-transform cursor-pointer"
        >
          <span className="font-serif font-black text-base text-gov-amber">S</span>
        </button>

        {/* Navigation Item Icons */}
        <nav className="flex flex-col items-center space-y-2.5 w-full px-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                title={item.label}
                className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gov-sage/25 text-cream border border-gov-sage/50 shadow-[0_2px_12px_var(--color-gov-border)]'
                    : 'text-cream/60 hover:text-cream hover:bg-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.badge && !isActive && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gov-red ring-2 ring-gov-bg" />
                )}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-gov-amber" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile & Role Badge */}
      <div className="flex flex-col items-center space-y-4 w-full px-2">
        <button
          type="button"
          title="System Settings"
          className="w-9 h-9 rounded-lg text-cream/50 hover:text-cream hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">settings</span>
        </button>

        <div className="w-8 h-px bg-gov-border/20" />

        {/* Officer Avatar & Role Indicator */}
        <div className="relative group cursor-pointer" title={`Logged in: Officer ${officerId}\nRole: Government Official`}>
          <div className="w-9 h-9 rounded-xl bg-gov-surface border border-gov-sage/40 text-gov-sage-light text-xs font-mono font-bold flex items-center justify-center shadow-md">
            GO
          </div>
          <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-accent-emerald border-2 border-gov-bg" />
        </div>
      </div>
    </aside>
  );
};
