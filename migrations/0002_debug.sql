-- Sessions started with ?debug are the team's own testing: flagged so public player numbers can exclude them.
-- Apply: wrangler d1 migrations apply mi-telemetry --remote   (or: wrangler d1 execute mi-telemetry --remote --file migrations/0002_debug.sql)
ALTER TABLE sessions ADD COLUMN debug INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN debug INTEGER NOT NULL DEFAULT 0;
