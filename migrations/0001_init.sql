-- Anonymous play telemetry (docs/tools/telemetry.md). Apply: wrangler d1 migrations apply mi-telemetry --remote
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  day TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  dur_s INTEGER NOT NULL DEFAULT 0,
  active_s INTEGER NOT NULL DEFAULT 0,
  device TEXT, quality TEXT, backend TEXT, build TEXT, viewport TEXT,
  events INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  reqs INTEGER NOT NULL DEFAULT 0,
  replay_bytes INTEGER NOT NULL DEFAULT 0,
  ended INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sessions_day ON sessions (day);
CREATE INDEX IF NOT EXISTS sessions_player_day ON sessions (player_id, day);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  day TEXT NOT NULL,
  ts INTEGER NOT NULL,
  type TEXT NOT NULL,
  level TEXT, tick INTEGER, x REAL, z REAL,
  data TEXT
);
CREATE INDEX IF NOT EXISTS events_type_day ON events (type, day);
CREATE INDEX IF NOT EXISTS events_level_type ON events (level, type);
CREATE INDEX IF NOT EXISTS events_session ON events (session_id);

CREATE TABLE IF NOT EXISTS replays (
  attempt_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  level TEXT NOT NULL,
  build TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  chunks INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  final INTEGER NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL DEFAULT 'open',
  ticks INTEGER NOT NULL DEFAULT 0,
  samples INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS replays_updated ON replays (updated_at);
CREATE INDEX IF NOT EXISTS replays_level ON replays (level, outcome);
