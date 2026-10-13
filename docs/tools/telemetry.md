# Play telemetry and replays

Anonymous play analytics plus input-log replays (PO decision 2026-10-12: always on, no notice, no opt-out). Real players of the live
site send events and the per-tick input stream of every level attempt; agents read stats and replay attempts headless.

## What is collected

Client code: `src/telemetry/`. Never sent: IP addresses (the server does not store them), full user-agent strings, names, free text.

| Field | Value |
| --- | --- |
| player id | random UUID in `localStorage` key `mi.pid` (no cookies); a per-session id if storage throws |
| session id | random UUID per page load |
| context | device class (`desktop`/`phone`/`tablet`), quality tier, backend (`webgl`/`webgpu`), build commit, viewport bucket (rounded to 160 px) |
| events | `session_start`, `heartbeat` (30 s), `session_end`, `level_start`, `level_complete`, `level_restart`, `death` (level, tick, x/z, cause archetype), `quit` (level, tick, why = `home`/`close`/`next`), `checkpoint`, `weapon_pickup`, `perf` (every 2nd beat: frame p50/p95 ms, sim ms, draw calls) |
| replay | per level attempt: the input frame the sim consumes for every fixed tick (delta/RLE, float64, gzip), plus campaign save at level start, seed, level, quality, build, viewport |

Batches go out every 30 s and on `visibilitychange`/`pagehide` (`navigator.sendBeacon`). Telemetry is off for `?test`, `?scenelab`,
the other tool flags (`inspect`, `motionlab`, `perf`, `lookdev`), local hosts and webdriver (`?debug=true` still sends: the PO plays PROD with it for the pause-menu build/tick panel, 10-13) (so automation never pollutes PROD). `?telemetry=record` keeps the log in memory without any network (replay
tests); `?telemetry=live` forces sending (local wrangler checks).

## Backend

Cloudflare Pages Functions in `functions/api/` (shared code in `functions/_lib/telemetry.ts`), bindings in `wrangler.toml` for production only:

| Resource | Id |
| --- | --- |
| D1 database `mi-telemetry` (binding `DB`) | `5592c62b-468c-498a-b724-fcc6d692ae90` (tables `sessions`, `events`, `replays`, schema in `migrations/0001_init.sql`) |
| R2 bucket `mi-replays` (binding `REPLAYS`) | objects `<day>/<attempt>/<seq>.gz` |
| Pages secret `TELEMETRY_READ_TOKEN` | production env of project `minor-incident`; the same value is in the repo `.env` |

QA (`BRANCH=qa`) deploys have no bindings: `/api/t` and `/api/replay` answer 503 and the client switches itself off, so QA never mixes with real players.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/t` | event batch (strict schema: unknown types/fields/values reject the whole request) |
| `POST /api/replay?a=&p=&s=&n=&l=&b=[&f=1&o=outcome&t=ticks&m=samples]` | one gzip chunk of a replay (<= 256 KB), idempotent per `a`/`n` |
| `GET /api/stats?token=…&days=14` | JSON: players per day, sessions, session length distribution, level funnel (start/complete/restart/quit, median clear time), deaths and quits per level with 5 m grid positions and causes, perf per device class, devices, builds |
| `GET /api/replays?token=…[&level=L1&outcome=quit&limit=50]` | recent replays; `&id=<attempt>` lists its chunks, `&id=…&chunk=<n>` streams one raw gzip chunk |

Abuse limits (per session unless noted): 6000 events, 1.5 MB event bytes, 2500 requests, 24 MB of replay data, 100-event and 48 KB batches,
120 new sessions per player and day, session ids bound to one player id. Cloudflare rate-limiting rules at the edge are the right place
for anything stronger. There is no retention job; to purge: `DELETE FROM events WHERE day < '2026-…'` (and the same for `sessions`/`replays`), and delete R2 prefixes.

Setup (done once): `wrangler d1 create mi-telemetry`, `wrangler r2 bucket create mi-replays`, `wrangler d1 execute mi-telemetry --remote --file migrations/0001_init.sql`,
`wrangler pages secret put TELEMETRY_READ_TOKEN --project-name minor-incident`. The deploy is unchanged (`epics-pipeline/deploy.sh` →
`wrangler pages deploy dist --project-name minor-incident`); wrangler picks up `functions/` and `wrangler.toml` from the repo root.

## Reading stats

```
npm run telemetry:stats -- --days 14            # readable report (token from TELEMETRY_READ_TOKEN env or the repo .env)
npm run telemetry:stats -- --days 7 --json
npm run telemetry:stats -- --replays --level L1 --outcome quit --limit 20
curl "https://minor-incident.com/api/stats?token=$TELEMETRY_READ_TOKEN&days=7"
```

## Replaying a session

```
npm run replay -- <replay-id | bundle.json> [--shots 12] [--video out.webm --from 120 --seconds 12 --fps 12] [--save bundle.json] [--out dir]
```

The tool downloads the log (or reads a saved bundle), warns if the build commit differs from `HEAD`, starts a private Vite server (port 3342, never 3300),
loads the level headless with the saved campaign, seed, quality and viewport, and feeds the recorded input tick by tick. Output (`<out>/summary.json`, also on stdout):
deaths with positions and ticks, time per objective, checkpoints, pickups, stalls (>= 12 s within 1.5 m), distance travelled, result, state hash, plus screenshots
(evenly spaced, one second before each death, at each objective) and an optional WebM window for QA agents. It checks out nothing: use the commit named in the warning to compare.
Wrapped in `tools/e2e-lock.sh` by the npm script.

## Determinism

The sim is deterministic from the recorded inputs plus a handful of between-tick commands, which the log carries at the sample where they happened:
mission begin / retry / continue (UI buttons), wheel/pinch zoom, quality tier changes, viewport resizes (the spawn frustum depends on the aspect).
Pause-menu frames are consumed but do not tick, exactly as live.

Findings (details in the final report of the lane):

* No `Math.random`, wall clock or render state is read by `src/sim` or `src/core`.
* One real leak: the infected spawn director gated spawns on the camera frustum taken from the render camera, which includes presentation-only offsets.
  The L1 lab accident pulls the camera on **wall-clock render seconds** (`LabAccidentFx.advance` from `GameView.frame`), so a real-time run and a stepped replay
  spawned street infected on different ticks (first divergence at tick 4176 of an L1 run; props, NPCs and the player followed). Fix: `View.simCamera`, the follow rig from
  tick-driven state only (focus, zoom, driving, cinematic blend), without pull, shake and roll; `Game.simTick` builds the frustum from it.
* Tests: `tests/e2e/telemetry-replay.spec.ts` (real keyboard/mouse/wheel/resize L1 run; L1 bot runs with the outbreak, fights and deaths to the result screen; a 6x real-time ticker run).
  Each asserts the same player path (exactly 0 delta, tolerance 5 cm), deaths, objective ticks, level result and canonical state hash after replay in a fresh page.
* Not covered: phones/touch (the `coarse` flag is recorded and replay warns), `quality=auto` mid-run tier changes (recorded as commands, not exercised), retry-phase restores.
  `diagnose()` on the replay test API (`window.__SS__.replay.diagnose()`) returns per-subsystem and per-entity hashes to find which part diverged first.

## Cost

Recording is one `InputLogEncoder.add` per fixed tick: about 0.5 µs (worst case of a random stream, no allocation); chunks are cut every 30 s and at 160 KB raw, gzip runs async.
Typical size: a 3 minute L1 bot run is 65 KB gzipped; a mouse-heavy run is a few KB per minute of float64 aim data.
