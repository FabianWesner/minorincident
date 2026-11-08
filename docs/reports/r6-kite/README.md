# r6-kite — kiting gate and L7 driver

Frozen main base: `f4bba5cf9bb269d288dfcb31687bc86e4031f9aa`. Runtime, public assets, specs and accepted L1/L2/L4/L5 tuning are unchanged. No dependencies, deploy or push.

## Fixes and findings

| Severity | Finding and cause | Change / result |
|---|---|---|
| P1 | Threat checks omitted walking away while firing back. | `fa193ad7`: add the kiting policy, infected-windup counter, per-level report and ≥2/min floor. `5b700e7e`: cover L1's partial `setInput` path as well as `applyInput`, exclude dead frames, and prevent injected fire leaking into native patches. |
| P2 | L7's physical-input driver fought at the truck instead of taking the launcher 3 m away. | `50766d9d`: prioritize the visible pickup before combat. All eight fresh/progressed × low/high × zoom 1/1.5 entries plus the additional progressed/low/WebGPU spot acquire it; first observed corridor step is at **1.57–3.22 sim seconds**. |
| P2 | r5-l7 reported a high-tier follower-66 departure pace miss. | Does not reproduce on this main base: **98.8% / 101.2%** of group median in seeds 2/3. No game fix is justified by these measurements. |

### Kiting policy and main measurements

The QA policy samples the first nearby dense horde in an existing marked combat phase. It walks away while aiming back and holding mouse fire for the current weapon, for up to 20 seconds. It uses clear retreat directions/tangents and physically rejoins the sampled route point. The original skilled seed-1 route supplies both its ordinary observations and the kiting receipt; passive windows and extra seed routes remain unchanged.

The floor counts **infected windups targeting the courier**, including interrupted windups. Courier shots and attacks on followers do not satisfy it. Initial proposal: **2/min for every on-foot horde level**, retaining zero-rate failures. The positive main measurements provide headroom above that minimum; short samples are identified rather than presented as a calibrated difficulty curve. L9's driving route is N/A. Missing on-foot coverage elsewhere is a failure.

Two harness causes were fixed during validation: an unconstrained retreat could leave L7's navigation grid at the truck apron, and L1's generator writes partial inputs through a different method. Existing proof fixtures cover retreat/fire direction, clear-ground steering, selected RIGHT-weapon mouse mapping, infected-only counts, partial-input cleanup and dead-player exclusion. No game rules or target counts were adjusted.

**Final frozen-main audit:** 508.3 s internally, **516.1 s for the budgeted command**, below the unchanged 600 s limit. All ten skilled routes completed; all nine on-foot routes have measured kiting frames. The gate exits 1 for seven gameplay flags, with no missing coverage or budget failure. [Permanent measurement receipt](measurements.json).

| Level | Active kiting seconds | Infected attempts | Attempts/min | ≥2/min |
|---|---:|---:|---:|---|
| L1 | 18.32 | 18 | 58.96 | PASS |
| L2 | 10.50 | 0 | 0.00 | FAIL |
| L3 | 3.23 | 0 | 0.00 | FAIL |
| L4 | 19.65 | 22 | 67.18 | PASS |
| L5 | 6.93 | 0 | 0.00 | FAIL |
| L6 | 12.88 | 1 | 4.66 | PASS |
| L7 | 4.58 | 0 | 0.00 | FAIL |
| L8 | 5.38 | 0 | 0.00 | FAIL |
| L9 | 0.00 | 0 | 0.00 | N/A driving |
| L10 | 19.12 | 22 | 69.05 | PASS |

Five kiting failures: **L2, L3, L5, L7 and L8**, all zero attempts. The other two flags are L2 collapse with zero skilled windups and L8 breached follower 364 being slow. L1 records one route death; completion is not a no-damage claim. These are measurements on the frozen main game, without parallel L3 changes. Short encounter samples make this a minimum-pressure alarm; longer difficulty characterization remains follow-up.

[Harness source verification](source-match.json) records live remote SHA-256 matches to the committed harness. Game source matches the frozen main base, without the parallel r6-l3 changes.

### L7 launcher before / after

**Before:** [r5-l7](../r5-l7/README.md) records the courier stopping about 3 m short, fighting with the army MG for 50 s and losing most followers before pickup.

**After:** every tested L7 entry starts without the launcher and ends with it in the rack. The fresh/high/WebGL2/zoom-1 run observes the corridor by 2.25 sim seconds and retains 24/24 nearby followers at its 62-wall-second sample end. The fresh/high/zoom-1.5 full run finishes in **216 wall seconds**, zero deaths, no skipped objectives: **9 boarded, 15 died en route**. Its corridor step is observed by 2.62 sim seconds. The opening stall is fixed; that does not establish successful protection of the whole group later in the level.

[Small post-fix L7 evidence sheet](../../../test-results/r6-kite/L7-driver-sheet.jpg). All tiles are after the fix; the entry tile shows the initial 3 m gap, not a recreated pre-fix stall. The full-run blast frame shows a prone but discernible courier amid heavy blast/corpse clutter. The opened departure frame shows the bus and lit ash-filled city, with no exposed map void in that view.

### L7-09 departure pace

| High-tier native complete run | Follower 66 | Group median | Ratio | Walking samples |
|---|---:|---:|---:|---:|
| Seed 2 | 4.542 m/s | 4.599 m/s | 98.8% | 27 |
| Seed 3 | 4.553 m/s | 4.500 m/s | 101.2% | 23 |

The required floor is 95%. Raw receipts: `test-results/r6-kite/pace-high.json`. The old 0.896/0.914 miss was not reproduced. `qa:accept -- --level L7 --skip-browser` ran both tiers/policies: the native corridor pace checks pass, while L7-09 remains NOT CHECKED through stale manual review/visual clauses. Overall acceptance remains 1 fresh failing row and 8 incomplete rows; this lane does not declare E29 accepted.

## Real-input evidence

Physical WASD/mouse through the repository playtest driver, mortal courier, no skips or teleports. There are 20 gear × quality × zoom samples, two additional on-foot tier-2 replays, three bounded fresh L7 samples, an additional progressed/low/zoom-1.5/WebGPU spot and one full fresh L7 run. WebGPU spots include low tier 0, high progressed L7 and low fresh L7. Completion receipts verify actual quality, backend, zoom and target zoom. No console/page errors were recorded.

Gear 0/1/2/3 use valid L2/L3/L4/L5 progression presets; tier 4 uses L7's normal boundary preset. Lower-tier presets cannot simply be promoted to L7 because the save validator requires the earned reward count. Tier 2 is also replayed on foot in L3 from the valid later save. These are natural saved loadouts, not cosmetic-tier overrides. Most samples are bounded openings, **not full-level completion proofs**. Entry photos can precede the zoom input; the end frames and completion receipts establish the requested zoom.

All 52 source captures in the 26 entry/end pairs below were opened at native resolution in labelled pairs; the two additional full-run captures were opened individually. [Capture names, hashes, settings and descriptions](captures.json). The pair headers identify each original source.

| Case / opened pair | Entry capture | End capture |
|---|---|---|
| [driver-high-fresh-z1](../../../test-results/r6-kite/driver-high-fresh-z1/pair.jpg) | L7 entry: lit army truck, courier and corgi visible, launcher pickup prompt 3 m away, followers in the ring. | Launcher held on the route, 24/24 nearby, 192 m to corridor; courier visible ahead of the column. |
| [driver-low-fresh-z1](../../../test-results/r6-kite/driver-low-fresh-z1/pair.jpg) | L7 entry: lit army truck, courier and corgi visible, launcher pickup prompt 3 m away, followers in the ring. | Launcher held amid blast/scorch effects; courier visible, 24/24 nearby, 179 m to corridor. |
| [driver-low-fresh-z15-gpu](../../../test-results/r6-kite/driver-low-fresh-z15-gpu/pair.jpg) | L7 entry: lit army truck, courier and corgi visible, launcher pickup prompt 3 m away, followers in the ring. | WebGPU: launcher held beside the follower column and APC wreck, 24/24 nearby, 208 m to corridor. |
| [gear0-high-z1-webgl2](../../../test-results/r6-kite/gear0-high-z1-webgl2/pair.jpg) | Fire-station entry: bat held, courier and corgi visible, seated civilians and firefighters present. | Fire-engine ride, crowded visible cab, destination 70 m away. |
| [gear0-high-z1.5-webgl2](../../../test-results/r6-kite/gear0-high-z1.5-webgl2/pair.jpg) | Fire-station entry: bat held, courier and corgi visible, seated civilians and firefighters present. | Fire-engine ride in a wider street view, destination 64 m away. |
| [gear0-low-z1-webgl2](../../../test-results/r6-kite/gear0-low-z1-webgl2/pair.jpg) | Fire-station entry: bat held, courier and corgi visible, seated civilians and firefighters present. | Fire-engine ride; cab occupants remain visible, destination 64 m away. |
| [gear0-low-z1.5-webgpu](../../../test-results/r6-kite/gear0-low-z1.5-webgpu/pair.jpg) | Fire-station entry: bat held, courier and corgi visible, seated civilians and firefighters present. | WebGPU fire-engine ride, readable street and cab, destination 65 m away. |
| [gear1-high-z1-webgl2](../../../test-results/r6-kite/gear1-high-z1-webgl2/pair.jpg) | Police-station entry: axe held on the roadway, courier and corgi visible, armory objective 19 m away. | Handgun acquired at the armory table; courier and corgi clear, 100 HP. |
| [gear1-high-z1.5-webgl2](../../../test-results/r6-kite/gear1-high-z1.5-webgl2/pair.jpg) | Police-station entry: axe held on the roadway, courier and corgi visible, armory objective 19 m away. | Fallback street fight beside smoke and barricades; courier visible, 87 HP. |
| [gear1-low-z1-webgl2](../../../test-results/r6-kite/gear1-low-z1-webgl2/pair.jpg) | Police-station entry: axe held on the roadway, courier and corgi visible, armory objective 19 m away. | Fallback at the station gate, with police corpses and pursuers; courier visible, 78 HP. |
| [gear1-low-z1.5-webgl2](../../../test-results/r6-kite/gear1-low-z1.5-webgl2/pair.jpg) | Police-station entry: axe held on the roadway, courier and corgi visible, armory objective 19 m away. | Station defense with approaching infected and fallen officers; courier and corgi visible. |
| [gear2-high-z1-webgl2](../../../test-results/r6-kite/gear2-high-z1-webgl2/pair.jpg) | Police-station entry: axe held on the roadway, courier and corgi visible, armory objective 19 m away. | On-foot station defense from the later save; courier visible beside the armory, 100 HP. |
| [gear2-high-z1.5-webgl2](../../../test-results/r6-kite/gear2-high-z1.5-webgl2/pair.jpg) | Police-station entry: axe held on the roadway, courier and corgi visible, armory objective 19 m away. | On-foot fallback past the hardware store and smoke; courier visible, 78 HP. |
| [gear2-low-z1-webgl2](../../../test-results/r6-kite/gear2-low-z1-webgl2/pair.jpg) | Convoy entry: courier is a bus passenger; seated actors visible through side windows. | Bus approaches the convoy destination (16 m); passengers visible through windows. No on-foot outfit claim. |
| [gear2-low-z1.5-webgl2](../../../test-results/r6-kite/gear2-low-z1.5-webgl2/pair.jpg) | Convoy entry: courier is a bus passenger; seated actors visible through side windows. | Wider convoy view, bus 7 m from destination. No on-foot outfit claim. |
| [gear2-replay-low-z1-webgl2](../../../test-results/r6-kite/gear2-replay-low-z1-webgl2/pair.jpg) | Police-station entry: axe held on the roadway, courier and corgi visible, armory objective 19 m away. | On-foot fallback in the police courtyard; courier shooting, 100 HP, bodies and pursuers visible. |
| [gear2-replay-low-z1.5-webgl2](../../../test-results/r6-kite/gear2-replay-low-z1.5-webgl2/pair.jpg) | Police-station entry: axe held on the roadway, courier and corgi visible, armory objective 19 m away. | On-foot fallback beside the hardware-store smoke; courier and corgi clear, 80 HP. |
| [gear3-high-z1-webgl2](../../../test-results/r6-kite/gear3-high-z1-webgl2/pair.jpg) | Cellar entry: machine gun held beside the corgi, door and pickup marker visible. | Street search with shotgun selected, two close infected and an attack telegraph; courier visible, 65 HP. |
| [gear3-high-z1.5-webgl2](../../../test-results/r6-kite/gear3-high-z1.5-webgl2/pair.jpg) | Cellar entry: machine gun held beside the corgi, door and pickup marker visible. | Street search beside a foreground roof reveal and wreck; courier discernible, 20 HP. |
| [gear3-low-z1-webgl2](../../../test-results/r6-kite/gear3-low-z1-webgl2/pair.jpg) | Cellar entry: machine gun held beside the corgi, door and pickup marker visible. | Still at the cellar doorway, 3 m from unbar action; courier and corgi clearly visible. |
| [gear3-low-z1.5-webgl2](../../../test-results/r6-kite/gear3-low-z1.5-webgl2/pair.jpg) | Cellar entry: machine gun held beside the corgi, door and pickup marker visible. | Street search near wrecks and an Alpha; courier visible with the group of nearby infected. |
| [gear4-high-z1-webgl2](../../../test-results/r6-kite/gear4-high-z1-webgl2/pair.jpg) | L7 entry: lit army truck, courier and corgi visible, launcher pickup prompt 3 m away, followers in the ring. | Launcher held on the apron, 24/24 nearby and 232 m to corridor; an attack warning is displayed. |
| [gear4-high-z1.5-webgpu](../../../test-results/r6-kite/gear4-high-z1.5-webgpu/pair.jpg) | L7 entry: lit army truck, courier and corgi visible, launcher pickup prompt 3 m away, followers in the ring. | WebGPU: launcher held, courier and follower column visible, 24/24 nearby, 263 m to corridor. |
| [gear4-low-z1-webgl2](../../../test-results/r6-kite/gear4-low-z1-webgl2/pair.jpg) | L7 entry: lit army truck, courier and corgi visible, launcher pickup prompt 3 m away, followers in the ring. | Launcher held against a mostly dark apron, 57 HP; followers mostly beyond the right edge, HUD 24/24 nearby. |
| [gear4-low-z1.5-webgl2](../../../test-results/r6-kite/gear4-low-z1.5-webgl2/pair.jpg) | L7 entry: lit army truck, courier and corgi visible, launcher pickup prompt 3 m away, followers in the ring. | Launcher fire and a bright upper-left blast; courier and following column remain visible, HUD 24/24 nearby. |
| [gear4-low-z1.5-webgpu](../../../test-results/r6-kite/gear4-low-z1.5-webgpu/pair.jpg) | L7 entry: lit army truck, courier and corgi visible, launcher pickup prompt 3 m away, followers in the ring. | WebGPU: launcher held beside the full follower column, large upper-left rocket blast and corpses; courier discernible, 100 HP, 24/24 nearby, 186 m to corridor. |

The two full-run captures are `driver-high-fresh-z15-full-L7-t3826.jpg` (large upper-left blast, prone courier and dense corpse field) and `...-t11046.jpg` (bus departure and city beyond). Their hashes and full paths are in the capture index.

## Validation

- `npm run build:qa`: pass; game/render source stayed unchanged afterwards.
- `npm run typecheck`, `npm run lint`, `git diff --check`: pass on the final harness.
- `node --import tsx/esm tools/qa/threat-audit.ts --proof`: pass, including the L1 adapter and live-frame checks.
- `npm test -- --maxWorkers=4`: earlier Mac run 107/107 passes. Later loaded-Mac runs time out in unchanged navigation/browser-tool cases, even at one worker. A remote normal-Git snapshot passes **106 tests, 1 platform skip, 27 files**, collection **150/150**, 100.3 s on the final exact-source snapshot. No timeout or case limit changed.
- `npm run qa:accept -- --level L7 --skip-browser`: completed, exit 1 with the acceptance state described above; generated shared status files were restored.
- Final isolated `npm run qa:threat`: completed in **516.1 s / 600 s**, exit 1 for the seven documented gameplay flags; coverage and runtime checks pass.

The runner's ordinary sync is a commitless Git file manifest. Metadata-dependent unit checks need a normal Git snapshot, so validation materialized that snapshot in its disposable private job. The final timing run uses `tools/remote/timing-isolated.sh --whole-run` to reserve both CPU slots before starting the 600 s command. An abandoned, deleted pre-uat-l6 job leaked a slot; its missing launcher/owner state and PID-1 process group were verified before termination released it.

## Still open

- Game-side causes of the newly observed kiting-floor misses; this brief explicitly forbids game-source changes for that item.
- Remaining acceptance/manual-review clauses, and the group losses in the full high-tier physical-input run.
- P2: four L2 opening samples record a 20 s optional-axe navigation delay before the automatic ride. L2 tuning was not changed.
- P3: the full L7 driver receipt reports `simSeconds: 0` after L8 resets the tick. Use the 216 wall seconds and sampled L7 ticks; this metadata issue remains open.

## PO verdict

**Stunning:** the lit truck, survivor column and departing city read coherently; the rocket/corpse view is busy and the dark apron can look sparse. This run does not earn a full visual GO.

**Boring / harmless:** the new main-source kiting measurements expose zero-attempt windows instead of hiding that tactic behind forward/standing policies. Game-side pressure still needs follow-up.

**Babysitting:** the truck-side launcher stall is removed. The full high run still loses 15 followers; protection is not established. Follower 66 itself meets the native pace floor in both reported high-tier seeds.
