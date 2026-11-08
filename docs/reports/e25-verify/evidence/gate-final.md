# Final gate — two workers

`VITEST_MAX_WORKERS=2`; original test timeout and 240-second suite budget unchanged.

```text
[runner] queued FIFO 01794111492952352000-31536.json; remote preferred, eligible Mac CPU fallback
[remote] sync /Users/wesner/Workspace/minorincident/.claude/worktrees/e25-verify -> 94.130.181.173:/srv/mi/ws/e25-verify-0fac1a
[remote] cache-gc deleted: pre-uat-l9-38690a
[remote] sync 224s, 11875 files; job /srv/mi/jobs/e25-verify-0fac1a-31536-1794111492; queueing for a slot
[runner] slot 1 acquired; load 5.97 5.88 4.76
[E25 QA] disposable source snapshot f55cb3f3c7565c5b1bf69fd0af1c298ab2040f66

> verify
> tsx tools/verify.ts E25

[verify] E25 (E25): per-epic AC tests were retired; running the per-change gate.

> typecheck
> tsc --noEmit && tsc --noEmit -p tsconfig.sim.json


> lint
> eslint src tests tools functions *.config.ts eslint.config.js


> test
> node tools/qa/test-budget.mjs --name test --max-seconds 240 -- node node_modules/vitest/vitest.mjs run --project default --configLoader runner

[test-budget] 150/150 test cases ({"vitest":129,"e2e":9,"invariantsBrowser":12}), 43/45 files

 RUN  v5.0.3 /srv/mi/jobs/e25-verify-0fac1a-31536-1794111492

 ✓  default  tests/shared/render-contracts.test.ts (14 tests) 1896ms
   ✓ corpse pages: bodies persist past the old cap, bounds stay conservative, culling restores identity/pose/tint, normals survive vec4 padding 1320ms
 ✓  default  tests/engine/l4-contact.test.ts (1 test) 12296ms
   ✓ L4: every contact archetype interrupts approach/lure and attacks within 3 s; soldiers remain biteable and corgi protected 12294ms
 ✓  default  tests/engine/combat.test.ts (7 tests) 463ms
 ✓  default  tests/tools/gate-tools.test.ts (8 tests | 1 skipped) 16636ms
   ✓ browser pool admission backs off under WindowServer pressure, keeps a one-context floor, recovers only after three cool samples 4768ms
   ✓ scene gate resume requires identical rows, revision and backend identities 2157ms
   ✓ scene gate rejects stale, failed, malformed and incomplete child results 3036ms
   ✓ scene gate rejects invalid arguments and empty selections before running children 5126ms
   ✓ build-cache publication never leaves an interrupted copy looking complete 1183ms
stdout | tests/engine/save-progression.test.ts > L1–L10 starts clamp progressed saves and fresh handovers to story weapons, keeping eligible carry-over and selection
[campaign] selected action weapon.handgun unavailable (not in destination rack); falling back to weapon.fists
[campaign] selected action weapon.handgun unavailable (not in destination rack); falling back to weapon.bat
[campaign] selected action weapon.handgun unavailable (not in destination rack); falling back to weapon.fire-axe
[campaign] selected action weapon.handgun unavailable (not in destination rack); falling back to weapon.fire-axe

stdout | tests/engine/save-progression.test.ts > selection fallback: lost or empty weapons fall back to the best usable owned weapon, never an empty finite gun
[campaign] selected action weapon.shotgun unavailable (not in destination rack); falling back to weapon.rocket-launcher

stdout | tests/engine/save-progression.test.ts > bare hands are innate: key 1 selects fists without them entering the carried racks
[campaign] selected action weapon.fists unavailable (not in destination rack); falling back to weapon.rocket-launcher

 ✓  default  tests/engine/save-progression.test.ts (6 tests) 366ms
   ✓ save decoding: presets round-trip, v0 migrates, corrupt/unknown data and storage errors fail safely 323ms
 ✓  default  tests/engine/missions.test.ts (6 tests) 37292ms
   ✓ graph timing: parallel tasks join in any order; a timeout fires exactly at 120 s, retry restores the timer, completion cancels it 1163ms
   ✓ interactions: ring, input and view predicates agree for every interact step of every level 20909ms
   ✓ interactions: only the open L6 gate the group is heading for offers its prompt 10023ms
   ✓ checkpoints: death restores objectives, HP, charges and escorts; a boss killed before or after C stays dead 4909ms
 ✓  default  tests/shared/asset-contract.test.ts (3 tests) 9628ms
   ✓ crowd atlas cleanup preserves enclosed eye paint and its authored alpha class 483ms
   ✓ uniform and civilian faces and yellow bare arms share the per-person skin class 464ms
   ✓ the asset validator rejects every contract violation, and every production asset passes it 8678ms
 ✓  default  tests/engine/infected-ai.test.ts (5 tests) 2969ms
   ✓ every human and animal role validates and spawns with its catalog health and speed; every attack is telegraphed 649ms
   ✓ perception: sight cone, facing-independent gunshots, silent melee misses, bounded kill noise, screamer radius 1749ms
   ✓ melee knocks down for a seeded 10-20 s, respects the L2 recovery pool, then up at full HP; explosives and burns kill for good 389ms
 ✓  default  tests/engine/npcs.test.ts (3 tests) 8653ms
   ✓ civilians: seeded grab → bite → down → glowing eyes → rising → infected cycle in place; panic flees; a kill during the grab saves 874ms
   ✓ escort: shared combat pace, follows through a maze, a 2 s stand revives to 50 %, unattended 20 s down fails the mission 983ms
   ✓ corgi: warns of an offscreen threat within 18 m with a unit direction 6795ms
 ✓  default  tests/engine/input.test.ts (5 tests) 42ms
 ✓  default  tests/engine/collision.test.ts (4 tests) 1391ms
   ✓ admission: parked vehicle hulls exclude bodies, coincident spawns separate, a thin wall never admits a body through it 1216ms
 ✓  default  tests/engine/world-systems.test.ts (5 tests) 549ms
 ✓  default  tests/tools/qa-drivers.test.ts (3 tests) 68ms
 ✓  default  tests/engine/vehicles.test.ts (2 tests) 6281ms
   ✓ enter, drive and exit: door dwell, input ownership (no attacks while driving), capsule-safe exit on the free side; bike stand-to-mount needs an approach 6048ms
 ✓  default  tests/engine/navigation.test.ts (4 tests) 13958ms
   ✓ A*: budgeted search resumes across ticks within its expansion budget; connectivity tells a long route from an enclosed yard 13696ms
 ✓  default  tests/engine/spawn-director.test.ts (4 tests) 6974ms
   ✓ a 150-infected migration follows its spline on time and fans out at the goal 1048ms
   ✓ pooling: spawn/kill cycles reuse prewarmed records, keep every corpse, and refresh borrowed collision radii 5687ms
 ✓  default  tests/engine/aim-assist.test.ts (3 tests) 283ms
 ✓  default  tests/engine/director-pressure.test.ts (3 tests) 744ms
   ✓ native routing clears thin doorways and yields failed shared searches 460ms
 ✓  default  tests/engine/input-log-codec.test.ts (2 tests) 1262ms
   ✓ input log codec (2)
     ✓ round-trips every InputFrame field and scheme exactly, with float64 precision and commands at their sample index 476ms
     ✓ cuts independent chunks under the upload cap, decodes them in order, survives gzip and rejects gaps and garbage 783ms
 ✓  default  tests/engine/player.test.ts (3 tests) 2133ms
   ✓ walls: a 72-direction capsule sweep never penetrates the wall ring; sliding keeps 60 % tangential speed; head-on corners slip 1925ms
 ✓  default  tests/engine/determinism.test.ts (4 tests) 13712ms
   ✓ a serialized recording replays the identical state hash at every tick; snapshots are copies; reset frees everything 463ms
   ✓ real levels replay deterministically: same seed and script give the same hash on L1, L4 and L10 13084ms
 ✓  default  tests/engine/core.test.ts (4 tests) 147ms
 ✓  default  tests/engine/l10-camera-framing.test.ts (3 tests) 170ms
 ✓  default  tests/shared/architecture.test.ts (2 tests) 2458ms
   ✓ the sim import graph never reaches renderer, UI, debug or DOM code (Three math, synchronous save codecs and Rapier) 1856ms
   ✓ lint rejects unseeded randomness, DOM and renderer imports in the sim 599ms
 ✓  default  tests/tools/browser-pool-client.test.ts (1 test) 16ms
 ✓  default  tests/tools/playtest-finale-retreat.test.ts (1 test) 5ms
 ✓  default  tests/tools/test-budget-tools.test.ts (1 test) 24495ms
   ✓ test budget collection is passive, rejects missing counts and bounds collection with child cleanup 24493ms

 Test Files  27 passed (27)
      Tests  106 passed | 1 skipped (107)
   Start at  04:23:45
   Duration  103.57s (tests 90%, transform 5%, import 5%, setup 1%)

[test-budget] test: 109.5 s (budget 240 s)

> build:qa
> NODE_ENV=production VITE_QA_HOOKS=1 sh tools/build-cached.sh

vite v6.4.3 building for production...
transforming...
✓ 652 modules transformed.
rendering chunks...
computing gzip size...
dist/preview/index.html                             1.81 kB │ gzip:     0.75 kB
dist/build/skinnedCrowd-D3M5tKq9.js                 2.88 kB
dist/index.html                                     2.91 kB │ gzip:     0.96 kB
dist/build/civilianBakeData-BYfMxZ0w.js             4.05 kB
dist/build/deathPose-BH9ouT0s.js                    5.79 kB
dist/build/BufferGeometryUtils-BsKHv_Up.js          6.88 kB
dist/build/civilianBake.worker-CD5ztKeP.js         29.19 kB
dist/build/basis_transcoder-o4Hde_L7.js            57.53 kB
dist/build/three.module--FhUTY-k.js               206.13 kB
dist/build/civilianSource-C-NynhlA.js             410.03 kB
dist/build/basis_transcoder-VXdx5NbI.wasm         527.33 kB │ gzip:   247.62 kB
dist/build/prefetch.worker-BaByQNVR.js          1,064.83 kB
dist/build/prepareCivilianGeometry-BtnVNVPA.js  1,969.86 kB
dist/build/rapier-C6GCbKVJ.wasm                 3,082.10 kB │ gzip: 1,176.71 kB
dist/build/index-IOL21Ibl.css                      42.33 kB │ gzip:     9.00 kB
dist/build/lookViewpoints-BX-OEann.js               0.23 kB │ gzip:     0.16 kB
dist/build/modulepreload-polyfill-B5Qt9EMX.js       0.71 kB │ gzip:     0.40 kB
dist/build/three.module-DRBnV6Mu.js                 1.10 kB │ gzip:     0.64 kB
dist/build/preload-helper-BlTxHScW.js               1.11 kB │ gzip:     0.65 kB
dist/build/controls-BD2KGrGS.js                     1.40 kB │ gzip:     0.75 kB
dist/build/crowdProbe-CKruKHJb.js                   1.53 kB │ gzip:     0.88 kB
dist/build/worldLook-o3T_90Bf.js                    1.96 kB │ gzip:     0.90 kB
dist/build/DebugInfo-BT-8HAL5.js                    2.70 kB │ gzip:     1.19 kB
dist/build/crowd-Bw3xHp2e.js                        3.10 kB │ gzip:     1.58 kB
dist/build/lookPatch-BJ2Iw5hk.js                    5.68 kB │ gzip:     2.88 kB
dist/build/probe-DKgptAsS.js                        7.52 kB │ gzip:     3.08 kB
dist/build/footSoles-zVWxjPI_.js                   10.41 kB │ gzip:     3.54 kB
dist/build/index-C6SciXOl.js                       12.43 kB │ gzip:     4.49 kB
dist/build/Inspection-BI1qgsZk.js                  12.86 kB │ gzip:     4.41 kB
dist/build/MotionLab-6E8C8aoQ.js                   18.38 kB │ gzip:     7.96 kB
dist/build/LevelFiveBot-DV_jaiAg.js                23.12 kB │ gzip:     6.86 kB
dist/build/survivor-DjMktlck.js                    24.62 kB │ gzip:    10.09 kB
dist/build/index-BG5LWxjW.js                       28.31 kB │ gzip:     7.75 kB
dist/build/LevelSixSubway-DUcWVLfm.js              29.72 kB │ gzip:    11.23 kB
dist/build/testApi-BLnsXhfz.js                     37.42 kB │ gzip:    13.64 kB
dist/build/Physics-Js5RuGoW.js                     83.09 kB │ gzip:    29.09 kB
dist/build/light-anchors-LtMS8stq.js               92.62 kB │ gzip:     6.95 kB
dist/build/SceneLab-BL8eqoH-.js                   105.02 kB │ gzip:    36.18 kB
dist/build/Pickups-BtPdB7Ge.js                    105.62 kB │ gzip:    36.37 kB
dist/build/PropSystem-pVuHxzU6.js                 140.56 kB │ gzip:    47.73 kB
dist/build/Debug-C5mqunPp.js                      155.77 kB │ gzip:    33.05 kB
dist/build/registry-BAbZ-NTQ.js                   211.04 kB │ gzip:    72.19 kB
dist/build/rapier-ykuY6d4E.js                     212.13 kB │ gzip:    36.16 kB
dist/build/infected-DDjoVemc.js                   287.26 kB │ gzip:    89.12 kB
dist/build/three-core-CzPK-9TN.js                 307.37 kB │ gzip:    82.85 kB
dist/build/WeatherView-CYWbTs76.js                364.34 kB │ gzip:    42.26 kB
dist/build/three-webgpu-B5ei5MQw.js               688.68 kB │ gzip:   192.65 kB
dist/build/wreck-roofs-GAckelu8.js                755.61 kB │ gzip:   251.68 kB
dist/build/install-DJgJpXsU.js                  1,069.19 kB │ gzip:   201.59 kB
dist/build/index-2zFGFPRR.js                    1,376.72 kB │ gzip:   432.26 kB
dist/build/character-clips-CGKWtM3S.js          1,939.70 kB │ gzip:   336.59 kB
✓ built in 18.38s
[remote] pulled test-results/epics/E25/runtimechecks.json
[remote] done exit=0 (runner 94.130.181.173, sync 224s, remote total 240s)
```
