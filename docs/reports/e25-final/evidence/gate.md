# Final shared gate terminal log

```text
[runner] queued FIFO 01794130014924625000-81991.json; remote preferred, eligible Mac CPU fallback
[remote] sync /Users/wesner/Workspace/minorincident/.claude/worktrees/e25-final -> 94.130.181.173:/srv/mi/ws/e25-final-e6f305
[remote] cache-gc deleted: r8-threatfast-6861c3
[remote] sync 155s, 12045 files; job /srv/mi/jobs/e25-final-e6f305-81991-1794130013; queueing for a slot
[runner] slot 0 acquired; load 0.30 0.10 0.03
[E25 QA] disposable source snapshot 26f51a22c9748c3862c37ca56d9d809ba9486890

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

 RUN  v5.0.3 /srv/mi/jobs/e25-final-e6f305-81991-1794130013

 ✓  default  tests/shared/render-contracts.test.ts (14 tests) 1891ms
   ✓ corpse pages: bodies persist past the old cap, bounds stay conservative, culling restores identity/pose/tint, normals survive vec4 padding 1328ms
 ✓  default  tests/engine/l4-contact.test.ts (1 test) 12441ms
   ✓ L4: every contact archetype interrupts approach/lure and attacks within 3 s; soldiers remain biteable and corgi protected 12439ms
 ✓  default  tests/engine/combat.test.ts (7 tests) 466ms
stdout | tests/shared/asset-contract.test.ts > the asset validator rejects every contract violation, and every production asset passes it
prune: Removed types... Accessor (2)

stdout | tests/shared/asset-contract.test.ts > the asset validator rejects every contract violation, and every production asset passes it
prune: Removed types... Accessor (2)

 ✓  default  tests/shared/asset-contract.test.ts (3 tests) 8937ms
   ✓ crowd atlas cleanup preserves enclosed eye paint and its authored alpha class 545ms
   ✓ uniform and civilian faces and yellow bare arms share the per-person skin class 534ms
   ✓ the asset validator rejects every contract violation, and every production asset passes it 7855ms
 ✓  default  tests/engine/missions.test.ts (6 tests) 36716ms
   ✓ every objective type completes through the real sim exactly once 316ms
   ✓ graph timing: parallel tasks join in any order; a timeout fires exactly at 120 s, retry restores the timer, completion cancels it 1124ms
   ✓ interactions: ring, input and view predicates agree for every interact step of every level 20181ms
   ✓ interactions: only the open L6 gate the group is heading for offers its prompt 9966ms
   ✓ checkpoints: death restores objectives, HP, charges and escorts; a boss killed before or after C stays dead 5121ms
stdout | tests/engine/save-progression.test.ts > L1–L10 starts clamp progressed saves and fresh handovers to story weapons, keeping eligible carry-over and selection
[campaign] selected action weapon.handgun unavailable (not in destination rack); falling back to weapon.fists
[campaign] selected action weapon.handgun unavailable (not in destination rack); falling back to weapon.bat
[campaign] selected action weapon.handgun unavailable (not in destination rack); falling back to weapon.fire-axe
[campaign] selected action weapon.handgun unavailable (not in destination rack); falling back to weapon.fire-axe

stdout | tests/engine/save-progression.test.ts > selection fallback: lost or empty weapons fall back to the best usable owned weapon, never an empty finite gun
[campaign] selected action weapon.shotgun unavailable (not in destination rack); falling back to weapon.rocket-launcher

stdout | tests/engine/save-progression.test.ts > bare hands are innate: key 1 selects fists without them entering the carried racks
[campaign] selected action weapon.fists unavailable (not in destination rack); falling back to weapon.rocket-launcher

 ✓  default  tests/engine/save-progression.test.ts (6 tests) 363ms
   ✓ save decoding: presets round-trip, v0 migrates, corrupt/unknown data and storage errors fail safely 318ms
 ✓  default  tests/tools/gate-tools.test.ts (8 tests | 1 skipped) 16858ms
   ✓ browser pool admission backs off under WindowServer pressure, keeps a one-context floor, recovers only after three cool samples 4665ms
   ✓ scene gate resume requires identical rows, revision and backend identities 2453ms
   ✓ scene gate rejects stale, failed, malformed and incomplete child results 3064ms
   ✓ scene gate rejects invalid arguments and empty selections before running children 5231ms
   ✓ build-cache publication never leaves an interrupted copy looking complete 1128ms
 ✓  default  tests/engine/infected-ai.test.ts (5 tests) 3114ms
   ✓ every human and animal role validates and spawns with its catalog health and speed; every attack is telegraphed 668ms
   ✓ perception: sight cone, facing-independent gunshots, silent melee misses, bounded kill noise, screamer radius 1909ms
   ✓ melee knocks down for a seeded 10-20 s, respects the L2 recovery pool, then up at full HP; explosives and burns kill for good 365ms
 ✓  default  tests/engine/collision.test.ts (4 tests) 1454ms
   ✓ admission: parked vehicle hulls exclude bodies, coincident spawns separate, a thin wall never admits a body through it 1191ms
 ✓  default  tests/engine/npcs.test.ts (3 tests) 8956ms
   ✓ civilians: seeded grab → bite → down → glowing eyes → rising → infected cycle in place; panic flees; a kill during the grab saves 1013ms
   ✓ escort: shared combat pace, follows through a maze, a 2 s stand revives to 50 %, unattended 20 s down fails the mission 1061ms
   ✓ corgi: warns of an offscreen threat within 18 m with a unit direction 6881ms
 ✓  default  tests/engine/input.test.ts (5 tests) 45ms
 ✓  default  tests/tools/qa-drivers.test.ts (3 tests) 61ms
 ✓  default  tests/engine/world-systems.test.ts (5 tests) 698ms
 ✓  default  tests/engine/vehicles.test.ts (2 tests) 6409ms
   ✓ enter, drive and exit: door dwell, input ownership (no attacks while driving), capsule-safe exit on the free side; bike stand-to-mount needs an approach 6181ms
 ✓  default  tests/engine/spawn-director.test.ts (4 tests) 7806ms
   ✓ a 150-infected migration follows its spline on time and fans out at the goal 988ms
   ✓ pooling: spawn/kill cycles reuse prewarmed records, keep every corpse, and refresh borrowed collision radii 6559ms
 ✓  default  tests/engine/navigation.test.ts (4 tests) 20659ms
   ✓ A*: budgeted search resumes across ticks within its expansion budget; connectivity tells a long route from an enclosed yard 20394ms
 ✓  default  tests/engine/aim-assist.test.ts (3 tests) 331ms
   ✓ keyboard fire at all eight facings: Off shoots along the facing, Default lands on the zombie in front 301ms
 ✓  default  tests/engine/director-pressure.test.ts (3 tests) 836ms
   ✓ director pressure brings every native role to its human without replacing its combat role 328ms
   ✓ native routing clears thin doorways and yields failed shared searches 502ms
 ✓  default  tests/engine/input-log-codec.test.ts (2 tests) 1335ms
   ✓ input log codec (2)
     ✓ round-trips every InputFrame field and scheme exactly, with float64 precision and commands at their sample index 431ms
     ✓ cuts independent chunks under the upload cap, decodes them in order, survives gzip and rejects gaps and garbage 902ms
 ✓  default  tests/engine/player.test.ts (3 tests) 2169ms
   ✓ walls: a 72-direction capsule sweep never penetrates the wall ring; sliding keeps 60 % tangential speed; head-on corners slip 1979ms
 ✓  default  tests/engine/determinism.test.ts (4 tests) 14540ms
   ✓ a serialized recording replays the identical state hash at every tick; snapshots are copies; reset frees everything 493ms
   ✓ real levels replay deterministically: same seed and script give the same hash on L1, L4 and L10 13851ms
 ✓  default  tests/engine/core.test.ts (4 tests) 100ms
 ✓  default  tests/engine/l10-camera-framing.test.ts (3 tests) 203ms
 ✓  default  tests/shared/architecture.test.ts (2 tests) 2725ms
   ✓ the sim import graph never reaches renderer, UI, debug or DOM code (Three math, synchronous save codecs and Rapier) 2038ms
   ✓ lint rejects unseeded randomness, DOM and renderer imports in the sim 685ms
 ✓  default  tests/tools/browser-pool-client.test.ts (1 test) 11ms
 ✓  default  tests/tools/playtest-finale-retreat.test.ts (1 test) 5ms
 ✓  default  tests/tools/test-budget-tools.test.ts (1 test) 19744ms
   ✓ test budget collection is passive, rejects missing counts and bounds collection with child cleanup 19742ms

 Test Files  27 passed (27)
      Tests  106 passed | 1 skipped (107)
   Start at  09:31:13
   Duration  100.53s (tests 89%, transform 5%, import 5%, setup 1%)

[test-budget] test: 106.4 s (budget 240 s)

> build:qa
> NODE_ENV=production VITE_QA_HOOKS=1 sh tools/build-cached.sh

vite v6.4.3 building for production...
transforming...
✓ 658 modules transformed.
rendering chunks...
computing gzip size...
dist/preview/index.html                             1.81 kB │ gzip:     0.75 kB
dist/build/skinnedCrowd-D3M5tKq9.js                 2.88 kB
dist/index.html                                     2.91 kB │ gzip:     0.95 kB
dist/build/civilianBakeData-DodFhdro.js             4.05 kB
dist/build/deathPose-BH9ouT0s.js                    5.79 kB
dist/build/BufferGeometryUtils-BsKHv_Up.js          6.88 kB
dist/build/civilianBake.worker-_pYKOTSp.js         29.19 kB
dist/build/basis_transcoder-o4Hde_L7.js            57.53 kB
dist/build/three.module--FhUTY-k.js               206.13 kB
dist/build/civilianSource-C-NynhlA.js             410.03 kB
dist/build/basis_transcoder-VXdx5NbI.wasm         527.33 kB │ gzip:   247.62 kB
dist/build/prefetch.worker-LaaqRA_C.js          1,064.82 kB
dist/build/prepareCivilianGeometry-BtnVNVPA.js  1,969.86 kB
dist/build/rapier-C6GCbKVJ.wasm                 3,082.10 kB │ gzip: 1,176.71 kB
dist/build/index-IOL21Ibl.css                      42.33 kB │ gzip:     9.00 kB
dist/build/lookViewpoints-BX-OEann.js               0.23 kB │ gzip:     0.16 kB
dist/build/modulepreload-polyfill-B5Qt9EMX.js       0.71 kB │ gzip:     0.40 kB
dist/build/three.module-KnJ4A_3u.js                 1.10 kB │ gzip:     0.64 kB
dist/build/preload-helper-BlTxHScW.js               1.11 kB │ gzip:     0.65 kB
dist/build/controls-BD2KGrGS.js                     1.40 kB │ gzip:     0.75 kB
dist/build/crowdProbe-DvPBfiPi.js                   1.53 kB │ gzip:     0.88 kB
dist/build/worldLook-o3T_90Bf.js                    1.96 kB │ gzip:     0.90 kB
dist/build/DebugInfo-Dt82AxX1.js                    2.70 kB │ gzip:     1.19 kB
dist/build/crowd-C2C9mOd6.js                        3.10 kB │ gzip:     1.58 kB
dist/build/lookPatch-BJ2Iw5hk.js                    5.68 kB │ gzip:     2.88 kB
dist/build/probe-DKgptAsS.js                        7.52 kB │ gzip:     3.08 kB
dist/build/footSoles-BpKRdiEU.js                   10.41 kB │ gzip:     3.53 kB
dist/build/index-C7hmTZ0c.js                       12.43 kB │ gzip:     4.49 kB
dist/build/Inspection-DEAbZAm2.js                  12.86 kB │ gzip:     4.41 kB
dist/build/MotionLab-DcJBED33.js                   18.38 kB │ gzip:     7.96 kB
dist/build/LevelFiveBot-CEA9IF3v.js                23.12 kB │ gzip:     6.86 kB
dist/build/survivor-DjMktlck.js                    24.62 kB │ gzip:    10.09 kB
dist/build/index-fMpwkyH5.js                       28.31 kB │ gzip:     7.75 kB
dist/build/LevelSixSubway-CX0NUps2.js              29.72 kB │ gzip:    11.23 kB
dist/build/testApi-Dm8RIwwe.js                     37.42 kB │ gzip:    13.63 kB
dist/build/Physics-DruYAVvN.js                     83.20 kB │ gzip:    29.12 kB
dist/build/light-anchors-BElMGkSS.js               94.19 kB │ gzip:     7.13 kB
dist/build/SceneLab-paVYguzZ.js                   105.02 kB │ gzip:    36.18 kB
dist/build/Pickups-BYFMxM4j.js                    105.62 kB │ gzip:    36.37 kB
dist/build/PropSystem-DRkLnMa4.js                 142.88 kB │ gzip:    48.42 kB
dist/build/Debug-C5mqunPp.js                      155.77 kB │ gzip:    33.05 kB
dist/build/registry-BTjI_iSc.js                   212.07 kB │ gzip:    72.56 kB
dist/build/rapier-ykuY6d4E.js                     212.13 kB │ gzip:    36.16 kB
dist/build/infected-BHeoBb7b.js                   287.70 kB │ gzip:    89.22 kB
dist/build/three-core-CRIfo7il.js                 307.47 kB │ gzip:    82.87 kB
dist/build/WeatherView-Cd33dw15.js                364.76 kB │ gzip:    42.44 kB
dist/build/three-webgpu-Dm7bMjwu.js               688.68 kB │ gzip:   192.65 kB
dist/build/wreck-roofs-GAckelu8.js                755.61 kB │ gzip:   251.68 kB
dist/build/install-BsIPuax1.js                  1,070.14 kB │ gzip:   201.82 kB
dist/build/index-B_h9RK5Y.js                    1,401.45 kB │ gzip:   439.63 kB
dist/build/character-clips-CGKWtM3S.js          1,939.70 kB │ gzip:   336.59 kB
✓ built in 18.77s
[remote] pulled test-results/epics/E25/checks.json
[remote] done exit=0 (runner 94.130.181.173, sync 155s, remote total 235s)

```
