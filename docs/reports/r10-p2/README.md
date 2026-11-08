# r10-p2 — vqa60 P2s and L8 opening objective

## Changes

- **L6 exit regroup:** the exit still waits for living survivors, but regroup text now names the alarmed follower (when still following) or nearest living follower and gives their distance. The HUD keeps a direct pin/edge cue on that follower throughout the regroup state, instead of relying on the five-second attack banner.
- **L9 crash pose:** the held-weapon visibility rule now covers the complete scripted fall/impact/crawl phases, generic player knockdown/get-up/death states, and active knockdowns. Weapon aiming is disabled for the same downed interval.
- **L8 opening:** the sanctuary opening now displays “Stay with the group” while retaining the 60-second calm and no waypoint. Removed the HUD branch that hid the tracker after five seconds. Updated E30-AC04 and its matching scope text because its previous “no objective” requirement contradicted the requested opening objective.

## Verification

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `node node_modules/vitest/vitest.mjs run tests/engine/missions.test.ts --project default --configLoader runner --maxWorkers=4` — pass, 6/6.
- `npm test` — 106/107 tests pass; the existing `tests/tools/gate-tools.test.ts` source-digest assertion fails because this review compares the uncommitted modified source against `HEAD`. Reproduced after the first run; it needs a post-commit run.
- `npm run build:qa` — pass.
- `npm run qa:accept -- --level L6 --skip-browser` — native complete probes, fixtures (8 clauses per tier), and all 14 checkpoint probes completed; report assembly failed because this sparse worktree lacks archived `docs/reports/fix51-verify/receipts/L6-low-complete.json`, required by `tools/qa/accept/reviews.ts`. Generated tracked L6 receipts were restored to their original contents.
- `npm run qa:accept -- --level L8 --skip-browser` — zero fresh failing rows; 10 incomplete rows. Native probes, four fixture clauses per tier, and all six checkpoints passed.
- `npm run qa:accept -- --level L9 --skip-browser` — zero fresh failing rows; 8 incomplete rows. Native probes, five fixture clauses per tier, and all four checkpoints passed.
- `npm run qa:threat` — pass, zero flags across all ten levels (220.4 s). L6, L8, and L9 each have zero level flags.
- Requested low/high visual matrix and real-input repros remain unverified: the headless runner could not bind its local preview server (`listen EPERM 127.0.0.1`) under this sandbox.

## Outstanding

The job brief requires captures opened at low/high and zoom 1/1.5, real-input before/after repros, `qa:accept` for L6/L8/L9, and a separate commit per fix. L8/L9 acceptance reports have incomplete rows; L6 report assembly lacks archived review evidence. Local browser-server creation is denied by the current sandbox, and the shared Git metadata is read-only here (a `git checkout` restoration attempt was denied creating `.git/worktrees/r10-p2/index.lock`). Visual captures and commits still need an environment with local browser and Git metadata access.
