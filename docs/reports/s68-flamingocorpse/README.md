# s68 — flamingo corpses and flock count

## Change

L8 infected flamingos can die during their authored flight. Their corpse search previously began at the airborne transform and the shared placement fallback could accept vertical layers when no nearby free footprint was found. Flamingo corpse layout now starts at the support surface below the death position and rejects overlapping footprints, continuing its outward search instead of stacking bodies. Corpses remain permanent. The change is confined to corpse presentation and the existing L8 arena objective text; no layout or balance data changed.

Phase 2 now appends the living flock count to the objective status, for example `Flamingo flock · Phase 2 · 5 left`.

## Checks

- Focused corpse layout fixture: **passed**. Twenty-six infected flamingos killed at 3.1 m resolve to ground Y 0; all twenty-six placements are retained, have zero overlapping corpse footprints, and pairwise centers stay more than 0.6 m apart. Twenty-six matches the authored original flock plus three six-bird flights.
- Focused L8 mission integration assertion: **passed**. With three of eight birds dead, the objective reads `Follow Nadia to the central plaza · Flamingo flock · Phase 2 · 5 left`.
- `npm run typecheck`: **passed**.
- `npm run lint`: **passed**.
- `git diff --check`: **passed**.
- Required remote `sh tools/remote/run.sh "$PWD" -- npm test`: **not run**. Runner returned exit 69 because there is no healthy Hetzner runner running or provisioned; it reports the Mac local slot cannot run this wrapped command.
- Requested LOW pond capture at zoom 1 and 1.5: **not captured yet**. The locked headless browser pool failed to start when its local service bind returned `listen EPERM` on port 4329. The capture must still be opened and visually reviewed after browser-pool access is available.
- Commit: **not created**. Explicit staging was rejected because Git could not create the common worktree `index.lock` (`Operation not permitted`); the sandbox exposes this worktree's `.git` metadata as read-only. The source and report remain in the worktree unstaged.

## Open

The unit/native check verifies ground-relative Y and footprint separation through the production corpse layout. Runtime visual confirmation of the actual L8 pond at both requested zooms and the full remote unit suite remain open. No deployment, push, or main worktree changes were made.
