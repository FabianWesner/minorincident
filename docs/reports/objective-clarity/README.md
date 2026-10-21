# Objective clarity — PO real-input findings, 2026-10-21

Branch: `lane/objective-clarity`, based on `93e1fbea8`. Final runtime: `05f1d022e`. Required `lane/l6-tunnel` merge: `1cb6eab5a`. Also merged `lane/p3-ui` through `d9389b3b5`; retained its current-gate panel filtering, blocked-destination handling and Metro ring removal after shutter closure. The merged click fallback also needed a correction: a clear destination behind a corner must remain exact; the nearest-cell fallback applies only to a point inside a solid. No specs changed.

Source: `docs/reports/playtest-all/README.md` at `e01914fb8`, read with `git show`.

## Changes and regression coverage

| Finding | Change | Focused proof |
|---|---|---|
| 1. L6 service gate | Waiting ring at `(gate.x+2.4, 17.3)`, outside the follower lane; HUD/panel show `n/m through`; followers steer around a courier. The barrier meshes actually narrowed the nominal 2.2 m opening to 1.7 m. Their inner edges now match the gate leaf, leaving the full 2.2 m clear. Survivors retain their formation column as others leave, with 2.5 cm gaps between the three 0.7 m bodies and the barriers. The bot covers/closes from the same waiting spot; the novice stays within 4 m of the rear and prioritizes infected biting survivors without changing its fire-duty handicap. | Level test with a stationary courier and two living rear followers; high/low real mouse/E test. |
| 2. Bodies swallow clicks; trigger smaller than ring | A plain click inside any active objective/search ring takes precedence over both body picking and melee magnetism and moves to the ring. Explicit Shift attack remains available. Fire-bay trigger is 0.65 m, covering the torus's 0.6 m radius plus 0.05 m tube. | Real mouse test with a clickable infected on the L1 ring; static minimum-radius check across all ten levels. |
| 3. L5 Metro pillar/stair | Ring on the front-left stair, visible between the pillars and wholly inside the real arrival box. Followers join the opposite lane before crossing, so they do not push a courier on the ring into the corgi's remaining space. | Static full-ring containment; high/low real approach clicks at zoom 0.5, 1 and 1.5. |
| 4. L10 terminal | Ring moved to `(2707, 41.25)`, in front of the console, leaving 0.30 m between its rim and the console footprint. Authoring route and shipped anchor agree. | Static solid-clearance check over every drawn objective/search ring in all levels; research interaction via real mouse. |
| 5. L5 search spots | All five hidden discovery anchors draw gold rings until discovered. Rings use the same anchors and ground heights as searching. | Reachability/marker-lifetime unit test; high/low captures of each search spot. |
| 6. L7 corridor | Courier must reach either existing entrance and have every living follower within 18 m (covers the three-column formation). The marker selects the nearer entrance; HUD counts nearby members and names a missing one. Dead/turned people do not block progress. | Level regression; high/low mouse route through the western corridor entrance and bus, checking exact survivor IDs in L8. |
| 7. APC / route distance | APC boarding completes the board step immediately and starts a visible group-boarding wait with counts. Its door anchor follows the vehicle, with the ring moved 0.25 m outward so the whole torus clears the solid APC hull. Leaving the APC restores a visible return-and-board objective. Both L3 trackers use the fixed army destination rather than the moving guidance point. | Boarding level regression; browser check of both L3 tracker distances. |
| 8. Hidden waits | Shared objective text exposes L4 hold/cellar deadlines, L6 shelter/retreat deadlines and exit counts, and L5's three-second stair dwell and `Waiting for the corgi`. | Simulation deadline/Metro regressions; Metro approach HUD assertion. |
| 9. Floating diamond | Diamond and ring read the actual ground at the destination. Diamond offset is a fixed 1.8 m above that ground, including raised exits. | Browser pixel projection check at the 3.9 m L6 exit. |

The L4 hold countdown follows the current collapse director: at most 190 seconds from the turn (third line due at 182 s plus eight-second fallback), bounded by the 200-second failsafe. An earlier third-line break updates the remaining time to the actual fallback deadline.

## Validation

- `npm run typecheck`, `npm run lint`, `npm run build`: pass.
- Local objective/static/Metro regressions: 11/11 pass; navigation/checkpoint regressions: 13/13 pass; Metro/encounter regressions (including real corgi closure): 16/16 pass; final anchor/static regressions: 12/12 pass. The final standalone L10 checkpoint test passes locally and remotely.
- Final browser regression file: **10/10 pass**, with one worker, including all five followers and the corgi entering/closing from the normal-zoom Metro click. Existing held-key Metro (high/low) and L3 waypoint compatibility: **3/3 pass**. Held-key Metro finishes 8.18 seconds after crossing the ring with zero arrival resets on both qualities.
- Remote final L5/static/clarity scope: 48/48 pass across ten files, including the unchanged complete/novice survivor balance checks.
- Original L6 seed-1 acceptance runs: complete **265.05 s, 27/29 rescued**, novice **266.63 s, 13/29 rescued**; zero deaths and all four stragglers rejoined in both. Original time/rescue criteria retained. Both continuous complete and novice L1–L6 campaigns finish with the real L5 handover.
- Remote affected-level scope: **50/50 pass across 14 files**, including L6 protection, both continuous L1–L6 campaigns, and L8 transfers with 0/12/35 survivors. Final remote `tests/unit tests/levels`: **2,163 passed, 9 skipped, 0 failed** (395 files passed, three skipped). Includes the continuous L1–L10 campaign and all ten checkpoint sweeps. The production asset validator initially timed out under concurrent suite load. All **17/17 asset checks** then passed in an isolated 207.5-second remote run; its timeout and source were not changed.

[Validation summary](validation.json) retains counts, L6 metrics and exact L7→L8 survivor IDs. Detailed logs, JSON assertions and full-resolution captures live in `test-results/objective-clarity/`. Earlier runs exposed the narrow L6 barrier gap, formation shuffling, and the merged click fallback; those failures were fixed and rerun. Existing Metro/checkpoint fixtures were updated to satisfy the newly visible dwell and group-arrival conditions.

Browser command: `E2E_PORT=3915 SCENE_PORT=3916 E2E_ADMISSION_TIMEOUT_SECONDS=1800 E2E_UNITS=1 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/objective-clarity.spec.ts --project=chromium --workers=1`.

All browser automation is headless WebGL2 with ANGLE Metal. Fixtures arrange each reported situation; subsequent courier movement uses physical mouse/keyboard events sampled by the game. No injected movement frames or objective-completion cheats are used during the asserted routes. The normal-zoom Metro route additionally waits for all five real followers and the corgi to cross before closure. Browser coverage uses focused fixtures. Continuous L1–L6 coverage runs in simulation; manual WebGPU validation was not run.

## Capture review

The sheets contain unscaled crops of the real 1600×900 browser screenshots. Columns are high/1, high/1.5, low/1, low/1.5 unless labeled otherwise. All 46 ring captures were visually reviewed. [Capture metadata](capture-metadata.json) records each target, crop, camera and HUD. Camera assertions check the zoom setting and actual camera radius (19 m × zoom).

- [Metro approach](metro-approach.jpg): high/low at 0.5, 1 and 1.5. The complete gold ring reads on the front stair between the brick pillars. It is clear of the right pillar/side wall; each zoom accepts one physical click into the true arrival trigger.
- [Gate, terminal and APC](gate-terminal-apc.jpg): L6's ring is on the side waiting strip, leaving the gate mouth free. L10's ring is on the clear floor in front of the console. The APC ring is outside the wheels/hull beside the existing boarding cue.
- [Five search spots](search-rings.jpg): pharmacy, church vestry and apartment cues sit on the pavement outside their doors; Sam's cue is on the street beside the lit bus. Gold search rings remain distinct from cyan pickup rings. Dale's cue remains visible through the truck cab in this view; its target is the clear, reachable paving beside the cab.
- [Fire bay and raised exit](fire-bay-raised-exit.jpg): high at 1 and 1.5. The fire-bay ring remains visible through the clickable infected; the raised exit ring lies on the asphalt with its pointer above it.
- [L7 corridor](corridor-ring.jpg): the western entrance ring reads on the paving at both zooms in both qualities. The HUD names the missing group member; the bus handover proof checks the exact carried IDs.

The in-view DOM diamond remains suppressed by existing CSS; its projection and edge guidance now use ground + 1.8 m. The visible 3D pointer uses ground + 2 m. Both follow raised ground.

Remote suite commands (each uses at most four Vitest workers):

```sh
sh tools/remote/run.sh "$PWD" --pull test-results/objective-clarity/remote-clean-final -- \
  npx vitest run tests/unit tests/levels --maxWorkers=4 \
    --reporter=default --reporter=json --outputFile.json=test-results/objective-clarity/remote-clean-final/results.json
sh tools/remote/run.sh "$PWD" --pull test-results/objective-clarity/remote-assets-final -- \
  bash tools/remote/timing-isolated.sh npx vitest run tests/unit/assets/validate.test.ts --maxWorkers=1 \
    --reporter=default --reporter=json --outputFile.json=test-results/objective-clarity/remote-assets-final/results.json
```

The final full snapshot includes both the Metro lane staging and final terminal placement. The earlier terminal trial at z=41.5 changed the standalone run enough to die in a later corridor encounter; z=41.25 retains 30 cm of ring-to-console clearance and passes the original full L10 checkpoint test. No combat or timing criteria changed. The new ten-layout static fixture permits 120 seconds for setup on a loaded runner; its radius and solid-clearance assertions are unchanged.
