"""Deterministic Pilot Data Seeding Script (Day 2).

CLI wrapper for pipeline.jobs.seed_pilot_data.
"""

from pipeline.jobs.seed_pilot_data import seed_database

if __name__ == "__main__":
    seed_database()
