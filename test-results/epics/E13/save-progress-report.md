# Campaign persistence fix — 2026-10-10

Implementation: `4fefe4fa`; campaign test corrections: `01fd4226`, `d53a36c7`.

Completion previously persisted only after the result screen's Continue. The title's
Start game path also created a fresh campaign during character selection, resetting
the unlocked level. Completion now records rewards, completed/unlocked levels, and
aftermath synchronously on `level.completed`, before navigation or level unload.
Start game opens the saved level selection when a campaign exists.

Save version 2 retains the existing storage key. Version 1 migrates without losing
world data, results, survivors, equipment, or settings; version 0 remains supported.
L1 player-caused props, gates, dumpsters, bodies, and bicycle poses stay in `world.L1`;
L2 consumes that record and always applies the scripted burned annex/outbreak-house
aftermath. L5 rescued survivors remain in both its result and the survivor list L6
consumes. Results for every completed level are saved. Replays update aftermath
without granting rewards twice. Missing aftermath uses the existing level defaults.
Blocked storage retains the existing try/catch fallback.

Validation:

- Typecheck, lint, and production build: PASS.
- Remote unit suite: 129 files, 447 tests passed.
- `npm run verify -- E13`: PASS; 25 simulation/unit checks and 35 browser checks
  passed, including desktop, mobile, and WebKit smoke. Two existing tests for
  removed reward screens remain skipped. Browser automation was headless and
  limited to two workers, using `tools/e2e-lock.sh` and an isolated preview port.
- New browser regression finishes L1 through the cheat path, reloads directly from
  the result screen before Continue, verifies L1/L2 enabled and L3 locked, selects
  L2, and verifies the saved L1 gate is closed in the actual L2 simulation.
- Unit coverage checks L1 unlock/aftermath round trip, replay reward idempotence,
  v1 migration with/without aftermath, L5 survivor persistence, and corrupt data.
- The existing campaign tests had stale assertions for the old L1 generic result
  title and ambient population. They now check the authored result title and the
  restored player avatar. All four affected browser tests passed on recheck.

The verification rerun initially hit a full disk while copying a remote job. The
remote unit suite and first E13 simulation run had passed; the final complete E13
verification used the local simulation lock with one worker and passed.

No specification changes. The full optional level playthrough suite was not run.
Main was merged into this worktree before delivery; no deployment or merge to main.
Machine-readable evidence: `save-progress-checks.json`.
