# s147 L4 cellar escape

## Finding

The batch-113 real-input evidence showed repeated deaths after the cellar objective appeared, at the line-break checkpoint. HIGH had 24 death/input-release events and LOW had 25. The objective text and marker already pointed at the cellar, but the checkpoint was at `(-4, 16)`, beside the collapsed army perimeter, rather than on the authored Lakeshore escape road. Restoring that checkpoint therefore repeatedly put a mortal player at the camp edge. The escape gap lasted 40 seconds while the authored route loops through Lakeshore, Metro Road and Harbor Street to Kessler's cellar.

The existing gap logic diverts infected away from the route while keeping the horde, Alphas and combat rules intact. The problem was its route-start placement and duration, not a lack of enemies or zombie tuning.

## Change

- Moved the line-break checkpoint from `(-4, 16)` to `(-4, 28)`, the first open Lakeshore route leg beyond the perimeter.
- Extended the existing army diversion window from 40 to 75 seconds. Retry restoration continues to reopen the window; ordinary respawn grace remains in place.
- Added a fixed-seed HIGH native regression requiring the skilled mortal L4 bot to finish with at most three deaths during the escape phase, while confirming infected remain alive at line break.
- No wave sizes, Alpha counts, infected stats, corpses, or playtest tools changed.

## Evidence

The L4 native skilled bot completed a baseline HIGH run with 13 total deaths, including five in the escape phase; LOW completed with 8 total deaths, including one escape-phase death. Candidate probing showed that a 75-second gap alone still timed out at the original checkpoint. The combined outer checkpoint and 75-second gap completed the fixed-seed HIGH run with 11 total deaths, including exactly three after line break.

The new focused regression passed under Vitest and proves completion, exactly three collapse-phase deaths for this seed, and a non-empty infected horde at line break. It uses the existing native `loadL4` / `runL4` skilled bot, with no immortality or route teleport.

Reviewed sheet: [corpse-persistence-sheet.jpg](corpse-persistence-sheet.jpg), a HIGH WebGL2 civilian/corpse sequence. The corpses remain present through the later frames, consistent with the persistent-corpse rule.

## Validation

- Focused native regression: passed (1 passed, 1 unrelated test skipped by name filter; 61.87 s).
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Required `sh tools/remote/run.sh "$PWD" -- npm test`: not admitted. The remote runner reported no healthy Hetzner runner and refused the local Mac slot for this queued job (exit 69); this was not a runner timeout.
- HIGH/LOW real-input browser confirmation remains open. Batch-113's browser admission had failed before browser start with `EPERM` binding the browser-pool port. No browser was started in this change.

## Remaining uncertainty

The fixed-seed native skilled bot reaches the cellar within three escape-phase deaths, but it still records eight deaths in the preceding HIGH defense. The raw real-input captures do not identify a specific killing infected reliably, so attribution by infected identity and origin remains unresolved. The real-input HIGH and LOW confirmations are still needed to establish the competent-player target beyond this native regression.

## Follow-up validation

Committed initial change as `35cd62ba`. Folded the escape regression into the existing L4 contact test to retain the 150-case suite budget. The first remote run then timed out at 240 seconds; rerun unchanged as requested. HIGH real-input confirmation ran on ports 5031/5032 through the browser pool, mortal with ordinary combat: it failed to finish after 480 seconds and 28 deaths. Its logs are in `test-results/playtest/campaign-high-2026-11-161422`. The automatically started second segment was stopped. This contradicts completion of the target; further route/checkpoint design work is required. Three native escape deaths also mean success on the fourth attempt, so the initial native regression is insufficient to establish the approximately three-attempt goal.

The unchanged remote rerun also timed out at 240.4 seconds (exit 124). No tests were trimmed. The full suite remains unverified.

## Route marker diagnosis

The current HIGH log contains 191 hide observations. A 5 m observation heatmap (JSON) clusters 73 samples at (-15,10), back inside the camp. The first hide observation is at (-4,28), with a direct marker at (-79.3,-45.28); the next observation moves northwest to (-7.43,24.57). The intended route instead starts south to Lakeshore. Updated the L4 hide marker to follow the existing authored route corners, including its final door point. This directly addresses the misleading bearing; native and browser verification of this follow-up remains pending. The heatmap counts observations, not independently attributed deaths.

Native marker probe confirms checkpoint (-4,28) points south to (-4,43). Bounded HIGH browser follow-up did not finish in 480 seconds, but inspection found the default driver reads `def.anchors[state.marker]` directly (session.ts markerRing) and bypasses displayed route guidance. Its strict `PLAYTEST_VISIBLE_ONLY=1` mode instead reads the actual minimap pin. Strict visible-pin HIGH/LOW confirmation is pending; no playtest code was edited.

Strict visible-input HIGH did not finish in 480 seconds. It escaped the camp with full HP (tick14147, -4,41.49), confirming improved bearing, but stopped near the first corner marker until killed (tick21010, -4.01,42.38). Added a 3 m corner arrival tolerance so entering the marker area reveals the next street leg. This follow-up still requires gameplay revalidation.
