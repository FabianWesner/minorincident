# L4 boundary, refuge and pickup review — PO 2026-10-15

Implementation commits: `708a84e7d` (refuges), `cf73c456d` (pickups), `9fbb39738` (hold perimeter). `31bde8b3e` adds L7 ground weapons and mission identity in Scene Lab. Follow-up QA records the final fixtures and all ten campaign levels, including L7, which is absent from `missionIds`.

| PO row | Change | Mechanical evidence |
| --- | --- | --- |
| 16b | The hold line uses low concrete barriers, wire and MILITARY ZONE signs. One data manifest defines all four visible sides and player colliders. It activates at the turn/hold and opens at the line break. Outward clicks clamp inside, show a red marker and short hint; pushing triggers the soldier bark and highlights nearby barriers. Infected use the existing 72-tick sandbag vault. | `L4-perimeter.test.ts`: seed 1, reported south edge, blocked courier, crossing infected, and every open one-metre plaza tile (722 ride + 650 plaza + 650 hold/war, including both edge columns) in ride/plaza/hold-war, through actual click and direct capsule movement. |
| 15 | Fleeing people choose separate clear exterior gathering spots and cower outside the closed door. They keep their entities, appearance and spatial entries. L4 street-edge arrivals also remain visible. | `L4-refuge-visible.test.ts`: six civilians including a soldier reach the refuge beat; human count and visible IDs persist. Loops through L1–L10, including L7, wherever refuge doors exist. |
| 13 | Ground pickups use deterministic clear positions against nav solids, current vehicle hulls, L2 fire-engine travel/end poses and L4 convoy travel/stop poses, tank stop and fuel truck. Raised shelf weapons retain their authored support. L3 highway medkit data stays intact. | `pickup-solids.test.ts`: all ten levels; a med pack requested inside the parked L4 bus hull is relocated to reachable open ground. Existing campaign pickup-grounding tests pass. |

The player navigation grid uses the courier's capsule clearance, with 25 cm cells in L4 for the narrow clear lanes between reception furniture. NPC convoy margins remain on NPC routes; the player route and hull guard use the player footprint. Existing BFS equivalence tests retain their original oracle and budgets. The grid is prepared during mission loading. A courier outside the camp when the alarm begins can re-enter before the player-only line latches; this avoids trapping an explorer outside the new line.

The shared solid registry was absent from this checkout/main during the work. `src/data/l4Perimeter.ts` exposes the line as data for that lane to absorb. No `specs/`, reference assets or `src/assets/staticCollision.ts` edits.

## Validation

- Typecheck, lint and production build: pass.
- Focused remote regression: **65/65 tests pass** (movement, respawn, convoy hull clearance, cowering/pets, persistence, pickup grounding, nav equivalence/corners). See `focused.json`.
- Final edge-column and movement/respawn recheck: **5/5**. See `plaza-grid.json` and `perimeter-final.json`.
- Final all-ten-level refuge/pickup and pickup-system pass: **5/5**. See `all-ten-levels.json`.
- Full remote unit: **1,496 pass, 2 fail, 7 skipped**. Failures are untouched `character-loading.test.ts` (loader called twice) and `occluder-footprint.test.ts` (fixture lacks `cutPlacements`).
- Full remote sim: **1,071/1,072** in the earlier snapshot. Its forecourt failure passes in the final source, together with nav equivalence (**17/17**). Player-specific routing was confined to L4 after that run. The full suite was not repeated.
- Final Scene Lab matrix: **18/18 WebGL + 18/18 WebGPU pass**, including the catalog's zoom 1.5 variants. The WebGL pickup scene was recaptured separately after resolving the mission identity and fixing its framing. See `scene-matrix.json` and `captures.md`.
- Native E18 WebGL high/low: **2/2 pass**, headless real Metal, one worker, all slots reserved via `quiet-run`, no other headless browser or local Vitest, load 2.44. The reservation ran within the 20-minute cap and was released. WebGPU received the full visual matrix and actual-game draw/triangle checks; frame timing below is the authored WebGL reference suite.
- High war/collapse p95: **9.3 / 12.5 ms** (both ≤ 14); sim p95 **2.4 ms** (≤ 4). Low at 4× CPU throttle: p50 **22.7 / 23.4 ms**, p95 **28.2 / 29.8 ms**; sim p95 **5.2 ms** (≤ 6). Maximum turn/tank/break hitch: **18.7 ms high / 74.2 ms low**, within 50/80 ms.
- Peak measured war/collapse rendering: **364 draws / 913,560 triangles high**, **242 / 337,311 low**, within E18's unchanged caps. See `native-perf.json` and `quiet-run-conditions.jsonl`.
- Full epic `verify E22` and deploy gates were not claimed: the full unit suite still has the two untouched failures listed above. No deployment or merge.

## Game-camera inspection

Both backends are headless native Metal on the Mac. Each matrix covers high/low at zoom 1.0 and 0.5, plus the catalog's additional 1.5 zoom. Actual ride captures use seed 1 at tick 1016/1017.

**Hold boundary:** the formerly blank south/east edge is now a continuous low concrete line. The close views show MILITARY ZONE / STAY INSIDE signs, dark wire, highlighted segments, a red clamped destination and the HUD hint. The courier remains behind it while the infected crosses in a raised vault arc. Both tiers preserve these cues. The normal zoom also shows the existing inner sandbags, so the new outer limit reads as an army perimeter.

**Refuge door 13:** the arched leaf stays closed. The same people are still cowering on the pavement through the final frame, with a soldier nearby and separate exterior positions. The doorway remains unobstructed by disappearing or clipping people. At close zoom the foreground portion of the group fills the shot; normal zoom shows the entire group and door together.

**Med pack:** the actual tick-1016 passenger camera shows the white-cross red case on the sidewalk, visibly separated from the EVAC bus's front tyre and hull. The close follow camera crops the case below the frame while clearly showing the now-clear tyre; the dedicated stationary Scene Lab game camera frames the case and measured tick-1016 hull together. Its first frame settles the camera through foreground masonry; frames 30 and 60 clearly show the gap at both zooms. Placement changes are geometric and identical on both quality tiers. Actual ride draw/triangle maxima: high **103 / 297,559**, low **95 / 140,037**, within E18's **600 / 1.5M** and **300 / 500K** caps. See `ride-proof.json`.

[All reviewed capture pairs](captures.md). The actual ride shots show a clear tyre at close zoom and the reachable sidewalk case at normal zoom.

## Reproduce

```sh
sh tools/remote/run.sh "$PWD" -- npx vitest run tests/levels/L4-perimeter.test.ts tests/levels/L4-refuge-visible.test.ts tests/levels/pickup-solids.test.ts --maxWorkers=4
npm run build
E2E_UNITS=1 SCENE_PORT=3387 SCENE_SERVER=preview npm run scene:catalog -- --matrix --backend webgl2 --jobs 1 --filter 'l4-hold-perimeter,l4-refuge-shelter,l4-medpack-clearance'
E2E_UNITS=1 SCENE_PORT=3387 SCENE_SERVER=preview npm run scene:catalog -- --matrix --backend webgpu --jobs 1 --filter 'l4-hold-perimeter,l4-refuge-shelter,l4-medpack-clearance'
E2E_UNITS=1 SCENE_PORT=3387 SCENE_SERVER=preview sh tools/e2e-lock.sh npx tsx tools/qa/l4-boundary-refuge.ts
E2E_PORT=3388 sh tools/perf/quiet-run.sh npx playwright test tests/perf/l4-budgets.spec.ts --project=chromium --workers=1 --retries=0
```

Browser batches use a single slot and release it between runs. After polling admission repeatedly missed openings, final capture admission used an explicit `lockf` on one of the same shared slot files, followed by the reentrant `tools/e2e-lock.sh`. The timed run waited without holding partial slots, then acquired the ordinary exclusive `quiet-run` reservation. No other job was interrupted.

Native performance overviews were also inspected: the war shots show the signed outer line and visible humans around the reception, with open central movement space. The collapse shots show the escape objective, persistent people/bodies and fires after the outer hold line is released. The low portrait view retains the same scene and navigation cues. Raw timing samples and those overviews are in `perf/`.
