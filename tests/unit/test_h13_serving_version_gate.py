"""H13 — Serving-version gate unit tests.

Tests the ``require_serving_version`` FastAPI dependency in isolation,
mocking the DB session to control serving_version/pipeline_run query
results.  Also includes a representative route-level 503 test and a
health-endpoint liveness check.

These tests run without a PostgreSQL database.
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from typing import Any, Optional
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from core.errors import PipelineNotReadyError, ErrorCode


# ---------------------------------------------------------------------------
# Test helpers — lightweight mock DB session
# ---------------------------------------------------------------------------

def _make_mock_db(row: Optional[dict[str, Any]] = None) -> MagicMock:
    """Return a mock SQLAlchemy Session whose execute().mappings().first()
    returns *row* (or None)."""
    mock = MagicMock()
    result = MagicMock()
    mappings = MagicMock()
    mappings.first.return_value = row
    result.mappings.return_value = mappings
    mock.execute.return_value = result
    return mock


# ---------------------------------------------------------------------------
# A — No serving_version row → PipelineNotReadyError
# ---------------------------------------------------------------------------

class TestNoServingVersion:
    def test_raises_pipeline_not_ready(self):
        from api.dependencies import require_serving_version
        mock_db = _make_mock_db(row=None)

        with pytest.raises(PipelineNotReadyError) as exc_info:
            require_serving_version(db=mock_db)

        assert exc_info.value.code == ErrorCode.PIPELINE_NOT_READY
        assert exc_info.value.status_code == 503


# ---------------------------------------------------------------------------
# B — Pipeline status RUNNING → PipelineNotReadyError
# ---------------------------------------------------------------------------

class TestRunningPipeline:
    def test_raises_pipeline_not_ready(self):
        from api.dependencies import require_serving_version
        mock_db = _make_mock_db(
            row={"pipeline_run_id": uuid.uuid4(), "status": "RUNNING"},
        )

        with pytest.raises(PipelineNotReadyError) as exc_info:
            require_serving_version(db=mock_db)

        assert exc_info.value.code == ErrorCode.PIPELINE_NOT_READY
        assert exc_info.value.status_code == 503


# ---------------------------------------------------------------------------
# C — Pipeline status FAILED → PipelineNotReadyError
# ---------------------------------------------------------------------------

class TestFailedPipeline:
    def test_raises_pipeline_not_ready(self):
        from api.dependencies import require_serving_version
        mock_db = _make_mock_db(
            row={"pipeline_run_id": uuid.uuid4(), "status": "FAILED"},
        )

        with pytest.raises(PipelineNotReadyError) as exc_info:
            require_serving_version(db=mock_db)

        assert exc_info.value.code == ErrorCode.PIPELINE_NOT_READY
        assert exc_info.value.status_code == 503


# ---------------------------------------------------------------------------
# D — Pipeline status READY → returns pipeline_run_id
# ---------------------------------------------------------------------------

class TestReadyPipeline:
    def test_returns_pipeline_run_id_for_READY(self):
        from api.dependencies import require_serving_version
        run_id = uuid.uuid4()
        mock_db = _make_mock_db(
            row={"pipeline_run_id": run_id, "status": "READY"},
        )

        result = require_serving_version(db=mock_db)
        assert result == run_id

    def test_refuses_COMPLETED_status(self):
        """Per H13, only READY is a valid servable state. COMPLETED must raise PipelineNotReadyError."""
        from api.dependencies import require_serving_version
        from core.errors import PipelineNotReadyError
        run_id = uuid.uuid4()
        mock_db = _make_mock_db(
            row={"pipeline_run_id": run_id, "status": "COMPLETED"},
        )

        with pytest.raises(PipelineNotReadyError) as exc_info:
            require_serving_version(db=mock_db)
        assert exc_info.value.status_code == 503


# ---------------------------------------------------------------------------
# E — Deterministic selection
# ---------------------------------------------------------------------------

class TestDeterministicSelection:
    """The serving_version table uses dataset_name as PRIMARY KEY.

    There can be at most one row per dataset name, so the implementation
    should not use LIMIT 1 or ORDER BY to resolve ambiguity — the query
    is already deterministic by schema constraint.
    """
    def test_query_targets_default_dataset(self):
        from api.dependencies import require_serving_version
        run_id = uuid.uuid4()
        mock_db = _make_mock_db(
            row={"pipeline_run_id": run_id, "status": "READY"},
        )

        require_serving_version(db=mock_db)

        # Verify the executed SQL contains the expected dataset_name filter
        call_args = mock_db.execute.call_args
        sql_text = str(call_args[0][0])
        assert "dataset_name = 'default'" in sql_text


# ---------------------------------------------------------------------------
# F — Route-level 503 via TestClient
# ---------------------------------------------------------------------------

class TestRouteLevelGate:
    """Builds a minimal FastAPI app with the dependency to verify 503 HTTP
    propagation through the middleware."""

    def _build_app(self, mock_db: MagicMock) -> FastAPI:
        """Build a minimal FastAPI app with the gate dependency wired up."""
        from api.dependencies import get_db, require_serving_version

        app = FastAPI()

        def _override_db():
            yield mock_db

        app.dependency_overrides[get_db] = _override_db

        @app.get("/test-gated")
        def gated_endpoint(
            _sv: uuid.UUID = Depends(require_serving_version),
        ):
            return {"status": "ok"}

        # Register the AppError handler like the real middleware does
        from core.errors import AppError
        from fastapi.responses import JSONResponse

        @app.exception_handler(AppError)
        async def app_error_handler(request, exc):
            return JSONResponse(
                status_code=exc.status_code,
                content=exc.to_dict(),
            )

        return app

    def test_returns_503_when_no_serving_version(self):
        mock_db = _make_mock_db(row=None)
        app = self._build_app(mock_db)
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.get("/test-gated")

        assert resp.status_code == 503
        body = resp.json()
        assert body["error"]["code"] == "PIPELINE_NOT_READY"

    def test_returns_200_when_serving_version_ready(self):
        run_id = uuid.uuid4()
        mock_db = _make_mock_db(
            row={"pipeline_run_id": run_id, "status": "READY"},
        )
        app = self._build_app(mock_db)
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.get("/test-gated")

        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    def test_returns_503_when_pipeline_running(self):
        mock_db = _make_mock_db(
            row={"pipeline_run_id": uuid.uuid4(), "status": "RUNNING"},
        )
        app = self._build_app(mock_db)
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.get("/test-gated")

        assert resp.status_code == 503

    def test_returns_503_when_pipeline_validating(self):
        mock_db = _make_mock_db(
            row={"pipeline_run_id": uuid.uuid4(), "status": "VALIDATING"},
        )
        app = self._build_app(mock_db)
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.get("/test-gated")

        assert resp.status_code == 503

    def test_returns_503_when_pipeline_failed(self):
        mock_db = _make_mock_db(
            row={"pipeline_run_id": uuid.uuid4(), "status": "FAILED"},
        )
        app = self._build_app(mock_db)
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.get("/test-gated")

        assert resp.status_code == 503

    def test_returns_503_when_pipeline_superseded(self):
        mock_db = _make_mock_db(
            row={"pipeline_run_id": uuid.uuid4(), "status": "SUPERSEDED"},
        )
        app = self._build_app(mock_db)
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.get("/test-gated")

        assert resp.status_code == 503

    def test_returns_503_when_pipeline_completed(self):
        mock_db = _make_mock_db(
            row={"pipeline_run_id": uuid.uuid4(), "status": "COMPLETED"},
        )
        app = self._build_app(mock_db)
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.get("/test-gated")

        assert resp.status_code == 503


# ---------------------------------------------------------------------------
# G — Health endpoints are NOT gated
# ---------------------------------------------------------------------------

class TestHealthNotGated:
    """Verifies that health endpoints remain accessible regardless of
    serving version state.  Uses the real app to confirm the routes
    are not decorated with require_serving_version."""

    def test_health_live_reachable_without_db(self):
        """The /health/live endpoint is pure process-liveness and must
        never touch the database or the serving-version gate."""
        from api.main import app
        from api.dependencies import get_db

        # Override get_db to explode — proves the endpoint never calls it
        def _exploding_db():
            raise RuntimeError("get_db should not be invoked for /health/live")
            yield  # pragma: no cover

        app.dependency_overrides[get_db] = _exploding_db
        client = TestClient(app, raise_server_exceptions=False)

        try:
            resp = client.get("/health/live")
            assert resp.status_code == 200
            body = resp.json()
            assert body["status"] == "ok"
        finally:
            app.dependency_overrides.pop(get_db, None)

    def test_health_ready_reachable_without_serving_gate(self):
        """The /health/ready endpoint performs diagnostic checks and must
        not be gated by require_serving_version (it reports status even if no SV)."""
        from api.main import app
        from api.dependencies import get_db
        from unittest.mock import MagicMock

        # Mock DB that satisfies readiness checks
        mock_db = MagicMock()
        mock_res1 = MagicMock()
        mock_res2 = MagicMock()
        mock_res2.fetchall.return_value = [("postgis",), ("h3",), ("h3_postgis",)]
        mock_res3 = MagicMock()
        mock_res3.scalar.return_value = None
        mock_db.execute.side_effect = [mock_res1, mock_res2, mock_res3]

        def _mock_db_gen():
            yield mock_db

        app.dependency_overrides[get_db] = _mock_db_gen
        client = TestClient(app, raise_server_exceptions=False)

        try:
            resp = client.get("/health/ready")
            # Must return 200 (or reach the endpoint without 503 PipelineNotReadyError)
            assert resp.status_code == 200
            body = resp.json()
            assert body["status"] == "ready"
        finally:
            app.dependency_overrides.pop(get_db, None)

    def test_root_endpoint_reachable_without_db(self):
        """The / root metadata endpoint must also not be gated."""
        from api.main import app
        from api.dependencies import get_db

        def _exploding_db():
            raise RuntimeError("get_db should not be invoked for /")
            yield  # pragma: no cover

        app.dependency_overrides[get_db] = _exploding_db
        client = TestClient(app, raise_server_exceptions=False)

        try:
            resp = client.get("/")
            assert resp.status_code == 200
            body = resp.json()
            assert body["name"] == "SETU-DRR API"
        finally:
            app.dependency_overrides.pop(get_db, None)
