# SETU-DRR — Team Onboarding & Project Guide

> **Official Cross-Team Handoff Document**  
> For the complete, unabridged technical guide, see [`docs/BACKEND_COMPLETE_HANDOFF.md`](file:///d:/the-dead-zone/docs/BACKEND_COMPLETE_HANDOFF.md).

---

## 🚀 Quick Orientation

* **Project:** SETU-DRR (Hazard Red Zone & Relocation Decision Support Platform)
* **Client / Stakeholder:** Ministry of Home Affairs — National Disaster Response Force (NDRF), Disaster Management Division
* **Backend Status:** **Day 8 Frozen — 100% Tests Passing (187/187)**
* **Architecture:** Decoupled Monorepo (`core/`, `api/`, `pipeline/`, `web/`, `infra/`, `data/`, `models/`, `docs/`, `tests/`)

---

## 👥 Who Does What & How to Pitch In

### 1. Machine Learning & Science Team
* **Checkpoints:** Plug trained models into [`core/src/core/ml/registry.py`](file:///d:/the-dead-zone/core/src/core/ml/registry.py) by implementing the protocols in [`core/src/core/ml/protocols.py`](file:///d:/the-dead-zone/core/src/core/ml/protocols.py).
* **Weights & Calibrations:** Calibrate empirical hazard weights ($w_h$), $\beta$ trigger amplification, and $\gamma$ loss decay in [`core/src/core/constants.py`](file:///d:/the-dead-zone/core/src/core/constants.py).
* **SHAP Values:** Populate precomputed TreeSHAP JSON payloads for pilot cells in the `explanation` table.
* **Licensing:** Confirm INDOFLOODS Zenodo dataset license (PRD Q-7) before wide redistribution.

### 2. Frontend Team (`web/`)
* **Type Safety:** Run `pnpm generate:types` in `web/` to auto-generate TypeScript interfaces from [`openapi.json`](file:///d:/the-dead-zone/openapi.json).
* **Three-Panel UI:**
  * **Left Panel:** Habitations triage table (Urgency vs Caseload toggle, tier filter chips).
  * **Center Panel:** MapLibre GL hexagonal map (H3 res-8, PRZ, Caution, Active/Forecast alerts, time slider).
  * **Right Panel:** Habitation Risk Dossier (SoVI breakdown, loss timeline, SHAP bar chart), Candidate Relocation Site cards (capacity bars with bottleneck highlighting), and the Scenario Simulation drawer.
* **Stateless Scenario Drawer:** Sliders for hazard weights, $\gamma$, and search radius calling `POST /scenario` to show rank deltas ($\Delta \text{Rank}$).
* **Persistent Label:** Mandatory screening-grade notice on all views.

### 3. Backend & Data Engineering Team
* **Completed:** Days 0–7 (database migrations `001_`–`006_`, spatial indexes, SoVI downscaling, 4-resource carrying capacity, dynamic triggers, Google OR-Tools min-cost flow allocation, stateless scenario simulation, OpenAPI synchronization).
* **Future Work (Post-Demo):** Automated PDF Briefing Pack export (`GET /export/{admin}/briefing.pdf`), live APScheduler cron ingestion, and pan-India `pg_partman` partitioning.

---

## 🛠️ Commands Cheat Sheet

```bash
# Backend Test Suite (187 tests)
uv run pytest -v

# Start FastAPI Serving Layer (http://localhost:8000)
uv run uvicorn api.main:app --reload --port 8000

# API Documentation
# http://localhost:8000/docs

# Frontend Development (http://localhost:3000)
cd web
pnpm install
pnpm generate:types
pnpm dev
```
