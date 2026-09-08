"""Idempotently create the single national government operations account.

`seed_pilot_data.py` provisions this account (``gov@setu.gov.in``) as part of a
full pilot seed. This helper upserts just that one row into an already-migrated
database (local or the shared Neon instance) without re-running the whole seed.

    uv run python -m pipeline.hazard... no — run as a module job:
    uv run python -m pipeline.jobs.seed_national_account --db-url "<conninfo>"
    TARGET_DB_URL=<conninfo> uv run python -m pipeline.jobs.seed_national_account

The account is a GOVERNMENT_OFFICIAL with ``admin_id = NULL`` — the unconstrained
national scope the auth layer already documents. Password is
``settings.DEMO_OFFICER_PASSWORD``.
"""

from __future__ import annotations

import argparse
import os

import psycopg

from core.config import settings
from core.domain.auth import hash_password

EMAIL = "gov@setu.gov.in"
FULL_NAME = "SETU-DRR National Operations"
ROLE = "GOVERNMENT_OFFICIAL"


def upsert_national_account(conninfo: str) -> None:
    pw_hash = hash_password(settings.DEMO_OFFICER_PASSWORD)
    host = conninfo.split("@")[-1].split("/")[0].split("?")[0]
    with psycopg.connect(conninfo) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_user (
                    id, email, password_hash, full_name, role, admin_id,
                    is_active, created_at, updated_at
                )
                VALUES (gen_random_uuid(), %s, %s, %s, %s, NULL, true, now(), now())
                ON CONFLICT (email) DO UPDATE SET
                    password_hash = EXCLUDED.password_hash,
                    full_name = EXCLUDED.full_name,
                    role = EXCLUDED.role,
                    admin_id = NULL,
                    is_active = true,
                    updated_at = now();
                """,
                (EMAIL, pw_hash, FULL_NAME, ROLE),
            )
            conn.commit()
            cur.execute(
                "SELECT email, role, admin_id, is_active FROM app_user WHERE email = %s",
                (EMAIL,),
            )
            row = cur.fetchone()
    print(f"[{host}] upserted {row[0]} role={row[1]} admin_id={row[2]} active={row[3]}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Upsert the national government operations account")
    parser.add_argument(
        "--db-url",
        default=os.environ.get("TARGET_DB_URL"),
        help="Target connection string (defaults to TARGET_DB_URL, else the configured local DB)",
    )
    args = parser.parse_args()

    conninfo = args.db_url or settings.get_direct_psycopg_conninfo()
    upsert_national_account(conninfo)


if __name__ == "__main__":
    main()
