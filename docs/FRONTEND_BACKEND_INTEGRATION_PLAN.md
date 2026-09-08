# SETU-DRR Frontend-Backend Integration Plan
**Document Version:** 1.0.0  
**Target:** Bridge FastAPI Serving Layer (L5) to Next.js 16 / React 19 Frontend (`web/`)  
**Core Objective:** Connect the full decision-support lifecycle:  
`Hazard → Alerts → Priority Habitation → Risk Dossier → Candidate Relocation Sites → Capacity → Allocation → Scenario Analysis`

---

## 1. Current Architecture

### 1.1 Live Frontend Routes (`web/app/`)
* **`/` (`HomePage`)**: 3D Earth Globe with procedural shaders and static hotspot markers (`DEAD_ZONES_DATA`). Unconnected to backend by design.
* **`/login` (`LoginPage`)**: **100% Connected**. Calls `POST /auth/login` and verifies `GET /auth/me`. Handles Argon2id session authentication, cookies, and role-based redirection (`GOVERNMENT_OFFICIAL` → `/gov`, `CIVILIAN` → `/stories`).
* **`/workspace` (`WorkspacePage`)**: **100% Connected to `/hazard/*`**. Renders `HazardWorkspace` with Deck.gl/MapLibre `FloodHazardMap` querying `GET /hazard/layers`, `GET /hazard/cells`, and `GET /hazard/cells/{h3}`.
* **`/gov` (`GovPage`)**: **Partially Connected (~35%)**. Enforces authentication gate via `useAuth()`. Scopes query to the officer's administrative jurisdiction (`user.jurisdiction.lgd_code` / `admin_id`). Renders `India3DCanvas` (Three.js 3D hexagonal pillars) and `FloodHazardMap` (Deck.gl/MapLibre) using real `/hazard/cells` data. **However, it lacks the decision-support workflow** (habitations queue, candidate sites, capacity simulation, and relocation allocation).
* **`/stories` (`StoriesPage`)**: Educational citizen portal with static SVG district maps (`districtBoundaries.ts`, `storyData.ts`). Unconnected to backend by design.

### 1.2 Mounted vs. Orphaned Components
* **Mounted Components**:
  * `components/features/gov-workspace/GovWorkspace.tsx`: Active container on `/gov`.
  * `components/features/workspace/HazardWorkspace.tsx`: Active container on `/workspace`.
  * `components/features/map/FloodHazardMap.tsx`: Active GIS MapLibre/Deck.gl viewer.
  * `components/features/map-3d/India3DCanvas.tsx`: Active 3D Three.js hexagon renderer.
  * `components/features/dossier/CellDossier.tsx`: Active single-cell flood physical driver dossier.
  * `components/features/triage/TopRiskList.tsx`: Active left-panel list ranking raw H3 cells client-side.
  * `components/features/auth/LoginCard.tsx`: Active auth card.
* **Orphaned / Unmounted Components**:
  * `components/features/dashboard/GovDashboard.tsx`: Standalone prototype dashboard, 100% backed by `demoData.ts`.
  * `components/features/dashboard/GovRelocationPlanner.tsx`: Relocation comparison and capacity UI, backed by `demoData.ts`.
  * `components/features/dashboard/GovDossierPanel.tsx`: Habitation SoVI dossier, backed by `demoData.ts`.
  * `components/features/dashboard/GovHabitationModal.tsx`: Habitation popup modal, backed by `demoData.ts`.
  * `components/features/dashboard/GovTelemetryMetrics.tsx`: Top HUD metrics, backed by `demoData.ts`.
  * `components/features/gov-view/GovHexMapPage.tsx`: Alternate layout, unmounted.
  * `components/features/landslide-modal/LandslideModal.tsx`: Unmounted.
  * `components/features/hazard-drawer/HazardDrawer.tsx`: Unmounted.
  * `components/features/telemetry/*`: Unmounted.

### 1.3 Reusable Components
* `GovRelocationPlanner.tsx` contains high-quality UI widgets (candidate comparison cards, criteria breakdown bars, capacity progress indicators, binding constraint badges). It can be refactored from `demoData.ts` to consume real `CandidateSiteItem` and `AllocationPlanResponse` data.
* `GovDossierPanel.tsx` contains the SoVI multi-attribute bars and loss event cards. It can be refactored to consume real `HabitationRiskDossier` from `GET /habitations/{id}/risk`.
* `GovTelemetryMetrics.tsx` contains HUD metric cards that can be wired directly to `GET /alerts/active` and `GET /alerts/forecast`.

---

## 2. API Integration Matrix

| Backend API | Existing Frontend Consumer | Current State | Planned Live Consumer | Required Work |
| :--- | :--- | :--- | :--- | :--- |
| `POST /auth/login` | `AuthProvider.tsx` / `LoginCard.tsx` | **Connected** | Retain as-is | None. Verified operational. |
| `GET /auth/me` | `AuthProvider.tsx` | **Connected** | Retain as-is | None. Verified operational. |
| `POST /auth/logout` | `AuthProvider.tsx` / `GovWorkspaceHeader.tsx` | **Connected** | Retain as-is | None. Verified operational. |
| `POST /auth/register` | None | Disconnected | Future civilian registration | Keep contract ready in API client. |
| `GET /hazard/layers` | `useHazardLayerList.ts` | **Connected** | Retain as-is | None. Verified operational. |
| `GET /hazard/cells` | `useHazardLayer.ts` | **Connected** | Retain as-is | None. Verified operational. |
| `GET /hazard/cells/{h3}` | `useHazardCellDetail.ts` | **Connected** | Retain as-is in `CellDossier.tsx` | None. Verified operational. |
| `GET /zones` | None | **Disconnected** | Map multi-hazard overlay switch | Implement `web/lib/api/zones.ts` & `useZones.ts`. |
| `GET /zones/{h3}` | None | **Disconnected** | Multi-hazard SHAP cell dossier | Implement `fetchZoneDetail()` in `zones.ts`. |
| `GET /habitations` | None (ranks raw cells) | **Disconnected** | Left Panel `HabitationTriageQueue.tsx` on `/gov` | Implement `web/lib/api/habitations.ts` & `useHabitations.ts`. Add triage list component with Tier and Sort toggles. |
| `GET /habitations/{id}/risk` | None (`demoData.ts` in unmounted panel) | **Disconnected** | Right Panel `HabitationRiskDossier.tsx` on `/gov` | Implement `fetchHabitationRisk()` & `useHabitationRisk.ts`. Mount in Right Panel when a habitation is selected. |
| `GET /habitations/{id}/sites` | None (`demoData.ts` in unmounted planner) | **Disconnected** | `CandidateSitesList.tsx` / Relocation Drawer | Implement `fetchHabitationCandidateSites()` & `useCandidateSites.ts`. |
| `GET /sites/{id}` | None | **Disconnected** | `CandidateSiteDetailModal.tsx` | Implement `fetchSiteDetail()` in `web/lib/api/sites.ts`. |
| `POST /sites/{id}/capacity` | None (local React state in unmounted planner) | **Disconnected** | `CapacitySimulationControl.tsx` | Implement `recomputeSiteCapacity()` in `sites.ts` & `useSiteCapacity.ts`. |
| `GET /alerts/active` | None (`demoData.ts` in unmounted metrics) | **Disconnected** | `GovWorkspaceHeader.tsx` & Alert Layer | Implement `web/lib/api/alerts.ts` & `useAlerts.ts`. Wire badge & map filter. |
| `GET /alerts/forecast` | None (mock time-scrubber in unmounted dashboard) | **Disconnected** | Forecast horizon control on `/gov` | Implement `fetchForecastAlerts()` in `alerts.ts`. Wire horizon slider (1-72h). |
| `POST /plan/allocate` | None (unmounted planner) | **Disconnected** | `AllocationPlanModal.tsx` / Relocation Studio | Implement `web/lib/api/allocation.ts` & `useAllocationPlan.ts`. Wire OR-Tools run trigger. |
| `POST /scenario` | None | **Disconnected** | `ScenarioAnalysisDrawer.tsx` | Implement `web/lib/api/scenario.ts` & `useScenario.ts`. Wire weight & gamma simulation. |
| `GET /health/live` | None | **Disconnected** | Operational Status indicator | Implement `web/lib/api/health.ts`. Optional status pill. |
| `GET /health/ready` | None | **Disconnected** | System diagnostic dialog | Implement `checkReadiness()` in `health.ts`. |

---

## 3. Component & Data-Flow Mapping

### 3.1 Habitations Triage Flow
```text
GET /habitations?admin={lgd}&sort={urgency|caseload}&tier={tier}&limit=50
    ↓
web/lib/api/habitations.ts: fetchHabitations()
    ↓
web/lib/hooks/useHabitations.ts
    ↓
web/components/features/gov-workspace/GovWorkspace.tsx
    ↓
web/components/features/triage/HabitationTriageQueue.tsx
    ↓
User selects Habitation #12
    ↓
setSelectedHabitationId(12) + flyTo centroid on map
```

### 3.2 Habitation Risk Dossier Flow
```text
GET /habitations/12/risk
    ↓
web/lib/api/habitations.ts: fetchHabitationRisk(12)
    ↓
web/lib/hooks/useHabitationRisk.ts
    ↓
web/components/features/dossier/HabitationDossier.tsx (Mounted in Right Panel)
    ↓
Displays SoVI Vulnerability Index, Past Loss Events, and SHAP Feature Attributions
    ↓
User clicks "View Relocation Candidates"
```

### 3.3 Candidate Relocation Sites & Capacity Simulation Flow
```text
GET /habitations/12/sites?radius_km=15
    ↓
web/lib/api/habitations.ts: fetchHabitationCandidateSites(12)
    ↓
web/lib/hooks/useCandidateSites.ts
    ↓
web/components/features/relocation/CandidateSitesList.tsx
    ↓
User clicks "Simulate Policy Capacity" on Site #4
    ↓
POST /sites/4/capacity (with modified plot_area_m2, water_lpcd)
    ↓
web/lib/api/sites.ts: recomputeSiteCapacity(4, overrides)
    ↓
web/lib/hooks/useSiteCapacity.ts
    ↓
Displays baseline vs scenario capacity, delta households, and augmented relief options
```

### 3.4 Relocation Allocation Flow (Min-Cost Flow)
```text
POST /plan/allocate { admin_id: 555, max_search_radius_km: 15, target_tiers: ["Immediate"] }
    ↓
web/lib/api/allocation.ts: generateAllocationPlan(payload)
    ↓
web/lib/hooks/useAllocationPlan.ts
    ↓
web/components/features/relocation/AllocationPlanResults.tsx
    ↓
Renders OR-Tools assignments, relocated households, unmet demand, solver latency, and group-split warnings
```

### 3.5 Dynamic & Forecast Alerts Flow
```text
GET /alerts/active?admin=555 + GET /alerts/forecast?admin=555&horizon=72
    ↓
web/lib/api/alerts.ts: fetchActiveAlerts(), fetchForecastAlerts()
    ↓
web/lib/hooks/useAlerts.ts
    ↓
web/components/features/gov-workspace/GovWorkspaceHeader.tsx (Telemetry Badges)
    ↓
Map overlay toggle highlighting cells where MHI_live >= 0.75 or MHI_fcst >= 0.75
```

---

## 4. Reuse vs. Modification vs. New Code

### KEEP AS-IS
* `web/lib/api/client.ts`: Core fetch wrapper with error envelope parsing and credentials.
* `web/components/providers/AuthProvider.tsx`: Live session authentication provider.
* `web/components/features/auth/LoginCard.tsx`: Working login card.
* `web/lib/api/hazard.ts`: Working static hazard layer API bindings.
* `web/lib/hooks/useHazardLayer.ts`, `useHazardLayerList.ts`, `useHazardCellDetail.ts`: Working hooks.
* `web/components/features/map/FloodHazardMap.tsx`: High-performance Deck.gl / MapLibre map.
* `web/components/features/map-3d/India3DCanvas.tsx`: Three.js 3D hexagonal column visualization.
* `web/components/features/workspace/HazardWorkspace.tsx`: Standalone `/workspace` route.
* `web/app/workspace/page.tsx`, `web/app/login/page.tsx`, `web/app/page.tsx`, `web/app/stories/page.tsx`: Existing routes.

### MODIFY
* `web/lib/api/types.ts`: Re-export generated types from `web/lib/api-types.ts` for habitations, sites, alerts, allocation, and scenario.
* `web/components/features/gov-workspace/GovWorkspace.tsx`:
  * Integrate active habitations selection state.
  * Integrate Left Panel tab switcher (Triage Queue vs. Raw Hazard Layers).
  * Integrate Right Panel switcher (Habitation Risk Dossier when habitation selected vs. Cell Dossier when raw cell selected).
  * Add Relocation Planning modal/drawer trigger.
* `web/components/features/gov-workspace/GovWorkspaceHeader.tsx`:
  * Connect live alert count badges from `useAlerts()`.
  * Add forecast horizon trigger / badge.
* `web/components/features/dashboard/GovRelocationPlanner.tsx`:
  * Refactor from `demoData.ts` to accept `CandidateSiteItem[]` and real mutation callbacks.
* `web/components/features/dashboard/GovDossierPanel.tsx`:
  * Refactor from `demoData.ts` to accept `HabitationRiskDossier`.

### REUSE IN LIVE ROUTE
* `GovTelemetryMetrics.tsx`: Wire to live `useAlerts()` counts.
* `GovRelocationPlanner.tsx`: Mount inside a modal/drawer accessible from the Habitation Dossier.
* `GovDossierPanel.tsx`: Core visual breakdown components reused inside Right Panel Habitation Dossier.

### CREATE NEW
* `web/lib/api/habitations.ts`: Typed API client methods for `/habitations`, `/habitations/{id}/risk`, `/habitations/{id}/sites`.
* `web/lib/api/sites.ts`: Typed API client methods for `/sites/{id}`, `/sites/{id}/capacity`.
* `web/lib/api/alerts.ts`: Typed API client methods for `/alerts/active`, `/alerts/forecast`.
* `web/lib/api/allocation.ts`: Typed API client methods for `/plan/allocate`.
* `web/lib/api/scenario.ts`: Typed API client methods for `/scenario`.
* `web/lib/api/zones.ts`: Typed API client methods for `/zones`, `/zones/{h3}`.
* `web/lib/hooks/useHabitations.ts`: Hook with sorting, tier filtering, and pagination.
* `web/lib/hooks/useHabitationRisk.ts`: Hook for single habitation risk dossier.
* `web/lib/hooks/useCandidateSites.ts`: Hook for ranked candidate relocation sites.
* `web/lib/hooks/useSiteCapacity.ts`: Mutation hook for capacity policy override simulation.
* `web/lib/hooks/useAllocationPlan.ts`: Mutation hook for min-cost flow optimization.
* `web/lib/hooks/useAlerts.ts`: Hook for dynamic active and forecast alerts.
* `web/lib/hooks/useScenario.ts`: Mutation hook for scenario simulation.
* `web/components/features/triage/HabitationTriageQueue.tsx`: Presentational list for habitations triage queue.
* `web/components/features/triage/HabitationRow.tsx`: Granular row component for single habitation.
* `web/components/features/dossier/HabitationDossier.tsx`: Full risk dossier component for Right Panel.
* `web/components/features/relocation/RelocationStudioModal.tsx`: Container orchestrating candidate sites, capacity simulation, and OR-Tools allocation.

### DEPRECATE LATER (Retain for now, do not delete)
* `web/components/features/dashboard/demoData.ts`: Do not delete; keep as reference and demo fallback where explicitly unmounted.
* `web/components/features/dashboard/GovDashboard.tsx`: Keep intact as an archived standalone prototype.

---

## 5. Mock-Data Migration Plan

| `demoData.ts` Entity | Current Mock Usage | Replacement API Endpoint | Loading / Error Behavior |
| :--- | :--- | :--- | :--- |
| `DEMO_HABITATIONS` | `GovDashboard`, `GovDossierPanel` | `GET /habitations?admin={id}` | Display `Skeleton` on load; show `EmptyState` if no habitations; show `ErrorState` with retry button on failure. |
| `HabitationData.breakdown` | `GovDossierPanel` SoVI bars | `GET /habitations/{id}/risk` | Display skeleton in Right Panel; render honest error notice if record missing. |
| `DEMO_RELOCATION_CANDIDATES` | `GovRelocationPlanner` | `GET /habitations/{id}/sites` | Show "No candidate sites within search radius" empty state if list is empty. |
| `Candidate.bindingConstraint` | Hardcoded string in mock candidate | `CandidateSiteItem.capacity.binding_constraint` | Real enum (`LAND`, `WATER`, `SCHOOL`, `HEALTH`, `LIVELIHOOD`, `TENURE`). |
| `TOP_LEVEL_METRICS` | `GovTelemetryMetrics` | `GET /alerts/active` & `GET /alerts/forecast` | Display live counters; display `--` with warning icon on network failure. |
| Scenario Time (`+24h`, `+72h`) | Mock GSAP scrubber | `GET /alerts/forecast?horizon={hours}` | Query parameter alters real forecast alert threshold crossings. |
| `storyData.ts`, `indiaOutline.ts` | `/stories` Public Citizen Page | **Retained statically** | Intentionally static educational content; no backend replacement needed. |

---

## 6. State-Management Plan

State will be kept strictly localized using standard React hooks (`useState`, `useCallback`, `useMemo`), matching the established architecture of `HazardWorkspace` and `GovWorkspace`. No external global state library (Redux, Zustand, React Query) is introduced.

### Lifted State in `GovWorkspace.tsx`:
```tsx
// 1. Existing GIS & 3D state
const [viewMode, setViewMode] = useState<'3d' | 'gis'>('3d');
const [hazardType, setHazardType] = useState<HazardType>('riverine_flood');
const [selectedH3, setSelectedH3] = useState<string | null>(null);
const [hoveredH3, setHoveredH3] = useState<string | null>(null);

// 2. Habitation Triage Queue state
const [leftPanelTab, setLeftPanelTab] = useState<'habitations' | 'hazard_cells'>('habitations');
const [selectedHabitationId, setSelectedHabitationId] = useState<number | null>(null);
const [triageSort, setTriageSort] = useState<'urgency' | 'caseload'>('urgency');
const [triageTier, setTriageTier] = useState<Tier | undefined>(undefined);

// 3. Dynamic Alerts & Forecast state
const [showAlertsOnly, setShowAlertsOnly] = useState<boolean>(false);
const [forecastHorizon, setForecastHorizon] = useState<number>(72);

// 4. Relocation Studio state
const [isRelocationStudioOpen, setIsRelocationStudioOpen] = useState<boolean>(false);
const [selectedCandidateSiteId, setSelectedCandidateSiteId] = useState<number | null>(null);
```

### Mutually Exclusive Panel Logic:
* When a **Habitation** is clicked in the Triage Queue:
  * `selectedHabitationId` is set to its ID.
  * The map centers on the habitation's coordinates `[lon, lat]`.
  * The Right Panel switches to `HabitationDossier` (`GET /habitations/{id}/risk`).
* When an **H3 Hexagon** is clicked on the map:
  * `selectedH3` is set to its hex string.
  * The Right Panel switches to `CellDossier` (`GET /hazard/cells/{h3}`).
* Both dossiers feature an unambiguous close button (`✕`) returning to the neutral workspace state.

---

## 7. Authentication Considerations

* **Strict Session Preservation**: All requests use `apiGet` / `apiPost` with `credentials: 'include'`. The HTTP-only cookie `setu_session` is forwarded automatically by the browser to `localhost:8000`.
* **Jurisdiction Scoping**: When an official logs in, `user.jurisdiction.lgd_code` or `user.jurisdiction.admin_id` is extracted and passed automatically as `admin={id}` to `/habitations`, `/alerts/active`, `/alerts/forecast`, and `/plan/allocate`.
* **Clearance Protection**: Non-authenticated users see the "Authentication Required" lock screen; civilians attempting to open `/gov` see the "Official Clearance Required" shield screen with a redirect to `/stories`.
* **Zero Backend Auth Changes**: No changes to backend auth middleware or Argon2id password hashing are required.

---

## 8. Error, Loading & Empty States

Every connected component will implement honest visual states:
* **401 Unauthorized**: Redirects to `/login` with an informational toast.
* **403 Forbidden**: Displays "Outside Assigned Jurisdiction" notice with the officer's authorized district.
* **404 Not Found**: Surfaces "Entity Not Found" banner (e.g. invalid Habitation ID or Site ID).
* **422 Validation Error**: Displays form/input parameter warning.
* **429 Rate Limited**: Displays "Rate limit reached. Please wait before retrying."
* **500 / 503 Internal / Service Error**: Displays `ErrorState` widget with error code, message, and `onRetry` callback.
* **Empty States**:
  * Habitation Queue: "No habitations match the selected triage tier in this district."
  * Candidate Sites: "No candidate relocation sites found within the 15 km search radius."
  * Alerts: "No cells currently exceed the emergency alert threshold (MHI >= 0.75)."
* **Mutation Feedback**:
  * Capacity simulation: Shows inline loading spinner on recompute; highlights net delta in supportable households (`+X` green or `-Y` amber).
  * Allocation optimization: Shows progress indicator with solver status ("Solving min-cost flow via Google OR-Tools..."); reports latency and any group-split warnings upon completion.

---

## 9. API-Client Design (`web/lib/api/`)

All modules use the canonical types from `web/lib/api-types.ts` and the unified fetch wrapper in `web/lib/api/client.ts`.

### 9.1 `web/lib/api/habitations.ts`
```typescript
import { apiGet } from './client';
import type {
  HabitationListItem,
  HabitationRiskDossier,
  CandidateSiteItem,
  PaginatedResponse_HabitationListItem_,
  PaginatedResponse_CandidateSiteItem_,
  Tier,
  SortMode,
} from './types';

export interface FetchHabitationsParams {
  admin?: number;
  tier?: Tier;
  sort?: SortMode;
  limit?: number;
  offset?: number;
}

export function fetchHabitations(
  params: FetchHabitationsParams = {},
  signal?: AbortSignal
): Promise<PaginatedResponse_HabitationListItem_> {
  return apiGet<PaginatedResponse_HabitationListItem_>('/habitations', params as Record<string, string | number | undefined>, signal);
}

export function fetchHabitationRisk(
  id: number,
  signal?: AbortSignal
): Promise<HabitationRiskDossier> {
  return apiGet<HabitationRiskDossier>(`/habitations/${id}/risk`, undefined, signal);
}

export function fetchHabitationSites(
  id: number,
  params: { radius_km?: number; min_suitability?: number; limit?: number; offset?: number } = {},
  signal?: AbortSignal
): Promise<PaginatedResponse_CandidateSiteItem_> {
  return apiGet<PaginatedResponse_CandidateSiteItem_>(`/habitations/${id}/sites`, params as Record<string, string | number | undefined>, signal);
}
```

### 9.2 `web/lib/api/sites.ts`
```typescript
import { apiGet, apiPost } from './client';
import type {
  CandidateSiteDetail,
  SiteCapacityOverrideRequest,
  SiteCapacityOverrideResponse,
} from './types';

export function fetchSiteDetail(id: number, signal?: AbortSignal): Promise<CandidateSiteDetail> {
  return apiGet<CandidateSiteDetail>(`/sites/${id}`, undefined, signal);
}

export function recomputeSiteCapacity(
  id: number,
  overrides: SiteCapacityOverrideRequest,
  signal?: AbortSignal
): Promise<SiteCapacityOverrideResponse> {
  return apiPost<SiteCapacityOverrideResponse>(`/sites/${id}/capacity`, overrides, signal);
}
```

### 9.3 `web/lib/api/alerts.ts`
```typescript
import { apiGet } from './client';
import type { ActiveAlertsResponse, ForecastAlertsResponse } from './types';

export function fetchActiveAlerts(
  params: { admin?: number; min_mhi?: number; hazard?: string; limit?: number; offset?: number } = {},
  signal?: AbortSignal
): Promise<ActiveAlertsResponse> {
  return apiGet<ActiveAlertsResponse>('/alerts/active', params as Record<string, string | number | undefined>, signal);
}

export function fetchForecastAlerts(
  params: { horizon?: number; admin?: number; min_mhi?: number; hazard?: string; limit?: number; offset?: number } = {},
  signal?: AbortSignal
): Promise<ForecastAlertsResponse> {
  return apiGet<ForecastAlertsResponse>('/alerts/forecast', params as Record<string, string | number | undefined>, signal);
}
```

### 9.4 `web/lib/api/allocation.ts`
```typescript
import { apiPost } from './client';
import type { AllocationPlanRequest, AllocationPlanResponse } from './types';

export function generateAllocationPlan(
  payload: AllocationPlanRequest,
  signal?: AbortSignal
): Promise<AllocationPlanResponse> {
  return apiPost<AllocationPlanResponse>('/plan/allocate', payload, signal);
}
```

### 9.5 `web/lib/api/scenario.ts`
```typescript
import { apiPost } from './client';
import type { ScenarioWeightOverrideRequest, ScenarioResponse } from './types';

export function evaluateScenario(
  payload: ScenarioWeightOverrideRequest,
  signal?: AbortSignal
): Promise<ScenarioResponse> {
  return apiPost<ScenarioResponse>('/scenario', payload, signal);
}
```

### 9.6 `web/lib/api/zones.ts`
```typescript
import { apiGet } from './client';
import type { ZoneCellSummary, ZoneCellDetail } from './types';

export function fetchZones(
  params: { bbox?: string; res?: number; valid_at?: string; admin?: number; limit?: number } = {},
  signal?: AbortSignal
): Promise<ZoneCellSummary[]> {
  return apiGet<ZoneCellSummary[]>('/zones', params as Record<string, string | number | undefined>, signal);
}

export function fetchZoneDetail(h3: string, signal?: AbortSignal): Promise<ZoneCellDetail> {
  return apiGet<ZoneCellDetail>(`/zones/${h3}`, undefined, signal);
}
```

---

## 10. Hook Design (`web/lib/hooks/`)

Hooks will follow the standard pattern: `{ data, isLoading, error, refetch }` with `AbortController` cleanup and dependency watching.

* `useHabitations(params: FetchHabitationsParams)`: Returns `{ habitations, total, hasMore, isLoading, error, refetch }`.
* `useHabitationRisk(id: number | null)`: Returns `{ dossier, isLoading, error, refetch }`.
* `useCandidateSites(habitationId: number | null, radiusKm?: number)`: Returns `{ sites, total, isLoading, error, refetch }`.
* `useSiteCapacity()`: Mutation hook returning `{ recompute, data, isMutating, error, reset }`.
* `useAllocationPlan()`: Mutation hook returning `{ executeAllocation, plan, isSolving, error, reset }`.
* `useAlerts(adminId?: number, horizonHours?: number)`: Returns `{ activeAlerts, forecastAlerts, isLoading, error, refetch }`.
* `useScenario()`: Mutation hook returning `{ runScenario, scenarioResult, isSimulating, error }`.
* `useZones(params)`: Returns `{ zones, isLoading, error, refetch }`.

---

## 11. Routing & Mounting Strategy on `/gov`

The existing `/gov` route (`GovWorkspace.tsx`) will be upgraded with **composition and non-destructive panel switching**:

1. **Header (`GovWorkspaceHeader.tsx`)**:
   * Add operational alert badges: "🚨 Active Alerts: X" and "⏳ 72h Forecast: Y" fetched from `useAlerts()`.
   * Add button: "Relocation & Allocation Studio" to trigger the full-screen modal/drawer.
2. **Left Panel**:
   * Add a top segmented toggle: `[Habitations Triage Queue | Hazard Layer Cells]`.
   * When **Habitations Queue** is active: Renders `HabitationTriageQueue.tsx` with Urgency/Caseload toggle, Tier chips (`Immediate`, `Short-term`, `Medium-term`, `Mitigate`), and ranked habitation cards.
   * When **Hazard Layer Cells** is active: Renders the existing `HazardLayerSelect`, `LayerStatsPanel`, and `TopRiskList`.
3. **Center Panel**:
   * Retains `India3DCanvas` and `FloodHazardMap` as-is.
   * When a habitation is selected, smooth flyTo animation centers the map on the habitation's coordinates.
   * Candidate site markers and alert boundaries can be rendered as additional vector features.
4. **Right Panel**:
   * If `selectedHabitationId` is active: Renders `HabitationDossier.tsx` (SoVI metrics, past loss events, SHAP factors, and "Explore Relocation Sites" button).
   * If `selectedH3` is active (and no habitation selected): Renders the existing `CellDossier.tsx`.
   * If neither is active: Renders the neutral `DossierEmptyState`.
5. **Relocation & Allocation Studio (`RelocationStudioModal.tsx`)**:
   * Mounted as a slide-over drawer / full modal.
   * Integrates the candidate sites list, the policy capacity override sliders (`recomputeSiteCapacity`), and the min-cost flow solver execution button (`generateAllocationPlan`).

---

## 12. Map Integration Strategy

To prevent competing map instances:
* **Single Source of Truth**: The existing `FloodHazardMap` (MapLibre + Deck.gl) and `India3DCanvas` (Three.js) remain the sole visual stage.
* **Coexistence of Layers**:
  * Base: MapLibre vector style.
  * Layer 1: Deck.gl `H3HexagonLayer` showing static hazard or MHI zone cells.
  * Layer 2: Dynamic Alert Overlay highlighting cells in Active Alert (`MHI_live >= 0.75`) or Forecast Alert (`MHI_fcst >= 0.75`).
  * Layer 3: Habitation centroid markers with tier-colored rings.
  * Layer 4: Candidate site target beacons and connection lines between source habitation and destination sites during allocation review.

---

## 13. Testing Plan

### 13.1 API Client Tests
* Verify `apiGet` and `apiPost` append parameters accurately and forward cookies.
* Verify `ApiError` captures status, code, and request ID on 401, 403, 404, 422, and 500 responses.

### 13.2 Hook Tests
* Verify `useHabitations` re-fetches when `triageSort` or `triageTier` changes.
* Verify `useCandidateSites` cancels in-flight requests when `habitationId` changes.
* Verify `useSiteCapacity` and `useAllocationPlan` correctly manage pending, success, and error states.

### 13.3 Integration & Flow Verification
* Test complete flow:
  1. Log in as `officer@setu.gov.in` at `/login`.
  2. Navigate to `/gov`; verify jurisdiction resolves to Barpeta (LGD 277).
  3. Verify habitations queue loads real habitations for Barpeta.
  4. Select a habitation; verify risk dossier displays real SoVI breakdown and loss events.
  5. Click "Relocation Candidates"; verify candidate sites list matches `GET /habitations/{id}/sites`.
  6. Adjust capacity slider (water LPCD); verify `POST /sites/{id}/capacity` updates scenario capacity and delta households.
  7. Click "Generate Allocation Plan"; verify `POST /plan/allocate` invokes OR-Tools and renders solver assignments.

---

## 14. Regression Protection

The following functionalities are guaranteed to remain completely intact:
* `/login` authentication flow and role checks.
* `/workspace` standalone hazard layer exploration.
* GIS MapLibre vector basemap and GPU-rendered Deck.gl hexagons.
* Three.js 3D extruded hexagon landscape on `/gov`.
* Single cell click and physical flood driver inspection (`CellDossier`).
* Dark/Light mode theme switching via `ThemeProvider`.
* Container route animations and GSAP transitions.

---

## 15. File-by-File Change List

### New Files to Create:
1. `web/lib/api/habitations.ts` (API bindings for `/habitations`, `/habitations/{id}/risk`, `/habitations/{id}/sites`)
2. `web/lib/api/sites.ts` (API bindings for `/sites/{id}`, `/sites/{id}/capacity`)
3. `web/lib/api/alerts.ts` (API bindings for `/alerts/active`, `/alerts/forecast`)
4. `web/lib/api/allocation.ts` (API bindings for `/plan/allocate`)
5. `web/lib/api/scenario.ts` (API bindings for `/scenario`)
6. `web/lib/api/zones.ts` (API bindings for `/zones`, `/zones/{h3}`)
7. `web/lib/hooks/useHabitations.ts` (React hook for triage queue)
8. `web/lib/hooks/useHabitationRisk.ts` (React hook for risk dossier)
9. `web/lib/hooks/useCandidateSites.ts` (React hook for candidate relocation sites)
10. `web/lib/hooks/useSiteCapacity.ts` (React mutation hook for carrying capacity overrides)
11. `web/lib/hooks/useAllocationPlan.ts` (React mutation hook for OR-Tools allocation)
12. `web/lib/hooks/useAlerts.ts` (React hook for active & forecast alerts)
13. `web/lib/hooks/useScenario.ts` (React mutation hook for sensitivity simulation)
14. `web/components/features/triage/HabitationTriageQueue.tsx` (Triage queue list component)
15. `web/components/features/triage/HabitationRow.tsx` (Granular habitation list item)
16. `web/components/features/dossier/HabitationDossier.tsx` (Habitation risk dossier in Right Panel)
17. `web/components/features/relocation/RelocationStudioModal.tsx` (Modal for candidate sites, capacity, and allocation)

### Files to Modify:
1. `web/lib/api/types.ts`: Re-export generated OpenAPI types from `api-types.ts`.
2. `web/components/features/gov-workspace/GovWorkspace.tsx`: Wire triage queue in Left Panel, habitation risk dossier in Right Panel, and alert badges.
3. `web/components/features/gov-workspace/GovWorkspaceHeader.tsx`: Connect alert counters and Relocation Studio modal button.
4. `web/components/features/dashboard/GovRelocationPlanner.tsx`: Refactor from `demoData.ts` to accept typed API props (`CandidateSiteItem[]`, `AllocationPlanResponse`).

---

## 16. Risk Assessment & Mitigations

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Accidental unmounting of working map** | High | Preserve `CenterPanel` JSX intact; only pass additional markers/props. |
| **Stale React state during rapid selection** | Medium | Use `AbortController` in all API hooks to cancel superseded requests. |
| **CORS / Cookie dropping** | High | Keep `credentials: 'include'` on all client requests; test with active session. |
| **Silent fallback to mock data hiding API bugs** | High | Strictly forbid mock fallbacks in connected code. Show explicit error states if backend returns 404/500. |
| **Performance lag when rendering many habitations** | Medium | Backend limits queue to 50 records per page; support pagination. |

---

## 17. Implementation Order

1. **Step 1: Type Infrastructure & API Clients** (`web/lib/api/types.ts`, `habitations.ts`, `sites.ts`, `alerts.ts`, `allocation.ts`, `scenario.ts`, `zones.ts`).
2. **Step 2: React Hooks** (`useHabitations.ts`, `useHabitationRisk.ts`, `useCandidateSites.ts`, `useSiteCapacity.ts`, `useAllocationPlan.ts`, `useAlerts.ts`).
3. **Step 3: Habitation Triage Queue Component** (`HabitationRow.tsx`, `HabitationTriageQueue.tsx`).
4. **Step 4: Habitation Risk Dossier Component** (`HabitationDossier.tsx`).
5. **Step 5: Integrate Left & Right Panels in `GovWorkspace.tsx`** (Add tab toggles and selection sync).
6. **Step 6: Alerts & Telemetry in `GovWorkspaceHeader.tsx`** (Wire active & forecast counts).
7. **Step 7: Relocation Studio & Capacity Simulation** (`RelocationStudioModal.tsx`, wired to `GovRelocationPlanner.tsx`).
8. **Step 8: Verification & Walkthrough** (Validate end-to-end user journey without running unnecessary tests).
