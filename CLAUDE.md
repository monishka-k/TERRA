# CLAUDE.md — SETU-DRR Project & Frontend Guidelines

## 📌 Project Overview
- **Name:** SETU-DRR (Hazard Red Zone & Relocation Decision Support Platform)
- **Monorepo Structure:** `api/` (FastAPI), `core/` (ML/analytics), `pipeline/` (data ingestion), `web/` (Next.js 16 + React 19 + Tailwind v4), `infra/`, `docs/`, `tests/`.

---

## 💻 Essential Commands

```bash
# Frontend (web/)
cd web
pnpm install
pnpm dev              # Launch Next.js dev server (http://localhost:3000)
pnpm build            # Build production bundle
pnpm lint             # Run ESLint
pnpm generate:types   # Sync TypeScript types from openapi.json

# Backend (root)
uv run pytest -v                          # Run backend test suite
uv run uvicorn api.main:app --reload      # Run FastAPI server (http://localhost:8000)
```

---

## 🎨 Mandatory Frontend Architecture Instructions (`web/`)

When generating or editing frontend code in `web/`, all agents and developers must strictly follow these core principles:

### 1. Granular Component Decomposition (Separate Everything)
- **Maximum Separation**: Any piece of UI that can be isolated must be broken out into its own dedicated component file. Do **NOT** write giant monolithic components or bloated JSX trees.
- **Single Responsibility**: Keep component files focused, readable, and under ~150 lines.
- **Mandatory Extractions**:
  - List items, table rows, and repeated cards must never be inlined in `.map()` loops. Extract them into dedicated component files (e.g., `TriageTableRow.tsx`, `RelocationSiteCard.tsx`, `FilterChip.tsx`).
  - Headers, footers, control bars, metric widgets, empty states, error fallbacks, and tooltip triggers must each be distinct components.
  - Skeletons and loading indicators must have matching dedicated component files (e.g., `MetricCardSkeleton.tsx`).
  - Keep presentation components strictly decoupled from data fetching and orchestration containers.
- **Directory Layout**:
  - `web/components/ui/` — Atomic UI primitives (buttons, inputs, sliders, toggles, badges, dialogs, drawers).
  - `web/components/common/` — Reusable domain-agnostic widgets (metric cards, status pills, empty states).
  - `web/components/layout/` — Layout shells (ThreePanelLayout, LeftPanel, CenterPanel, RightPanel, Navigation).
  - `web/components/features/` — Domain feature components (`triage/`, `map/`, `dossier/`, `scenario/`).

### 2. Complete Modularity & Exported TypeScript Interfaces
- **100% Configurable**: Every component **MUST** export a dedicated TypeScript `interface` detailing all configurable properties.
- **No Hardcoded Values**: Text labels, colors, icons, sizes, tooltips, animation timings, and layout classes must be exposed through props with sensible defaults.
- **Interface Standards**:
  - **Content Props**: Use `React.ReactNode` for flexible text, labels, subtitles, and icons.
  - **Visual Variants**: Use strongly typed string unions (e.g., `variant?: 'urgent' | 'caution' | 'safe'`).
  - **Class Overrides**: Provide both a root `className?: string` and a structured `classNames?: { [element: string]: string }` object for granular inner styling overrides.
  - **Slot Props**: Provide slots for auxiliary actions, icons, and prefixes/suffixes (`leftIcon`, `rightIcon`, `actionSlot`).
  - **Event Callbacks**: Strongly typed interaction handlers (`onClick`, `onValueChange`, `onSelect`, etc.).
  - **Animation Overrides**: Allow consumers to customize or disable animations (`animation?: { disabled?: boolean; duration?: number }`).
  - **Exporting Types**: Always export the component's props interface and helper types from the component file and barrel `index.ts`.

### 3. GSAP for All Animations & Microinteractions
- **Unified Animation Engine**: Use **GreenSock (GSAP)** and `@gsap/react` for **all animations and transitions**. Avoid disparate CSS keyframes or mixing competing animation libraries.
- **Next.js / React 19 Compatibility**:
  - Components with GSAP animations must include `'use client'`.
  - Always utilize `@gsap/react`'s `useGSAP` hook.
  - Always provide a `scope` ref to `useGSAP` to guarantee proper encapsulation and automatic garbage collection / revert on unmount.
- **Universal Microinteractions (Make the Interface Feel Alive)**:
  - **Buttons & Clicks**: Micro-scale on hover (1.02–1.04x), tactile active depression (0.97x), and smooth border/glow transitions.
  - **Cards & Rows**: Subtle elevation lift (`y: -2px` to `-4px`), border highlight tweens, and hover glow effects.
  - **Sliders & Inputs**: Fluid thumb reactions, animated numerical counter rollups via GSAP number tweens on change.
  - **Lists & Data Sets**: Staggered entrance animations (`stagger: 0.04s`, `ease: 'power2.out'`) on load or filter switch.
  - **Drawers & Modals**: Smooth physics-based slide-ins and backdrop blur fades.
  - **Accessibility**: Honor `prefers-reduced-motion` to tone down or bypass animations for users with motion sensitivity.

### 4. Universal Light & Dark Mode Compliance (`ThemeProvider`)
- **Global Theme Provider**: All frontend code must adhere to the global `ThemeProvider` at `@/components/providers` (`useTheme()`).
- **Zero Dark-Only Hardcoding**: Every component must work seamlessly in both light and dark modes:
  - Do NOT hardcode colors like `text-white`, `bg-[#0e261d]`, or `border-white/10` without dual light variants.
  - Use semantic theme tokens (`text-ink dark:text-text-primary`, `bg-surface-0 dark:bg-forest-dark`, `border-line dark:border-white/10`).
  - Rely on global classes (`.glass-card`, `.capsule-pill`, `.pill-badge`, `.btn-citron`) which are calibrated for both daylight sage and night forest palettes.
- **Canvas / 3D Sync**: WebGL (Three.js Earth / GovMapStage) and MapLibre canvases must consume `useTheme()` and reactively adjust ambient lighting, background paints, and mesh colors.
- **Theme Controls**: Use `<ThemeToggle />` from `@/components/ui/theme-toggle` (or `@/components/ui`) for user theme switching.
