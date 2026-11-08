# L10 story and stalker lane

Status: implementation is in progress; completion is blocked by worktree and runner access.

## Changes

- Reworked L10 objectives around the river escape, farms, restricted zone, safe hangar and dispersal route. Removed the depot reunion objective and the checkpoint-based weapon checklist.
- Added retained, one-time weapon pickups for the farmhouse rifle, barn machete, workshop nail gun, shed Molotov, guard-tower assault rifle and checkpoint flashbang.
- Added the experimental flamethrower action and return of the campaign/L10 arsenal during the cure handoff. The current weapon model and effect presentation are placeholders; a dedicated flamethrower model and fire-cone VFX should be supplied by the asset lane.
- Updated L10 dialogue to use the lines in `docs/design/story-script.md`; increased Mega cruise speed to 1.05× nominal run speed, retained gap/alternate-route pursuit behavior, showed its pulsing red minimap marker and hid its health bar until the cure is installed.
- Reduced L10 route-region durations to 15 minutes total, removed the infected group nearest the cure terminal, and updated the L10 acceptance rows for PO 2026-11-08.

## Validation

- `npm run lint`: passed after the latest edits.
- `git diff --check`: passed.
- D-CURE route-data check: passed (seven regions total 15 minutes; all six weapon anchors are present).
- `npm run typecheck`: passed before the final weapon-order and dialogue punctuation edits; remote rerun is still required.
- Unit suite: a local run was stopped at 100.7 seconds after the orchestrator directed all heavy commands to Hetzner. Before interruption, it reported failures in `tests/tools/gate-tools.test.ts` (freshness expectation) and `tests/engine/input.test.ts` (the new action was not yet in `weaponOrder`). The weapon-order entry has since been added; the suite has not been rerun.
- `qa:accept --level L10 --skip-browser`: an earlier local run, before the route/story corrections in this report, failed three bot-completion rows. The bots stalled around x=819 before the then-current depot target. A corrected acceptance run is still required.
- `qa:threat -- --levels L10`: not run.
- Browser QA needed: no browser run was made, per the lane instruction.

## Blockers and follow-up

- The requested `main` merge and lane commit could not run. Git failed creating `.git/worktrees/eg-l10-story/index.lock` because the worktree’s `.git` directory is read-only. The binding `docs/design/story-script.md` was copied from `main` into this worktree and applied to L10, but the other `main` changes have not been merged.
- The remote runner wrapper was started with `MI_LOCAL_FALLBACK=0`. Its Hetzner pool lookup failed at DNS resolution in this sandbox, so it was stopped without running the typecheck locally. The unit suite, L10 acceptance and threat audit must be rerun through `sh tools/remote/run.sh "$PWD" -- <command>` when runner DNS/network access is available.
- The hangar’s physical enclosure, researchers/guards, indoor terminal/canister placement and collision-safe boundary belong to adjacent dressing lanes and remain unverified here. This lane removed the hostile group nearest the handoff point; the dressing lane still needs to confirm that the terminal and cure are indoors and the Mega cannot enter the safe space.
