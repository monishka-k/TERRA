# ADR 0001 — Neon, not Supabase, as the database host

**Status:** accepted · 2026-08-29

## Context

We need hosted Postgres. The PRD (§9.7) assumes PostgreSQL 16 + PostGIS 3.4 with
the `h3` and `h3_postgis` extensions, and FR-2.5 builds coarse-resolution
materialised views with `h3_cell_to_parent()`.

Supabase was the first candidate. Its Postgres build manifest
(`supabase/postgres` → `nix/ext/`) ships 39 extensions including `postgis`,
`gdal` and `pgrouting` — **but not `h3` or `h3_postgis`**; the request has been
open since 2022, and Supabase Cloud does not permit arbitrary extensions.
Adopting it would have meant computing H3 in Python and storing precomputed
parent columns, abandoning FR-2.5 as written.

## Decision

Use Neon. It supports `h3` and `h3_postgis` (4.1.3–4.2.3), `postgis`,
`postgis_raster`, `pg_partman` and `pg_cron`, so §9.7 and FR-2.5 work unmodified.

The deciding argument is not only h3. PRD §2.2 lists as an explicit non-goal:
*"Authentication, RBAC, or audit logging beyond a demo stub."* There is no login,
no user account, no RLS and no realtime anywhere in the document. Supabase's
value over plain Postgres is Auth + RLS + Realtime + Storage — four things this
PRD forbids. Accepting an architectural compromise to obtain features we are
told not to build is the wrong trade. This is a pure Postgres workload.

Neon's branching is a secondary gain: branch the database, run a pipeline
experiment, discard it.

## Consequences

- **Plan.** The free tier is unusable — 0.5 GB storage against a ~1.8 GB
  `hazard_dynamic`, and scale-to-zero cannot be disabled, so a cold start would
  land on the demo. Launch tier, scale-to-zero off. At $0.35/GB-month this is
  also cheaper than Supabase Pro's $25 flat.
- **Scheduling stays APScheduler.** `pg_cron` exists on Neon but only fires while
  compute is active, which does not survive scale-to-zero. PRD §9.7 already chose
  APScheduler; that stands.
- **Connection string.** Use the direct, non-pooled host. Martin and SQLAlchemy
  rely on prepared statements, which the pooler does not support.
- **No bundled migration tool.** `infra/migrate.sh` applies numbered SQL files
  from `infra/migrations/` and records them in `schema_migrations`. The schema is
  defined once in §9.5, so this is enough; alembic was removed deliberately.
- **No object storage** for FR-1.2's raw-response cache. Local `data/raw/` for
  the build window; revisit before any deployment.
- **Local dev** is `infra/docker-compose.yml`, which builds Postgres 16 + PostGIS
  3.4.3 + h3 4.2.3 to match Neon. This is also the demo target, since NFR-4
  requires zero live external calls and a hosted database is one.
