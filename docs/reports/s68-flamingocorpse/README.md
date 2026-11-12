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
- Required remote `sh tools/remote/run.sh "$PWD" -- npm test`: **passed**, exit 0 on 94.130.181.173. 27 files passed, 106 tests passed / 1 skipped; 150/150 registered cases. Budget receipt: **238.4 s / 240 s** (Vitest 234.18 s). The first attempt exposed a 151-case budget violation; the new assertions were merged into the existing corpse test without dropping coverage, then the full suite passed.
- LOW pond capture: **opened and reviewed** at zoom 1 and 1.5. [Review sheet](pond-review.jpg). A controlled actual-L8 fixture spawned 26 production infected flamingos at flight Y 3.1, permanently settled them, then photographed the paused pond. Bodies spread horizontally around the courier with no vertical column; some silhouettes overlap in projection. Headless WebGL2/Metal through the browser pool, private port 4939; zero console errors. This is a controlled death fixture, not a full fight playthrough.
- Code committed as `43843dd3`. The earlier sandbox restriction is resolved.

## Result

The unit/native check verifies ground-relative Y and footprint separation through the production corpse layout. All requested focused checks, typecheck, lint, full remote unit suite and opened LOW pond captures are complete. No deployment, push, or main worktree changes were made.
