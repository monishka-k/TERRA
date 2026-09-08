"""Integration tests for B7: Production Trigger -> Hazard Amplification -> MHI -> Snapshot -> Read Paths.

Verifies:
- Test 1: Live trigger changes live MHI (formula calculation: H = S * (1 + beta * T), MHI = 1 - Prod(1 - w*H)).
- Test 2: Zero trigger (0.0) remains real zero, not replaced by any default.
- Test 3: Forecast is distinct from live (MHI_live != MHI_fcst).
- Test 4: Missing forecast does not fabricate (MHI_live = calculated, MHI_fcst = None).
- Test 5: Persistence is idempotent across Sequences A, B, and C.
- Test 6: Bidirectional live/forecast preservation (neither channel erases the other).
- Test 7: Read-path integration (API endpoints GET /zones, GET /alerts/active, GET /alerts/forecast observe persisted results).

CRITICAL REQUIREMENT:
The tests write triggers ONLY into hazard_dynamic and invoke the production pipeline
function compute_and_persist_dynamic_snapshots. Zero manual inserts into mhi_snapshot!
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import text

from api.main import app
from core.constants import BETA, HAZARD_WEIGHTS
from core.enums import Hazard, ZoneClass
from core.h3_utils import h3_to_str
from pipeline.jobs.compute_dynamic_hazard import compute_and_persist_dynamic_snapshots


@pytest.fixture
def client():
    return TestClient(app)


@pytest.mark.db
class TestB7DynamicHazardPipeline:
    """Rigorous end-to-end integration tests for B7 data flow."""

    def _setup_test_cell(self, db_session, test_h3: int, static_scores: dict[str, float]):
        """Helper to ensure cell and static hazard susceptibilities are cleanly configured."""
        # Ensure grid cell exists
        db_session.execute(
            text("""
                INSERT INTO grid_cell (h3, res, centroid, geom, population, built_area_m2)
                VALUES (
                    :h3, 8,
                    ST_SetSRID(ST_MakePoint(76.15, 11.55), 4326)::geography,
                    ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(76.14 11.54, 76.16 11.54, 76.16 11.56, 76.14 11.56, 76.14 11.54)')), 4326),
                    500.0, 2500.0
                ) ON CONFLICT (h3) DO NOTHING;
            """),
            {"h3": test_h3},
        )

        # Clean dynamic and snapshot tables for this test cell
        db_session.execute(text("DELETE FROM hazard_dynamic WHERE h3 = :h3;"), {"h3": test_h3})
        db_session.execute(text("DELETE FROM mhi_snapshot WHERE h3 = :h3;"), {"h3": test_h3})
        db_session.execute(text("DELETE FROM hazard_static WHERE h3 = :h3;"), {"h3": test_h3})

        # Insert known static susceptibilities
        for hz, s_val in static_scores.items():
            db_session.execute(
                text("""
                    INSERT INTO hazard_static (h3, hazard_type, susceptibility, confidence, model_version)
                    VALUES (:h3, :hz, :s_val, 1.0, 'test-v1')
                    ON CONFLICT (h3, hazard_type) DO UPDATE SET susceptibility = EXCLUDED.susceptibility;
                """),
                {"h3": test_h3, "hz": hz, "s_val": s_val},
            )
        db_session.commit()

    # =========================================================================
    # Test 1: Live trigger changes live MHI
    # =========================================================================
    def test_live_trigger_changes_live_mhi(self, db_session):
        """Test 1: Proves persisting a live trigger in hazard_dynamic and running the pipeline

        recalculates and updates MHI_live according to the authoritative formula.
        """
        test_h3 = 0x8860064989fffff  # valid H3 res 8 int
        t1 = datetime(2026, 8, 30, 6, 0, 0, tzinfo=timezone.utc)
        s_landslide = 0.50

        self._setup_test_cell(db_session, test_h3, {"landslide": s_landslide})

        # Phase 1: Trigger = 0.0 -> H = 0.50 * (1 + 1.0 * 0) = 0.50, MHI = 0.50
        db_session.execute(
            text("""
                INSERT INTO hazard_dynamic (h3, hazard_type, valid_at, forecast_cycle_at, trigger_value, source)
                VALUES (:h3, 'landslide', :valid_at, NULL, 0.0, 'IMERG_EARLY');
            """),
            {"h3": test_h3, "valid_at": t1},
        )
        db_session.commit()

        res1 = compute_and_persist_dynamic_snapshots(db_session, valid_at=t1)
        assert res1.status == "SUCCESS"
        assert res1.snapshots_persisted >= 1

        snap1 = db_session.execute(
            text("SELECT mhi_static, mhi_live, mhi_fcst FROM mhi_snapshot WHERE h3 = :h3 AND valid_at = :valid_at;"),
            {"h3": test_h3, "valid_at": t1},
        ).mappings().first()
        assert snap1 is not None
        assert snap1["mhi_live"] == pytest.approx(0.50, abs=1e-3)
        assert snap1["mhi_fcst"] is None

        # Phase 2: Update trigger to 0.80 -> H = 0.50 * (1 + 1.0 * 0.80) = 0.90, MHI = 0.90
        db_session.execute(
            text("""
                INSERT INTO hazard_dynamic (h3, hazard_type, valid_at, forecast_cycle_at, trigger_value, source)
                VALUES (:h3, 'landslide', :valid_at, NULL, 0.80, 'IMERG_EARLY');
            """),
            {"h3": test_h3, "valid_at": t1},
        )
        db_session.commit()

        res2 = compute_and_persist_dynamic_snapshots(db_session, valid_at=t1)
        assert res2.status == "SUCCESS"

        snap2 = db_session.execute(
            text("SELECT mhi_static, mhi_live, mhi_fcst FROM mhi_snapshot WHERE h3 = :h3 AND valid_at = :valid_at;"),
            {"h3": test_h3, "valid_at": t1},
        ).mappings().first()
        assert snap2 is not None
        assert snap2["mhi_live"] != snap1["mhi_live"]
        assert snap2["mhi_live"] == pytest.approx(0.90, abs=1e-3)

    # =========================================================================
    # Test 2: Zero trigger remains real zero
    # =========================================================================
    def test_zero_trigger_remains_real_zero(self, db_session):
        """Test 2: Proves trigger_value = 0.0 is treated as a real 0.0, not replaced by any default."""
        test_h3 = 0x8860064989fffff
        t1 = datetime(2026, 8, 30, 7, 0, 0, tzinfo=timezone.utc)
        self._setup_test_cell(db_session, test_h3, {"landslide": 0.40})

        db_session.execute(
            text("""
                INSERT INTO hazard_dynamic (h3, hazard_type, valid_at, forecast_cycle_at, trigger_value, source)
                VALUES (:h3, 'landslide', :valid_at, NULL, 0.0, 'IMERG_EARLY');
            """),
            {"h3": test_h3, "valid_at": t1},
        )
        db_session.commit()

        compute_and_persist_dynamic_snapshots(db_session, valid_at=t1)

        snap = db_session.execute(
            text("SELECT mhi_static, mhi_live FROM mhi_snapshot WHERE h3 = :h3 AND valid_at = :valid_at;"),
            {"h3": test_h3, "valid_at": t1},
        ).mappings().first()
        assert snap is not None
        # Formula: H = 0.40 * (1 + 1.0 * 0.0) = 0.40. Zero trigger did NOT get defaulted to non-zero.
        assert snap["mhi_live"] == pytest.approx(0.40, abs=1e-3)

    # =========================================================================
    # Test 3: Forecast is distinct from live
    # =========================================================================
    def test_forecast_is_distinct_from_live(self, db_session):
        """Test 3: Live and forecast triggers produce distinct MHI values without conflation."""
        test_h3 = 0x8860064989fffff
        valid_time = datetime(2026, 8, 31, 0, 0, 0, tzinfo=timezone.utc)
        cycle_time = datetime(2026, 8, 30, 0, 0, 0, tzinfo=timezone.utc)

        self._setup_test_cell(db_session, test_h3, {"landslide": 0.40})

        # Insert live trigger = 0.20 -> H_live = 0.40 * (1 + 0.20) = 0.48, MHI_live = 0.48
        db_session.execute(
            text("""
                INSERT INTO hazard_dynamic (h3, hazard_type, valid_at, forecast_cycle_at, trigger_value, source)
                VALUES (:h3, 'landslide', :valid_at, NULL, 0.20, 'IMERG_EARLY');
            """),
            {"h3": test_h3, "valid_at": valid_time},
        )
        # Insert forecast trigger = 1.20 -> H_fcst = 0.40 * (1 + 1.20) = 0.88, MHI_fcst = 0.88
        db_session.execute(
            text("""
                INSERT INTO hazard_dynamic (h3, hazard_type, valid_at, forecast_cycle_at, trigger_value, source)
                VALUES (:h3, 'landslide', :valid_at, :cycle, 1.20, 'ECMWF_OPEN');
            """),
            {"h3": test_h3, "valid_at": valid_time, "cycle": cycle_time},
        )
        db_session.commit()

        compute_and_persist_dynamic_snapshots(db_session, valid_at=valid_time)

        snap = db_session.execute(
            text("SELECT mhi_static, mhi_live, mhi_fcst, zone_class FROM mhi_snapshot WHERE h3 = :h3 AND valid_at = :valid_at;"),
            {"h3": test_h3, "valid_at": valid_time},
        ).mappings().first()

        assert snap is not None
        assert snap["mhi_live"] == pytest.approx(0.48, abs=1e-3)
        assert snap["mhi_fcst"] == pytest.approx(0.88, abs=1e-3)
        assert snap["mhi_live"] != snap["mhi_fcst"]
        # In B7, zone_class represents static classification ('none'), NOT transient forecast_alert (M18)
        assert snap["zone_class"] == "none"

    # =========================================================================
    # Test 4: Missing forecast does not fabricate
    # =========================================================================
    def test_missing_forecast_does_not_fabricate(self, db_session):
        """Test 4: When only live trigger exists, mhi_fcst is NULL, never fabricated or copied."""
        test_h3 = 0x8860064989fffff
        t1 = datetime(2026, 8, 30, 8, 0, 0, tzinfo=timezone.utc)
        self._setup_test_cell(db_session, test_h3, {"landslide": 0.50})

        db_session.execute(
            text("""
                INSERT INTO hazard_dynamic (h3, hazard_type, valid_at, forecast_cycle_at, trigger_value, source)
                VALUES (:h3, 'landslide', :valid_at, NULL, 0.60, 'IMERG_EARLY');
            """),
            {"h3": test_h3, "valid_at": t1},
        )
        db_session.commit()

        compute_and_persist_dynamic_snapshots(db_session, valid_at=t1)

        snap = db_session.execute(
            text("SELECT mhi_live, mhi_fcst FROM mhi_snapshot WHERE h3 = :h3 AND valid_at = :valid_at;"),
            {"h3": test_h3, "valid_at": t1},
        ).mappings().first()

        assert snap is not None
        assert snap["mhi_live"] == pytest.approx(0.80, abs=1e-3)
        assert snap["mhi_fcst"] is None

    # =========================================================================
    # Test 5 & 6: Safe Bidirectional Merge & Idempotence Sequences A, B, C
    # =========================================================================
    def test_idempotence_and_bidirectional_channel_preservation(self, db_session):
        """Test 5 & 6: Proves Sequence A, B, C idempotence and safe channel merging.

        Sequence A: live -> live (no duplicate, same value)
        Sequence B: forecast -> forecast (no duplicate, same value)
        Sequence C: live -> forecast -> live again (neither channel lost!)
        """
        test_h3 = 0x8860064989fffff
        valid_time = datetime(2026, 8, 31, 12, 0, 0, tzinfo=timezone.utc)
        cycle_time = datetime(2026, 8, 30, 12, 0, 0, tzinfo=timezone.utc)

        self._setup_test_cell(db_session, test_h3, {"landslide": 0.40})

        # --- Step 1: Run Live Calculation ---
        # Live trigger = 0.50 -> H_live = 0.40 * (1 + 0.50) = 0.60, MHI_live = 0.60
        db_session.execute(
            text("""
                INSERT INTO hazard_dynamic (h3, hazard_type, valid_at, forecast_cycle_at, trigger_value, source)
                VALUES (:h3, 'landslide', :valid_at, NULL, 0.50, 'IMERG_EARLY');
            """),
            {"h3": test_h3, "valid_at": valid_time},
        )
        db_session.commit()

        compute_and_persist_dynamic_snapshots(db_session, valid_at=valid_time)

        # Sequence A Idempotence Check: Run live calculation again
        compute_and_persist_dynamic_snapshots(db_session, valid_at=valid_time)

        count_rows = db_session.execute(
            text("SELECT count(*) as cnt FROM mhi_snapshot WHERE h3 = :h3 AND valid_at = :valid_at;"),
            {"h3": test_h3, "valid_at": valid_time},
        ).scalar()
        assert count_rows == 1, "Must not create duplicate snapshot rows on repeated run"

        snap_live = db_session.execute(
            text("SELECT mhi_live, mhi_fcst FROM mhi_snapshot WHERE h3 = :h3 AND valid_at = :valid_at;"),
            {"h3": test_h3, "valid_at": valid_time},
        ).mappings().first()
        assert snap_live["mhi_live"] == pytest.approx(0.60, abs=1e-3)
        assert snap_live["mhi_fcst"] is None

        # --- Step 2: Run Forecast Calculation (Sequence C Part 2) ---
        # Forecast trigger = 1.10 -> H_fcst = 0.40 * (1 + 1.10) = 0.84, MHI_fcst = 0.84
        db_session.execute(
            text("""
                INSERT INTO hazard_dynamic (h3, hazard_type, valid_at, forecast_cycle_at, trigger_value, source)
                VALUES (:h3, 'landslide', :valid_at, :cycle, 1.10, 'ECMWF_OPEN');
            """),
            {"h3": test_h3, "valid_at": valid_time, "cycle": cycle_time},
        )
        db_session.commit()

        compute_and_persist_dynamic_snapshots(db_session, valid_at=valid_time)

        # Sequence B Idempotence Check: Run forecast calculation again
        compute_and_persist_dynamic_snapshots(db_session, valid_at=valid_time)

        count_rows2 = db_session.execute(
            text("SELECT count(*) as cnt FROM mhi_snapshot WHERE h3 = :h3 AND valid_at = :valid_at;"),
            {"h3": test_h3, "valid_at": valid_time},
        ).scalar()
        assert count_rows2 == 1

        snap_merged = db_session.execute(
            text("SELECT mhi_live, mhi_fcst, zone_class FROM mhi_snapshot WHERE h3 = :h3 AND valid_at = :valid_at;"),
            {"h3": test_h3, "valid_at": valid_time},
        ).mappings().first()
        # Invariant: Existing live value (0.60) was NOT erased by forecast computation!
        assert snap_merged["mhi_live"] == pytest.approx(0.60, abs=1e-3)
        assert snap_merged["mhi_fcst"] == pytest.approx(0.84, abs=1e-3)

        # --- Step 3: Run Live Calculation Again with higher storm (Sequence C Part 3) ---
        # Live storm intensifies to trigger = 1.25 -> H_live = 0.40 * (1 + 1.25) = 0.90, MHI_live = 0.90
        db_session.execute(
            text("""
                INSERT INTO hazard_dynamic (h3, hazard_type, valid_at, forecast_cycle_at, trigger_value, source)
                VALUES (:h3, 'landslide', :valid_at, NULL, 1.25, 'IMERG_EARLY');
            """),
            {"h3": test_h3, "valid_at": valid_time},
        )
        db_session.commit()

        compute_and_persist_dynamic_snapshots(db_session, valid_at=valid_time)

        snap_final = db_session.execute(
            text("SELECT mhi_live, mhi_fcst, zone_class FROM mhi_snapshot WHERE h3 = :h3 AND valid_at = :valid_at;"),
            {"h3": test_h3, "valid_at": valid_time},
        ).mappings().first()

        # Invariant: Forecast value (0.84) was NOT erased by the second live computation!
        assert snap_final["mhi_live"] == pytest.approx(0.90, abs=1e-3)
        assert snap_final["mhi_fcst"] == pytest.approx(0.84, abs=1e-3)
        # In B7, zone_class represents static classification ('none'), NOT transient active_alert (M18)
        assert snap_final["zone_class"] == "none"

    # =========================================================================
    # Test 7: Full Read-Path Integration through API Endpoints
    # =========================================================================
    def test_api_read_paths_observe_persisted_dynamic_pipeline_results(self, client, db_session):
        """Test 7: Proves that GET /zones, GET /alerts/active, and GET /alerts/forecast

        read the truthful dynamic results computed and persisted by the production B7 pipeline.
        Zero manual inserts into mhi_snapshot!
        """
        test_h3 = 0x8860064989fffff
        test_h3_hex = h3_to_str(test_h3)

        cycle_time = datetime(2026, 8, 30, 0, 0, 0, tzinfo=timezone.utc)
        valid_24h = cycle_time + timedelta(hours=24)

        # Baseline: static susceptibility 0.40 for landslide
        self._setup_test_cell(db_session, test_h3, {"landslide": 0.40})

        # Insert active storm trigger (live = 1.0) and 24h forecast trigger (fcst = 1.25) into hazard_dynamic ONLY
        db_session.execute(
            text("""
                INSERT INTO hazard_dynamic (h3, hazard_type, valid_at, forecast_cycle_at, trigger_value, source)
                VALUES (:h3, 'landslide', :valid_at, NULL, 1.00, 'IMERG_EARLY');
            """),
            {"h3": test_h3, "valid_at": valid_24h},
        )
        db_session.execute(
            text("""
                INSERT INTO hazard_dynamic (h3, hazard_type, valid_at, forecast_cycle_at, trigger_value, source)
                VALUES (:h3, 'landslide', :valid_at, :cycle, 1.25, 'ECMWF_OPEN');
            """),
            {"h3": test_h3, "valid_at": valid_24h, "cycle": cycle_time},
        )
        db_session.commit()

        # Execute B7 production pipeline boundary
        proc_result = compute_and_persist_dynamic_snapshots(db_session, valid_at=valid_24h)
        assert proc_result.status == "SUCCESS"

        valid_24h_iso = valid_24h.strftime("%Y-%m-%dT%H:%M:%SZ")

        # 1. Verify GET /zones observes the persisted dynamic snapshot at valid_at
        res_zones = client.get("/zones", params={"res": 8, "valid_at": valid_24h_iso, "limit": 5000})
        assert res_zones.status_code == 200
        items = [x for x in res_zones.json() if x["h3"] == test_h3_hex]
        assert len(items) == 1
        zone_item = items[0]
        # H = 0.40 * (1 + 1.0) = 0.80 -> MHI_live = 0.80
        assert zone_item["mhi_live"] == pytest.approx(0.80, abs=1e-2)
        # H_fcst = 0.40 * (1 + 1.25) = 0.90 -> MHI_fcst = 0.90
        assert zone_item["mhi_fcst"] == pytest.approx(0.90, abs=1e-2)
        # In B7, static zone_class is preserved ('none'), not mutated by transient active storm
        assert zone_item["zone_class"] == "none"

        # 2. Verify GET /alerts/active observes the cell
        res_active = client.get("/alerts/active", params={"min_mhi": 0.75, "limit": 100})
        assert res_active.status_code == 200
        active_items = [x for x in res_active.json()["items"] if x["h3"] == test_h3_hex]
        assert len(active_items) == 1
        assert active_items[0]["mhi_live"] == pytest.approx(0.80, abs=1e-2)

        # 3. Verify GET /alerts/forecast?horizon=24 observes the cell with truthful provenance
        res_fcst = client.get("/alerts/forecast", params={"horizon": 24, "min_mhi": 0.75, "limit": 100})
        assert res_fcst.status_code == 200
        fcst_data = res_fcst.json()
        assert fcst_data["horizon_hours"] == 24
        fcst_items = [x for x in fcst_data["items"] if x["h3"] == test_h3_hex]
        assert len(fcst_items) == 1
        assert fcst_items[0]["mhi_fcst"] == pytest.approx(0.90, abs=1e-2)
        assert fcst_items[0]["horizon_hours"] == 24
        assert fcst_items[0]["forecast_cycle_at"] == cycle_time.strftime("%Y-%m-%dT%H:%M:%SZ")

    # =========================================================================
    # Test 8: B7 does NOT mutate static zone_class with transient triggers
    # =========================================================================
    def test_b7_does_not_mutate_static_zone_class_with_transient_triggers(self, client, db_session):
        """Test 8: Proves B7 does NOT preempt M18.

        Static zone classification (e.g. Caution Zone) remains strictly invariant
        even when an extreme live storm (MHI_live >= 0.75) or forecast (MHI_fcst >= 0.75)
        triggers emergency alerts.
        """
        test_h3 = 0x8860064989fffff
        test_h3_hex = h3_to_str(test_h3)
        valid_time = datetime(2026, 9, 1, 12, 0, 0, tzinfo=timezone.utc)
        cycle_time = datetime(2026, 9, 1, 0, 0, 0, tzinfo=timezone.utc)

        # Baseline: static susceptibility 0.55 -> MHI_static = 0.55 -> Caution Zone (0.45 <= MHI < 0.75)
        self._setup_test_cell(db_session, test_h3, {"landslide": 0.55})

        # Insert extreme live trigger (T = 1.50) -> H = 0.55 * (1 + 1.50) = 1.0 (clamped), MHI_live = 1.0
        db_session.execute(
            text("""
                INSERT INTO hazard_dynamic (h3, hazard_type, valid_at, forecast_cycle_at, trigger_value, source)
                VALUES (:h3, 'landslide', :valid_at, NULL, 1.50, 'IMERG_EARLY');
            """),
            {"h3": test_h3, "valid_at": valid_time},
        )
        # Insert extreme forecast trigger (T = 1.60) -> H = 1.0, MHI_fcst = 1.0
        db_session.execute(
            text("""
                INSERT INTO hazard_dynamic (h3, hazard_type, valid_at, forecast_cycle_at, trigger_value, source)
                VALUES (:h3, 'landslide', :valid_at, :cycle, 1.60, 'ECMWF_OPEN');
            """),
            {"h3": test_h3, "valid_at": valid_time, "cycle": cycle_time},
        )
        db_session.commit()

        # Run B7 pipeline
        proc_result = compute_and_persist_dynamic_snapshots(db_session, valid_at=valid_time)
        assert proc_result.status == "SUCCESS"

        snap = db_session.execute(
            text("SELECT mhi_static, mhi_live, mhi_fcst, zone_class FROM mhi_snapshot WHERE h3 = :h3 AND valid_at = :valid_at;"),
            {"h3": test_h3, "valid_at": valid_time},
        ).mappings().first()

        assert snap is not None
        # Dynamic numerical channels are computed correctly
        assert snap["mhi_live"] == pytest.approx(1.0, abs=1e-2)
        assert snap["mhi_fcst"] == pytest.approx(1.0, abs=1e-2)
        # CRITICAL M18 INVARIANT: zone_class remained CAUTION!
        assert snap["zone_class"] == ZoneClass.CAUTION.value
        assert snap["zone_class"] != ZoneClass.ACTIVE_ALERT.value
        assert snap["zone_class"] != ZoneClass.FORECAST_ALERT.value

        # The cell is still rightfully recognized by dynamic emergency alert endpoints
        res_active = client.get("/alerts/active", params={"min_mhi": 0.75, "limit": 100})
        assert res_active.status_code == 200
        active_items = [x for x in res_active.json()["items"] if x["h3"] == test_h3_hex]
        assert len(active_items) == 1
        assert active_items[0]["mhi_live"] == pytest.approx(1.0, abs=1e-2)

        res_fcst = client.get("/alerts/forecast", params={"horizon": 12, "min_mhi": 0.75, "limit": 100})
        assert res_fcst.status_code == 200
        fcst_items = [x for x in res_fcst.json()["items"] if x["h3"] == test_h3_hex]
        assert len(fcst_items) == 1
        assert fcst_items[0]["mhi_fcst"] == pytest.approx(1.0, abs=1e-2)
