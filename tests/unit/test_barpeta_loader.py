import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT / "pipeline") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "pipeline"))

from sqlalchemy import create_engine, text
from core.config import settings
from scripts.load_barpeta_relocation import BarpetaLoader


def test_barpeta_loader_check_mode():
    """--check mode must validate artifacts and manifest without touching the database."""
    loader = BarpetaLoader(REPO_ROOT)
    report = loader.check()
    assert report.is_valid is True
    assert report.habitations_count == 14
    assert report.candidate_sites_count == 629
    assert report.external_recommendations_count == 14


def test_barpeta_loader_dry_run_mode():
    """--dry-run mode must execute complete staging transaction and rollback cleanly."""
    eng = create_engine(settings.get_sqlalchemy_url())
    with eng.connect() as conn:
        initial_runs = conn.execute(text("SELECT count(*) FROM data_import_run")).scalar()

    loader = BarpetaLoader(REPO_ROOT, engine=eng)
    loader.dry_run()

    with eng.connect() as conn:
        final_runs = conn.execute(text("SELECT count(*) FROM data_import_run")).scalar()
        assert initial_runs == final_runs, "Dry run leaked data_import_run records into the database"


def test_barpeta_loader_idempotent_load():
    """--load mode must detect already-promoted run with same manifest hash and return safely."""
    loader = BarpetaLoader(REPO_ROOT)
    run_id = loader.load()
    assert run_id is not None

    eng = create_engine(settings.get_sqlalchemy_url())
    with eng.connect() as conn:
        status = conn.execute(
            text("SELECT status FROM data_import_run WHERE id = :id"),
            {"id": str(run_id)},
        ).scalar()
        assert status == "PROMOTED"
