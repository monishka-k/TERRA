-- 003_indexes.sql
-- Spatial GiST, Temporal BRIN, and Compound B-Tree indexes for SETU-DRR (Day 1)

-- ====================================================================
-- 1. SPATIAL GIST INDEXES
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_admin_boundary_geom ON admin_boundary USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_habitation_geom_point ON habitation USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_habitation_geom_footprint ON habitation USING GIST (geom_footprint);
CREATE INDEX IF NOT EXISTS idx_grid_cell_geom ON grid_cell USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_grid_cell_centroid ON grid_cell USING GIST (centroid);
CREATE INDEX IF NOT EXISTS idx_disaster_event_geom ON disaster_event USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_candidate_site_geom ON candidate_site USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_candidate_site_centroid ON candidate_site USING GIST (centroid);

-- ====================================================================
-- 2. RELATIONAL FOREIGN KEY & LOOKUP B-TREE INDEXES
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_admin_boundary_parent_id ON admin_boundary (parent_id);
CREATE INDEX IF NOT EXISTS idx_habitation_admin_id ON habitation (admin_id);
CREATE INDEX IF NOT EXISTS idx_grid_cell_admin_id ON grid_cell (admin_id);
CREATE INDEX IF NOT EXISTS idx_grid_cell_habitation_id ON grid_cell (habitation_id);
CREATE INDEX IF NOT EXISTS idx_grid_cell_res ON grid_cell (res);

CREATE INDEX IF NOT EXISTS idx_mhi_snapshot_zone_class ON mhi_snapshot (zone_class);
CREATE INDEX IF NOT EXISTS idx_candidate_site_binding_constraint ON candidate_site (binding_constraint);
CREATE INDEX IF NOT EXISTS idx_candidate_site_suitability ON candidate_site (suitability DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_site_cc_final ON candidate_site (cc_final DESC);

CREATE INDEX IF NOT EXISTS idx_relocation_plan_allocation_run_id ON relocation_plan (allocation_run_id);
CREATE INDEX IF NOT EXISTS idx_relocation_plan_habitation_id ON relocation_plan (habitation_id);
CREATE INDEX IF NOT EXISTS idx_relocation_plan_site_id ON relocation_plan (site_id);
CREATE INDEX IF NOT EXISTS idx_relocation_plan_tier ON relocation_plan (tier);

CREATE INDEX IF NOT EXISTS idx_allocation_run_admin_id ON allocation_run (admin_id);

-- ====================================================================
-- 3. TEMPORAL BRIN & B-TREE INDEXES
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_hazard_dynamic_valid_at ON hazard_dynamic USING BRIN (valid_at);
CREATE INDEX IF NOT EXISTS idx_mhi_snapshot_valid_at ON mhi_snapshot USING BRIN (valid_at);
CREATE INDEX IF NOT EXISTS idx_disaster_event_ts ON disaster_event (ts DESC);
