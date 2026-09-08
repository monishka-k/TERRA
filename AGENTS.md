# Agent Instructions & Guidelines — SETU-DRR

Welcome to **SETU-DRR** (Hazard Red Zone & Relocation Decision Support Platform). All AI agents, assistants, and developers contributing to this codebase must adhere strictly to the engineering rules and frontend architecture guidelines outlined below.

---

## 🎨 Frontend Architecture & Component Guidelines (`web/`)

These guidelines are mandatory for all work inside `web/` (Next.js 16 + React 19 + TypeScript + Tailwind CSS v4).

### 1. Extreme Component Granularity (Decompose Everything)
- **Principle of Maximum Separation**: If a UI section, sub-element, or widget can exist as a standalone component, it **MUST** be extracted into its own file. Never write monolithic page files or multi-hundred-line JSX trees.
- **Single Responsibility Principle (SRP)**: Each component should do one thing exceptionally well. A component file should ideally stay under 100–150 lines of code.
- **Mandatory Decompositions**:
  - List items, table rows, and cards must never be inlined within parent loops — extract them (e.g., `HabitationRow.tsx`, `SiteCard.tsx`, `FilterChip.tsx`).
  - Headers, footers, control bars, action menus, metric counters, badges, and empty/error states must be distinct components.
  - Skeletons and loading indicators must have their own dedicated component files matching the shape of the component they placeholder.
  - Separate stateful/container components (data fetching, business logic) from pure presentational/view components.
- **Directory Structure Convention**:
  ```text
  web/components/
  ├── ui/               # Foundational atomic primitives (Button, Input, Slider, Badge, Switch, Tooltip, Modal, Drawer, etc.)
  ├── common/           # Shared composite widgets (MetricCard, StatusPill, EmptyState, SectionHeader, etc.)
  ├── layout/           # App layout components (ThreePanelLayout, LeftPanel, CenterPanel, RightPanel, Header, etc.)
  └── features/         # Domain-specific feature modules
      ├── triage/       # Triage table, filter chips, urgent vs caseload toggles
      ├── map/          # MapLibre container, H3 hexagonal overlays, map controls, time slider
      ├── dossier/      # Risk dossier, SoVI breakdown, loss timeline, SHAP charts
      └── scenario/     # Scenario simulation drawer, parameter sliders, rank delta cards
  ```
- **Barrel Exports**: Every component folder must feature an `index.ts` exporting the component, its prop interface, and any related types.

---

### 2. Complete Modularity & Exported TypeScript Interfaces
- **100% Configurable via Typed Interfaces**: Every component **MUST** export a comprehensive TypeScript `interface` detailing all props. Nothing that a developer or consumer might want to customize should be hardcoded.
  ```tsx
  // Example pattern for every component
  export interface MetricCardProps {
    /** Main numeric or string metric value */
    value: React.ReactNode;
    /** Label or title for the metric */
    label: React.ReactNode;
    /** Optional secondary subtitle or description */
    description?: React.ReactNode;
    /** Visual theme / severity intent */
    variant?: 'default' | 'critical' | 'warning' | 'success' | 'info';
    /** Icon element rendered on the card */
    icon?: React.ReactNode;
    /** Slot for auxiliary action (e.g. tooltip button, info popover) */
    action?: React.ReactNode;
    /** Additional CSS classes for root element */
    className?: string;
    /** Granular styling overrides for inner elements */
    classNames?: {
      root?: string;
      value?: string;
      label?: string;
      iconWrapper?: string;
    };
    /** Animation configuration overrides */
    animation?: {
      enableHover?: boolean;
      duration?: number;
      delay?: number;
    };
    /** Click event handler */
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  }
  ```
- **Interface Checklist for Every Component**:
  - [x] **Content Slots**: Flexible `ReactNode` props for text, titles, subtitles, icons, and child elements.
  - [x] **Style Customization**: Top-level `className` and granular `classNames` object for styling sub-elements.
  - [x] **Variants & Sizes**: Strongly typed union types (`variant?: 'primary' | 'secondary' | ...`, `size?: 'sm' | 'md' | 'lg'`).
  - [x] **Event Callbacks**: Strongly typed interaction callbacks (`onClick`, `onValueChange`, `onHover`, etc.).
  - [x] **Animation Controls**: Props to toggle or customize animation behavior (`animation?: { ... }`).
  - [x] **Sensible Defaults**: Provide graceful default values for all optional props so components work out of the box.
  - [x] **Type Exports**: Always export the props interface and any associated union types/enums from the component file.

---

### 3. GSAP for All Animations & Rich Microinteractions
- **Animation Standard**: Use **GreenSock (GSAP)** along with `@gsap/react` for **all animations, transitions, and microinteractions**. Do not rely on ad-hoc CSS keyframes or external animation libraries when GSAP can provide unified, high-performance orchestration.
  - Dependencies: `gsap` and `@gsap/react` (`pnpm --filter web add gsap @gsap/react`).
- **Next.js & React 19 GSAP Rules**:
  - Components with GSAP animations must include the `'use client'` directive.
  - Always use the official `useGSAP` hook from `@gsap/react`.
  - Always pass a `scope` ref to `useGSAP` to keep animations scoped to the component root and ensure automatic cleanup/revert on unmount:
    ```tsx
    'use client';

    import { useRef } from 'react';
    import { useGSAP } from '@gsap/react';
    import gsap from 'gsap';

    export const InteractiveCard = ({ ... }: InteractiveCardProps) => {
      const containerRef = useRef<HTMLDivElement>(null);

      useGSAP(() => {
        // Safe, scoped animations with automatic cleanup
        gsap.from('.animate-target', {
          y: 16,
          opacity: 0,
          duration: 0.4,
          stagger: 0.05,
          ease: 'power2.out',
        });
      }, { scope: containerRef });

      return <div ref={containerRef}>...</div>;
    };
    ```
- **Universal Microinteractions (Every Component Feels Alive)**:
  - **Buttons & Interactive Elements**: Subtle hover scale (1.02–1.04x), tactile active press (0.97x), smooth background/border highlights.
  - **Cards & Panels**: Elevation lift on hover (`y: -3px`, shadow expansion), subtle border glow or gradient shimmer.
  - **Sliders & Numeric Inputs**: Elastic thumb feedback, animated counter transitions when numeric values update (using GSAP tweening numbers).
  - **Lists & Tables**: Staggered entrance animations on data load (`stagger: 0.03–0.05s`), smooth row hover states.
  - **Alerts & Badges**: Subtle pulse / breathing effect for critical red-zone hazards; smooth status color transitions.
  - **Drawers & Modals**: Smooth slide-and-fade entrance timelines with cubic easing (`power3.out`, `back.out(1.2)`), paired with backdrop blur fade-in.
  - **Respect User Accessibility**: Use `window.matchMedia('(prefers-reduced-motion: reduce)')` or GSAP's `matchMedia()` to disable or soften animations when the user requests reduced motion.

---

### 4. Universal Light & Dark Mode Compliance (`ThemeProvider`)
- **Global Theme Provider**: The application uses a global `ThemeProvider` located at `web/components/providers/ThemeProvider.tsx` (re-exported via `@/components/providers`). It supports `'light' | 'dark' | 'system'` modes with `localStorage` persistence and an anti-flash hydration script in `<head>`.
- **Mandatory Dual Theme Compatibility**: Every single component, layout, modal, drawer, badge, and widget created or modified **MUST** look pristine in both light and dark modes.
  - **Never Hardcode Dark-Only Values**: Do NOT hardcode `#0b1c15`, `text-white`, `border-white/10`, or `bg-[#0e261d]` without providing their light mode counterparts.
  - **Tailwind v4 Semantic Tokens**: Use defined CSS variables and semantic classes:
    - Backgrounds: `bg-bg-base`, `bg-surface-0 dark:bg-forest-dark`, `bg-surface-1 dark:bg-forest-surface`
    - Borders: `border-line dark:border-white/10`, `border-line-strong dark:border-white/20`
    - Text: `text-ink dark:text-text-primary`, `text-text-secondary`, `text-text-muted`
    - Cards & Panels: `.glass-card` (automatically adopts light/dark styling from `globals.css`)
  - **Three.js, WebGL & MapLibre Sync**: For canvas or graphic elements that do not read CSS classes directly:
    - Consume `const { resolvedTheme } = useTheme();` from `@/components/providers`.
    - Adapt lighting, backgrounds, and meshes reactively (e.g., `map.setPaintProperty('background', 'background-color', ...)` or Three.js `AmbientLight`).
  - **Theme Toggle Widget**: Use `<ThemeToggle />` from `@/components/ui/theme-toggle` (or `@/components/ui`) for user controls. It features smooth GSAP-animated sun/moon microinteractions.

---

## 🏛️ Project Architecture Context

- **SETU-DRR Platform**: Relocation & Hazard Decision Support for NDRF / Disaster Management Division.
- **Three-Panel UI (`web/`)**:
  - **Left Panel**: Habitations triage table (Urgency vs Caseload toggle, tier filter chips).
  - **Center Panel**: MapLibre GL hexagonal map (H3 res-8, PRZ, Caution, Active/Forecast alerts, time slider).
  - **Right Panel**: Habitation Risk Dossier (SoVI breakdown, loss timeline, SHAP bar chart), Candidate Relocation Site cards, Scenario Simulation drawer.
- **Type Generation**: Run `pnpm generate:types` in `web/` to synchronize TypeScript interfaces from `openapi.json`.
- **Backend & Python**: Run backend tests with `uv run pytest -v` and FastAPI with `uv run uvicorn api.main:app --reload --port 8000`.
