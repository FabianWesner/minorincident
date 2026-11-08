# L10 farm + audio lane

## Changes

- Reuse D-CURE's authored standing-crop strips as tall, straw-colored dry corn under the existing grass instancing and chunk residency. The stalks are 0.9–2.45 m tall.
- The walkable crop slows the courier to 0.85×. Infected sight range drops from 14 m to 3 m when the infected or player is in a crop strip; hearing and corgi warnings are unchanged. Crop lookup uses a cached 32 m spatial index. No colliders or route geometry changed.
- L10's calm/tension/combat stream selects *Zombie Hoodoo* (`score-tension-L5`), already imported and licensed CC-BY 4.0. A L10 scare stinger event ducks the bed for 1.05 s and reuses the existing twist stinger. Heavy rock is not played during ordinary L10 combat.

## Verification

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- Vitest with a 150 s cap: 106 passed, 1 failed. Existing `tests/tools/gate-tools.test.ts` freshness expectation failed (`STALE`, expected `FRESH`); this is also recorded in the repository lessons for main.
- `npm run qa:accept -- --level L10 --skip-browser`: low/high complete observations completed; low/high stationary runs hit the existing tick budget. Fixture checks had 16 clauses and zero errors per tier. Checkpoint checks had 27 clauses and passed at both tiers. Overall receipt set: 1 fresh failing row and 10 incomplete rows.
- `scene:gate`: attempted through `node --import tsx/esm tools/scenelab/gate-run.ts gate`. All four batches failed to start the browser (0/50 rows); headless Chromium terminated with a macOS MachPort rendezvous error under this sandbox.
- Required zoom/quality route captures and a fresh `r9-l10pace-empty.ts` measurement remain unverified because the headless browser could not launch.

## Scope boundary

The hangar/story rewrite, optional weapons, Mega encounters, farm vignettes, and dead-tree asset belong to other lanes. No new model or audio recording was added. The licensed calm/tension/combat bed is in place; the Mega finale's rock transition still needs coordination with its owning lane.
