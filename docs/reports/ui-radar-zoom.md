# PO #67 / #72 / #75 — launcher camera and radar (2026-10-20)

Branch: `lane/ui-radar-zoom`, based on main `60c51a67a`. Implementation commits: `88f2941df` (camera/radar/layout), `b9ba8fce9` (Cure zoom persistence), and `3074720ac` (Northgate ground coverage).

## Changes

- The selected rack slot controls the camera cap in every level. Holding `weapon.rocket-launcher` permits 2.0; other equipment permits 1.5. Changing away clamps the target immediately and eases the displayed distance back within 0.4 seconds. Minimum zoom, camera angle and scripted framing retain their existing behavior. A mounted minigun does not count as holding rockets.
- L10 checkpoint saving still rejected `cameraZoom > 1.5`. Save validation now shares the requested rocket maximum, and resume applies the held weapon before restoring zoom. JSON validation rejects non-finite values and values outside 0.5–2.0; a browser test saves and reloads the selected launcher at 2.0.
- Blue survivor pins read live civilian survivor, allied follow and escort components. A fixed DOM pool replaces the L5-only named pins; there are no entity snapshots or newly constructed entity/pin arrays in its update. Outside the 30 m radius, pins clamp to the existing 44% rim. Missing, hidden, dead and turned actors disappear.
- Radar, weather badge and objective share vertical flex flow. The badge is centered below the circle, including collapsed touch layouts. Touch Pause and Home occupy clear positions beside the radar and on the left rail; touch help moves below navigation.
- The L7 entrance capture exposed the edge of the elevated Northgate paving. Its presentation apron extends to x=350 and z=-60..90, preserving the original stepped road heights. Low verge paving and retaining faces close the raised-road edge without lifting the side lanes or changing their original contact behavior. The optimized W6 ground GLB grows from 2,680 to 5,776 bytes. Unit tests raycast all four launcher-view ground corners on desktop and both phone orientations, and compare six verge heights with the simulation within 2 cm.
- E18 budgets, fog, LOD policy and streaming/culling limits are unchanged. Unit projection checks put the 2.0 flat follow-plane footprint inside the existing 45 m low culling distance for 1600×900, 1024×768, 390×844 and 844×390. Streamed 100 m cells still cover that footprint.

## Reproduction

```sh
npm run typecheck
npm run lint
npm run build
sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/levels --maxWorkers=4
sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit/assets/validate.test.ts tests/unit/static.test.ts tests/levels/l7-audit.test.ts --maxWorkers=1 -t 'T-E17-02b|T-E01-01b|T-E29-02'
E2E_PORT=3831 SCENE_PORT=3832 E2E_UNITS=1 sh tools/e2e-lock.sh npx playwright test tests/e2e/radar-zoom.spec.ts --project=chromium --workers=1
E2E_PORT=3831 SCENE_PORT=3832 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/zoom-out.ts --rocket
E2E_PORT=3831 SCENE_PORT=3832 E2E_UNITS=1 sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx tsx tools/qa/zoom-out.ts --rocket --timing
```

The rocket audit covers L7/L8/L10 at start, fight and finale approach on high/low and actual WebGL2/WebGPU. L10 starts at the rocket checkpoint, visits the authored corridor breach, then loads the authored dispersal-ready checkpoint, activates the console and samples the mature assault. A fourth L10 frame checks the late epilogue pull at player zoom 2.0. L7 stops outside bus boarding to measure live horde gameplay. The audit rejects a result screen, wrong backend/tier/weapon/zoom, absent scenery and browser errors. Timing holds the launcher trigger, verifies at least three shots at combat positions (the epilogue is exempt), resumes the simulation for eight seconds, discards two seconds, and checks maximum draws/triangles and frame p95 against the existing budgets; at least 100 frames and 240 sim ticks must advance.

Artifacts: `test-results/ui-radar-zoom/` (PNG captures, contact sheets, state/layout JSON and `summary.json`; no native timing JSON was produced). Representative captures: [desktop radar](../../test-results/ui-radar-zoom/L7-high-webgl2-start.png), [phone radar](../../test-results/ui-radar-zoom/responsive-390-844-expanded.png), [L7 WebGPU high contact sheet](../../test-results/ui-radar-zoom/L7-high-webgpu-sheet.jpg).

## Validation and visual review

| Check | Result |
| --- | --- |
| Typecheck, lint, production build | PASS locally and in final remote E01 check (141.172 s) |
| Focused unit tests (camera, paving, survivor pins, badge flow, Cure saves) | 17 passed, 5 files |
| Browser regressions | 9 distinct cases passed: shared L5 moving/dead dots; six portrait/landscape HUD cases; responsive radar/pinch/unequip/side selection; L10 save/reload at 2.0 |
| Cross-backend captures | 40 passed; 12 contact sheets reviewed; zero browser errors |
| Responsive radar captures | 8 passed: 1600×900, 1024×768, 390×844, 844×390; expanded and collapsed |
| Landscape HUD coverage | 26.9518%, within the unchanged 27% cap (narrower objective, same text size) |
| Final remote focused run, including L7 district/assets | 23 passed, 6 files; final paving mesh/contact checks included |
| Full remote unit/level run | 2,138 passed, 3 timed out, 9 skipped (388 passed / 3 failed / 3 skipped files); exit 1; 4,920.50 s |
| One-worker remote rerun of the three failed checks | 3 selected tests passed: inventory 222.255 s, E01 141.172 s, L7 audit 185.662 s; 16 other cases filtered out; exit 0; unchanged timeouts |
| Native frame p95 and continuous-fire peaks | **UNMEASURED:** quiet-run exited 75 after 30 minutes of browser admission; no native timing browser started |

The final snapshot counters below are maxima over each level's captured positions, with the launcher equipped and zoom 2.0. They are **frozen-frame counters**, not continuous-fire peaks or frame-time results. Both actual backends produced the same counts.

| Level | Tier | WebGL2 draws / triangles | WebGPU draws / triangles | E18 cap |
| --- | --- | --- | --- | --- |
| L7 | high | 194 / 533,671 | 194 / 533,671 | 600 / 1,500,000 |
| L7 | low | 116 / 251,786 | 116 / 251,786 | 300 / 500,000 |
| L8 | high | 236 / 247,326 | 236 / 247,326 | 600 / 1,500,000 |
| L8 | low | 242 / 142,102 | 242 / 142,102 | 300 / 500,000 |
| L10 | high | 206 / 283,202 | 206 / 283,202 | 600 / 1,500,000 |
| L10 | low | 157 / 117,855 | 157 / 117,855 | 300 / 500,000 |

Terrain residency stays at ≤25 high / ≤9 low, with zero queued/loading cells at capture time. The L10 epilogue frame reaches a 260 m camera radius while retaining player zoom 2.0; the coarse horizon keeps the wider arena and access road present. The flat follow-plane projection remains inside the 45 m low cull radius. At the elevated Northgate road, lower ground can extend farther; actual corner raycasts hit the extended mesh. Crowd rendering uses the actual view frustum for submissions, and static scenery retains its existing frustum culling. Fog, tier LOD selection, chunk caps and prefetch policy retain their existing settings.

### What I saw

I opened all 12 final contact sheets, the dense L7 horde and L10 epilogue PNGs, plus desktop/tablet/phone radar captures. High/low and WebGPU/WebGL2 retain the same scene composition.

- **L7:** blue group dots cluster behind the courier at the Northgate exit; the road retains its original raised strip and lower side lanes, with closed retaining faces and continuous paving beyond the former bare edge. The alley has intact ruined facades and wrecks. The final frame puts the courier inside the dense regular horde with a large Alpha behind it, with streets and vehicles continuous to the frame edges. Low has fewer bodies while retaining the landmarks.
- **L8:** bus, arriving survivor group, warm lamp pools and sanctuary entrances are complete; the breach frames show infected/elephant silhouettes on the lawn. The armored exit vehicle and its yellow ring remain legible. No blank ground tiles or exposed world edge were visible.
- **L10:** the launcher checkpoint, corridor breach and active console assault render on continuous terrain. The late pull shows the full paved dispersal apron, tanks/towers, bodies and access road surrounded by dark ground with broad shadow bands. The square paving edge is the authored apron; ground continues beyond it. No unloaded tile holes were visible. Queued/loading terrain counters were zero at every sampled position.
- **Radar/badge:** desktop has an 8 px gap from circle to badge and badge to objective; touch has 6 px. “Ash fall” stays centered beneath the circle in portrait/tablet/landscape, and wraps beneath the small collapsed radar without covering the objective. The tested phone has 24 blue follower pins; Home and Pause remain clear. Collapsed mode hides marker visuals and restores them on expansion.

The full remote run copied the runtime code after the Cure save fix, before the final ground-only correction. The separate final 23-test run includes the final ground asset, ground/contact unit test and L7 district/asset contracts. The nine skipped cases are seven macOS-only browser-lock tests and two opt-in L4 probes. All three broad-run failures are confirmed test timeouts: E01 checks at 180 s, inventory at 300 s, and L7 standalone at 300 s. No assertion failure was reported. All three passed in the final rerun with one worker and unchanged limits; this is consistent with shared-runner contention, but an unchanged-main baseline was not measured. The L7 standalone artifact records completion with 23/24 survivors boarded, zero deaths and zero collision failures, despite its test exceeding 300 seconds. Remote E01 command logs are retained under `remote-static/` (broad run) and `remote-static-final/` (passing rerun).

### Remaining measurement

2.0 is the largest zoom checked with snapshot counters in this lane and all captured draw/triangle counts fit E18. A full frame-budget acceptance remains open because native p95 and firing peaks were not admitted within the 30-minute limit. No performance budget, fog or LOD threshold was changed to obtain these results.
