# gate-before-school-bus

```text
[runner] queued FIFO 01794109949565252000-49093.json; remote preferred, eligible Mac CPU fallback
[remote] sync /Users/wesner/Workspace/minorincident/.claude/worktrees/e25-verify -> 94.130.181.173:/srv/mi/ws/e25-verify-0fac1a
[remote] cache-gc deleted:none
[remote] sync 33s, 11859 files; job /srv/mi/jobs/e25-verify-0fac1a-49093-1794109948; queueing for a slot
[runner] slot 0 acquired; load 0.33 0.09 0.13
[E25 QA] disposable source snapshot 6671887c355e95c9f8c72ca0e4fa5b7a05d20907

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

 RUN  v5.0.3 /srv/mi/jobs/e25-verify-0fac1a-49093-1794109948

 ✓  default  tests/shared/render-contracts.test.ts (14 tests) 2445ms
   ✓ corpse pages: bodies persist past the old cap, bounds stay conservative, culling restores identity/pose/tint, normals survive vec4 padding 1596ms
 ✓  default  tests/engine/combat.test.ts (7 tests) 1402ms
   ✓ loadout: both sides keep independent aims, racks wrap both ways with a switch lock, a cooling gun does not steal selection 435ms
stdout | tests/engine/save-progression.test.ts > L1–L10 starts clamp progressed saves and fresh handovers to story weapons, keeping eligible carry-over and selection
[campaign] selected action weapon.handgun unavailable (not in destination rack); falling back to weapon.fists
[campaign] selected action weapon.handgun unavailable (not in destination rack); falling back to weapon.bat
[campaign] selected action weapon.handgun unavailable (not in destination rack); falling back to weapon.fire-axe
[campaign] selected action weapon.handgun unavailable (not in destination rack); falling back to weapon.fire-axe

stdout | tests/engine/save-progression.test.ts > selection fallback: lost or empty weapons fall back to the best usable owned weapon, never an empty finite gun
[campaign] selected action weapon.shotgun unavailable (not in destination rack); falling back to weapon.rocket-launcher

stdout | tests/engine/save-progression.test.ts > bare hands are innate: key 1 selects fists without them entering the carried racks
[campaign] selected action weapon.fists unavailable (not in destination rack); falling back to weapon.rocket-launcher

 ✓  default  tests/engine/save-progression.test.ts (6 tests) 540ms
   ✓ save decoding: presets round-trip, v0 migrates, corrupt/unknown data and storage errors fail safely 461ms
 ❯  default  tests/shared/asset-contract.test.ts (3 tests | 1 failed) 17024ms
   ✓ crowd atlas cleanup preserves enclosed eye paint and its authored alpha class 1299ms
   ✓ uniform and civilian faces and yellow bare arms share the per-person skin class 1063ms
   × the asset validator rejects every contract violation, and every production asset passes it 14656ms
 ✓  default  tests/engine/l4-contact.test.ts (1 test) 23265ms
   ✓ L4: every contact archetype interrupts approach/lure and attacks within 3 s; soldiers remain biteable and corgi protected 23263ms
 ❯  default  tests/tools/gate-tools.test.ts (8 tests | 1 failed | 1 skipped) 22169ms
   ↓ e2e-lock legacy fallback (E2E_LEGACY=1): units are reserved across concurrent jobs, never exceed two GPU browsers, and invalid reservations are refused
   × browser pool admission backs off under WindowServer pressure, keeps a one-context floor, recovers only after three cool samples 4118ms
   ✓ scene gate resume requires identical rows, revision and backend identities 3477ms
   ✓ scene gate rejects stale, failed, malformed and incomplete child results 4373ms
   ✓ scene gate rejects invalid arguments and empty selections before running children 8058ms
   ✓ build-cache honors custom output arguments on repeated clean invocations 321ms
   ✓ build-cache publication never leaves an interrupted copy looking complete 1701ms
   ✓ remote runner cache GC removes inactive caches while keeping the current cache and live jobs 112ms
 ✓  default  tests/engine/infected-ai.test.ts (5 tests) 6108ms
   ✓ every human and animal role validates and spawns with its catalog health and speed; every attack is telegraphed 1253ms
   ✓ perception: sight cone, facing-independent gunshots, silent melee misses, bounded kill noise, screamer radius 3852ms
   ✓ melee knocks down for a seeded 10-20 s, respects the L2 recovery pool, then up at full HP; explosives and burns kill for good 714ms
 ✓  default  tests/engine/input.test.ts (5 tests) 95ms
 ✓  default  tests/engine/collision.test.ts (4 tests) 2428ms
   ✓ admission: parked vehicle hulls exclude bodies, coincident spawns separate, a thin wall never admits a body through it 2155ms
 ✓  default  tests/engine/npcs.test.ts (3 tests) 15217ms
   ✓ civilians: seeded grab → bite → down → glowing eyes → rising → infected cycle in place; panic flees; a kill during the grab saves 1289ms
   ✓ escort: shared combat pace, follows through a maze, a 2 s stand revives to 50 %, unattended 20 s down fails the mission 1401ms
   ✓ corgi: warns of an offscreen threat within 18 m with a unit direction 12526ms
 ✓  default  tests/engine/world-systems.test.ts (5 tests) 1300ms
   ✓ interaction: rings fill and decay, complete once, nearest instant wins in range, damage floors interruptible progress 412ms
   ✓ explosions: every class follows its damage curve, full cover shields, rails take damage, chains are paced and capped, fires burn out 391ms
   ✓ look-l6-l9 decor is render-only: L6 nav hash, colliders and pushables match the layout without it, a re-preparation adds none, L9 has none 340ms
 ✓  default  tests/tools/qa-drivers.test.ts (3 tests) 192ms
 ✓  default  tests/engine/vehicles.test.ts (2 tests) 10431ms
   ✓ handling: deterministic scripted drives, speed-dependent steering for every vehicle, braking before reverse, flip recovery 390ms
   ✓ enter, drive and exit: door dwell, input ownership (no attacks while driving), capsule-safe exit on the free side; bike stand-to-mount needs an approach 10034ms
 ✓  default  tests/engine/navigation.test.ts (4 tests) 25243ms
   ✓ A*: budgeted search resumes across ticks within its expansion budget; connectivity tells a long route from an enclosed yard 24721ms
   ✓ chasers path through a maze and an offset district without ever overlapping a static collider 412ms
 ✓  default  tests/engine/spawn-director.test.ts (4 tests) 11366ms
   ✓ a 150-infected migration follows its spline on time and fans out at the goal 1931ms
   ✓ pooling: spawn/kill cycles reuse prewarmed records, keep every corpse, and refresh borrowed collision radii 8948ms
 ✓  default  tests/engine/aim-assist.test.ts (3 tests) 608ms
   ✓ keyboard fire at all eight facings: Off shoots along the facing, Default lands on the zombie in front 530ms
 ✓  default  tests/engine/input-log-codec.test.ts (2 tests) 2309ms
   ✓ input log codec (2)
     ✓ round-trips every InputFrame field and scheme exactly, with float64 precision and commands at their sample index 788ms
     ✓ cuts independent chunks under the upload cap, decodes them in order, survives gzip and rejects gaps and garbage 1518ms
 ✓  default  tests/engine/director-pressure.test.ts (3 tests) 1844ms
   ✓ director pressure brings every native role to its human without replacing its combat role 745ms
   ✓ native routing clears thin doorways and yields failed shared searches 1084ms
 ✓  default  tests/engine/player.test.ts (3 tests) 4558ms
   ✓ walls: a 72-direction capsule sweep never penetrates the wall ring; sliding keeps 60 % tangential speed; head-on corners slip 4209ms
 ✓  default  tests/engine/missions.test.ts (6 tests) 60615ms
   ✓ every objective type completes through the real sim exactly once 802ms
   ✓ graph timing: parallel tasks join in any order; a timeout fires exactly at 120 s, retry restores the timer, completion cancels it 1874ms
   ✓ interactions: ring, input and view predicates agree for every interact step of every level 34322ms
   ✓ interactions: only the open L6 gate the group is heading for offers its prompt 14585ms
   ✓ checkpoints: death restores objectives, HP, charges and escorts; a boss killed before or after C stays dead 9015ms
 ✓  default  tests/engine/core.test.ts (4 tests) 252ms
 ✓  default  tests/engine/l10-camera-framing.test.ts (3 tests) 354ms
 ✓  default  tests/tools/browser-pool-client.test.ts (1 test) 17ms
 ✓  default  tests/tools/playtest-finale-retreat.test.ts (1 test) 9ms
 ✓  default  tests/shared/architecture.test.ts (2 tests) 5377ms
   ✓ the sim import graph never reaches renderer, UI, debug or DOM code (Three math, synchronous save codecs and Rapier) 3508ms
   ✓ lint rejects unseeded randomness, DOM and renderer imports in the sim 1863ms
 ✓  default  tests/engine/determinism.test.ts (4 tests) 22636ms
   ✓ render rate does not change the simulation: 600 ticks hash the same at 30, 60 and 144 Hz 315ms
   ✓ a serialized recording replays the identical state hash at every tick; snapshots are copies; reset frees everything 870ms
   ✓ real levels replay deterministically: same seed and script give the same hash on L1, L4 and L10 21436ms
 ✓  default  tests/tools/test-budget-tools.test.ts (1 test) 26954ms
   ✓ test budget collection is passive, rejects missing counts and bounds collection with child cleanup 26952ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL   default  tests/shared/asset-contract.test.ts > the asset validator rejects every contract violation, and every production asset passes it
AssertionError: expected [ …(4) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "veh.school-bus:lod1: emissive mesh body:emi_sirenRed has no light anchor (reference it or flag decorativeEmissive)",
+   "veh.school-bus:lod1: emissive mesh bonnet_emi_windowGlow has no light anchor (reference it or flag decorativeEmissive)",
+   "veh.school-bus:lod2: emissive mesh body:emi_sirenRed has no light anchor (reference it or flag decorativeEmissive)",
+   "veh.school-bus:lod2: emissive mesh bonnet_emi_windowGlow has no light anchor (reference it or flag decorativeEmissive)",
+ ]

 ❯ tests/shared/asset-contract.test.ts:188:68
    186|   const reports = await validateAssets(sample, true);
    187|   expect(reports.length).toBeGreaterThanOrEqual(sample.length);
    188|   expect(reports.flatMap(r => r.errors.map(e => `${r.id}: ${e}`))).toE…
       |                                                                    ^
    189|
    190|   // r6-truck: the seated open-cab cut stays inside the fire-engine cr…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL   default  tests/tools/gate-tools.test.ts > browser pool admission backs off under WindowServer pressure, keeps a one-context floor, recovers only after three cool samples
AssertionError: expected 'STALE' to be 'FRESH' // Object.is equality

Expected: "FRESH"
Received: "STALE"

 ❯ tests/tools/gate-tools.test.ts:68:75
     66|   const reviewed: ReviewDecision = { ...review, row: 'L1-01', commit: …
     67|   expect(reviewFreshness(reviewed, 'L1')).toBe('FRESH');
     68|   expect(reviewFreshness({ ...reviewed, sourceDigest: undefined }, 'L1…
       |                                                                           ^
     69|   expect(reviewFreshness({ ...reviewed, sourceDigest: '1'.repeat(64) }…
     70|   expect(reviewFreshness({ ...reviewed, sourceDigest: undefined, commi…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯


 Test Files  2 failed | 25 passed (27)
      Tests  2 failed | 104 passed | 1 skipped (107)
   Start at  03:54:39
   Duration  88.67s (tests 87%, transform 7%, import 5%, setup 1%)

[test-budget] test: 95.4 s (budget 240 s)
[test-budget] FAIL: test failed (exit 1)
[test-budget] See docs/qa/test-strategy.md: merge into an existing test or delete one before adding another.

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
dist/build/prefetch.worker-EVAU2vl0.js          1,064.83 kB
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
dist/build/DebugInfo-CKT902Ad.js                    2.70 kB │ gzip:     1.19 kB
dist/build/crowd-Bw3xHp2e.js                        3.10 kB │ gzip:     1.58 kB
dist/build/lookPatch-BJ2Iw5hk.js                    5.68 kB │ gzip:     2.88 kB
dist/build/probe-DKgptAsS.js                        7.52 kB │ gzip:     3.08 kB
dist/build/footSoles-zVWxjPI_.js                   10.41 kB │ gzip:     3.54 kB
dist/build/index-TGKAJU7m.js                       12.43 kB │ gzip:     4.49 kB
dist/build/Inspection-BI1qgsZk.js                  12.86 kB │ gzip:     4.41 kB
dist/build/MotionLab-6E8C8aoQ.js                   18.38 kB │ gzip:     7.96 kB
dist/build/LevelFiveBot-DV_jaiAg.js                23.12 kB │ gzip:     6.86 kB
dist/build/survivor-DjMktlck.js                    24.62 kB │ gzip:    10.09 kB
dist/build/index-BG5LWxjW.js                       28.31 kB │ gzip:     7.75 kB
dist/build/LevelSixSubway-DUcWVLfm.js              29.72 kB │ gzip:    11.23 kB
dist/build/testApi-EGzSRY7X.js                     37.42 kB │ gzip:    13.63 kB
dist/build/Physics-Js5RuGoW.js                     83.09 kB │ gzip:    29.09 kB
dist/build/light-anchors-LtMS8stq.js               92.62 kB │ gzip:     6.95 kB
dist/build/SceneLab-BViPWnk1.js                   105.02 kB │ gzip:    36.18 kB
dist/build/Pickups-B0Up07Pz.js                    105.62 kB │ gzip:    36.37 kB
dist/build/PropSystem-IEYVnEp9.js                 140.56 kB │ gzip:    47.73 kB
dist/build/Debug-C5mqunPp.js                      155.77 kB │ gzip:    33.05 kB
dist/build/registry-BAbZ-NTQ.js                   211.04 kB │ gzip:    72.19 kB
dist/build/rapier-ykuY6d4E.js                     212.13 kB │ gzip:    36.16 kB
dist/build/infected-DDjoVemc.js                   287.26 kB │ gzip:    89.12 kB
dist/build/three-core-CzPK-9TN.js                 307.37 kB │ gzip:    82.85 kB
dist/build/WeatherView-CYWbTs76.js                364.34 kB │ gzip:    42.26 kB
dist/build/three-webgpu-B5ei5MQw.js               688.68 kB │ gzip:   192.65 kB
dist/build/wreck-roofs-GAckelu8.js                755.61 kB │ gzip:   251.68 kB
dist/build/install-4dEjmUIK.js                  1,069.19 kB │ gzip:   201.59 kB
dist/build/index-Dd2npFTX.js                    1,376.72 kB │ gzip:   432.26 kB
dist/build/character-clips-CGKWtM3S.js          1,939.70 kB │ gzip:   336.59 kB
✓ built in 24.51s
[remote] pulled dist
[remote] pulled test-results/epics/E25
[remote] done exit=1 (runner 94.130.181.173, sync 33s, remote total 227s)
```
