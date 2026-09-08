-- 002_core_schema.sql
-- Core relational & spatial schema for SETU-DRR / The Dead Zone (Day 1)
-- Requires PostGIS and H3 extensions (001_extensions.sql)

-- ====================================================================
-- 1. PIPELINE RUNS & VERSIONING METADATA
-- ====================================================================

CREATE TABLE IF NOT EXISTS source_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_at TIMESTAMPTZ,
    uri TEXT NOT NULL,
    sha256 TEXT,
    size_bytes BIGINT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS pipeline_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type TEXT NOT NULL, -- FULL, GRID, HAZARD_STATIC, HAZARD_DYNAMIC, EXPOSURE, CAPACITY, ALLOCATION
    status TEXT NOT NULL,   -- RUNNING, VALIDATING, READY, FAILED, SUPERSEDED
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    code_version TEXT NOT NULL,
    config_version TEXT NOT NULL,
    model_version TEXT NOT NULL,
    source_snapshot_id UUID REFERENCES source_snapshot(id) ON DELETE SET NULL,
    error TEXT
);

CREATE TABLE IF NOT EXISTS serving_version (
    dataset_name TEXT PRIMARY KEY, -- e.g. 'default', 'wayanad_pilot', 'national_res7'
    pipeline_run_id UUID NOT NULL REFERENCES pipeline_run(id) ON DELETE RESTRICT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- 2. ADMINISTRATIVE BOUNDARIES & HABITATIONS
-- ====================================================================

CREATE TABLE IF NOT EXISTS admin_boundary (
    id BIGSERIAL PRIMARY KEY,
    level TEXT NOT NULL, -- country, state, district, subdistrict, village
    lgd_code BIGINT UNIQUE,
    name TEXT NOT NULL,
    parent_id BIGINT REFERENCES admin_boundary(id) ON DELETE CASCADE,
    geom GEOMETRY(MultiPolygon, 4326),
    bbox GEOMETRY(Polygon, 4326)
);

CREATE TABLE IF NOT EXISTS habitation (
    id BIGSERIAL PRIMARY KEY,
    lgd_code BIGINT UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'village', -- village, tribal_settlement, urban_ward, hamlet
    admin_id BIGINT REFERENCES admin_boundary(id) ON DELETE SET NULL,
    geom_point GEOMETRY(Point, 4326) NOT NULL,
    geom_footprint GEOMETRY(MultiPolygon, 4326),
    population INT NOT NULL DEFAULT 0 CHECK (population >= 0),
    households INT NOT NULL DEFAULT 0 CHECK (households >= 0)
);

-- ====================================================================
-- 3. H3 GRID & SPATIAL CORE
-- ====================================================================

CREATE TABLE IF NOT EXISTS grid_cell (
    h3 BIGINT PRIMARY KEY,
    res SMALLINT NOT NULL CHECK (res BETWEEN 6 AND 10),
    admin_id BIGINT REFERENCES admin_boundary(id) ON DELETE SET NULL,
    habitation_id BIGINT REFERENCES habitation(id) ON DELETE SET NULL,
    centroid GEOGRAPHY(Point, 4326) NOT NULL,
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    population REAL NOT NULL DEFAULT 0.0 CHECK (population >= 0),
    built_area_m2 REAL NOT NULL DEFAULT 0.0 CHECK (built_area_m2 >= 0),
    dataset_version TEXT NOT NULL DEFAULT 'v1.0'
);

-- ====================================================================
-- 4. HAZARD LAYERS & MHI
-- ====================================================================

CREATE TABLE IF NOT EXISTS hazard_static (
    h3 BIGINT NOT NULL REFERENCES grid_cell(h3) ON DELETE CASCADE,
    hazard_type TEXT NOT NULL, -- landslide, flash_flood, storm_surge, riverine_flood, coastal_erosion, cloudburst
    susceptibility REAL NOT NULL CHECK (susceptibility >= 0.0 AND susceptibility <= 1.0),
    confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    model_version TEXT NOT NULL DEFAULT 'v1.0.0',
    pipeline_run_id UUID REFERENCES pipeline_run(id) ON DELETE SET NULL,
    PRIMARY KEY (h3, hazard_type)
);

-- Partitioned table for dynamic triggers by valid_at
CREATE TABLE IF NOT EXISTS hazard_dynamic (
    id BIGSERIAL,
    h3 BIGINT NOT NULL,
    hazard_type TEXT NOT NULL,
    valid_at TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    forecast_cycle_at TIMESTAMPTZ,
    trigger_value REAL NOT NULL CHECK (trigger_value >= 0.0),
    source TEXT NOT NULL, -- IMERG_EARLY, ECMWF_OPEN, IMD_QPF, SNAPSHOT
    pipeline_run_id UUID REFERENCES pipeline_run(id) ON DELETE SET NULL,
    PRIMARY KEY (id, valid_at)
) PARTITION BY RANGE (valid_at);

-- Initial default partition
CREATE TABLE IF NOT EXISTS hazard_dynamic_default PARTITION OF hazard_dynamic DEFAULT;

CREATE TABLE IF NOT EXISTS mhi_snapshot (
    h3 BIGINT NOT NULL REFERENCES grid_cell(h3) ON DELETE CASCADE,
    valid_at TIMESTAMPTZ NOT NULL,
    mhi_static REAL NOT NULL CHECK (mhi_static >= 0.0 AND mhi_static <= 1.0),
    mhi_live REAL NOT NULL CHECK (mhi_live >= 0.0 AND mhi_live <= 1.0),
    mhi_fcst REAL CHECK (mhi_fcst >= 0.0 AND mhi_fcst <= 1.0),
    dominant_hazard TEXT NOT NULL,
    zone_class TEXT NOT NULL, -- permanent_red, caution, active_alert, forecast_alert, none
    pipeline_run_id UUID REFERENCES pipeline_run(id) ON DELETE SET NULL,
    PRIMARY KEY (h3, valid_at)
);

CREATE TABLE IF NOT EXISTS explanation (
    h3 BIGINT PRIMARY KEY REFERENCES grid_cell(h3) ON DELETE CASCADE,
    model_version TEXT NOT NULL DEFAULT 'v1.0.0',
    factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    screening_grade TEXT NOT NULL DEFAULT 'Screening Grade: Geotechnical investigation required before decision'
);

-- ====================================================================
-- 5. EXPOSURE, VULNERABILITY & LOSS HISTORY
-- ====================================================================

CREATE TABLE IF NOT EXISTS vulnerability (
    habitation_id BIGINT PRIMARY KEY REFERENCES habitation(id) ON DELETE CASCADE,
    v_demographic REAL NOT NULL CHECK (v_demographic >= 0.0 AND v_demographic <= 1.0),
    v_structural REAL NOT NULL CHECK (v_structural >= 0.0 AND v_structural <= 1.0),
    v_access REAL NOT NULL CHECK (v_access >= 0.0 AND v_access <= 1.0),
    v_economic REAL NOT NULL CHECK (v_economic >= 0.0 AND v_economic <= 1.0),
    v_index REAL NOT NULL CHECK (v_index >= 0.0 AND v_index <= 1.0),
    is_district_flat BOOLEAN NOT NULL DEFAULT FALSE,
    pipeline_run_id UUID REFERENCES pipeline_run(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS disaster_event (
    id BIGSERIAL PRIMARY KEY,
    ts DATE NOT NULL,
    hazard_type TEXT NOT NULL,
    geom GEOMETRY(Geometry, 4326) NOT NULL,
    fatalities INT NOT NULL DEFAULT 0 CHECK (fatalities >= 0),
    injured INT NOT NULL DEFAULT 0 CHECK (injured >= 0),
    houses_damaged INT NOT NULL DEFAULT 0 CHECK (houses_damaged >= 0),
    severity REAL NOT NULL DEFAULT 1.0 CHECK (severity >= 0.0),
    source TEXT NOT NULL,
    source_ref TEXT
);

-- ====================================================================
-- 6. DECISION SUPPORT: CANDIDATE SITES & ALLOCATION
-- ====================================================================

CREATE TABLE IF NOT EXISTS candidate_site (
    id BIGSERIAL PRIMARY KEY,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    centroid GEOMETRY(Point, 4326) NOT NULL,
    area_ha REAL NOT NULL CHECK (area_ha > 0),
    tenure TEXT NOT NULL, -- government_revenue, private, tenure_unverified
    slope_mean REAL NOT NULL DEFAULT 0.0,
    mhi_max REAL NOT NULL DEFAULT 0.0 CHECK (mhi_max >= 0.0 AND mhi_max <= 1.0),
    cc_land INT NOT NULL DEFAULT 0 CHECK (cc_land >= 0),
    cc_water INT NOT NULL DEFAULT 0 CHECK (cc_water >= 0),
    cc_school INT NOT NULL DEFAULT 0 CHECK (cc_school >= 0),
    cc_health INT NOT NULL DEFAULT 0 CHECK (cc_health >= 0),
    cc_final INT NOT NULL DEFAULT 0 CHECK (cc_final >= 0),
    binding_constraint TEXT NOT NULL, -- land, water, school, health
    augmented JSONB NOT NULL DEFAULT '{}'::jsonb,
    suitability SMALLINT NOT NULL DEFAULT 50 CHECK (suitability >= 0 AND suitability <= 100),
    pipeline_run_id UUID REFERENCES pipeline_run(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS allocation_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id BIGINT REFERENCES admin_boundary(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- RUNNING, COMPLETED, FAILED
    solver_latency_ms REAL,
    total_households_relocated INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    pipeline_run_id UUID REFERENCES pipeline_run(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS relocation_plan (
    id BIGSERIAL PRIMARY KEY,
    allocation_run_id UUID NOT NULL REFERENCES allocation_run(id) ON DELETE CASCADE,
    habitation_id BIGINT NOT NULL REFERENCES habitation(id) ON DELETE CASCADE,
    site_id BIGINT NOT NULL REFERENCES candidate_site(id) ON DELETE CASCADE,
    households INT NOT NULL CHECK (households > 0),
    tier TEXT NOT NULL, -- immediate, short_term, medium_term, mitigate_in_situ
    priority_score REAL NOT NULL,
    rationale JSONB NOT NULL DEFAULT '{}'::jsonb,
    has_group_split BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'PROPOSED', -- PROPOSED, APPROVED, REJECTED, EXECUTED
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
