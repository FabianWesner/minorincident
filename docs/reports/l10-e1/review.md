# L10-E1 encounters and checkpoint route

R1–R4 slice of E32-AC02/05/06/09/27, with the corresponding regional readability and E18 checks. The existing S1 mission owns the ordered axe → handgun → shotgun → machine gun transactions. No specs, assets, dependencies or budgets changed.

## Implementation

`src/levels/L10/encounters.ts` authors six crash regulars in three avoidable pairs, fringe patrols with two dogs, tougher depot workers with three dogs and one regular Alpha, and military groups with three dogs and two regular Alphas. Region totals high/low are **6/6, 20/14, 37/25, 59/38**. Low thins ordinary humans while retaining dogs, tough individuals and Alphas. The first minute remains limited to crash regulars; geographic entry and chunk residency reveal subsequent encounters. Changing loadout alone creates zero enemies.

The existing infected director supplies safe off-screen placement, cap and pool checks. Shared chunks retain entity IDs/HP/timers/corpses; the small once-only slot ledger joins the existing checkpoint seams. Deferred members retry individually rather than disappearing when a cell is blocked or the cap is full. Stable role keys prevent dog/Alpha duplication across quality changes.

Seven ordinary medkits cover the three weapon checkpoint approaches, crash exit, fringe detour, industrial service road and military motor pool. The existing alternate routes remain navigable. Tests require each medkit position to be clear, health to increase only once, and consumed state/IDs to survive unload/revisit. Arsenal grants and checkpoint snapshots continue to share S1's transaction.

## Validation

| Check | Result |
| --- | --- |
| Typecheck / lint / fresh production build | Pass |
| Full unit suite, Hetzner, ≤4 workers | 1,392 passed; 7 skipped |
| Final E32 + smoke sim selection, Hetzner | 89 passed |
| Focused depth/medkit and R1–R4 route fixtures | 5 passed; original assertions retained |
| Desktop E32 + smoke browser checks | 31 passed, ≤2 workers |
| Scene Lab quality/zoom/backend matrix | 60/60 passed |
| Native gameplay E18 sweep | 8/8 passed; full `npm run verify -- E32` green |

The seed-32 R1–R4 route uses ordinary logical movement, aim/fire and weapon-selection input, with **full health and zero deaths** at the finish. It checks each ordered checkpoint/weapon, retry location/loadout and collision/nav/chunk budgets. No god mode, arsenal grants or completion cheats are used in this route. Focused fixtures separately prove inventory independence, the first-minute restriction, Alpha counts, persistence and medkit accessibility. No assertion or budget was weakened.

Final focused route sim p95: **1.41 ms high / 0.66 ms low**. Per-region traversal seconds high/low: R1 57.02/57.02, R2 134.17/134.17, R3 167.57/167.57, R4 179.92/179.98. This direct-route combat fixture proves the lane's playability; the calibrated newbie 45–50 minute full finale remains the E3/Q3–Q6 pacing task. The full final E32 selection also passed the existing 200-infected Mega timing test; an earlier shared-runner 4.25 ms failure and isolated unchanged-budget pass are retained in local logs.

The native performance fixture now advances through the opening minute before its rapid anchor teleports and preloads the military approaches. It enables god mode only for that isolated stress measurement and requires an actual military resident peak ≥45/28 high/low. Otherwise a short sweep could accidentally measure the old empty greybox. All existing frame/sim/draw/triangle/chunk/heap upper budgets remain intact.

## Reviewed game-camera evidence

Five scenes × high/low × zoom 1.5/1/0.5 × headless native WebGL2/WebGPU, after a fresh build. Requested-backend gates confirm WebGPU did not silently fall back. Evidence: [WebGL high](webgl2-high.jpg), [WebGL low](webgl2-low.jpg), [WebGPU high](webgpu-high.jpg), [WebGPU low](webgpu-low.jpg), [live checkpoint loadouts](checkpoint-loadouts.jpg), [counter/gate records](matrix.json). Full sequences/metrics: `test-results/epics/E32/E1/{webgl2,webgpu,health-webgl2,health-webgpu}/`.

- **A/C, reused assets — scoped pass:** The warm courier contrasts with the established cool night roads. Existing humans, quadrupeds, Alpha and medkit remain recognizable at game-camera distance, with adult human proportions and no new asset/material edits. Full unit asset/LOD guards pass. District art direction and new asset turntables remain with their existing owners.
- **D — pass:** The courier is immediately identifiable. Upright humans, low dogs/red eyes, and heavier regular Alphas with stock bars remain distinct. Amber dog windups and cyan Alpha move areas read over consecutive frames. The service-road medkit's red case/white cross are fully visible at close zoom, with zero measured ground offset. Low retains the dangerous species while thinning regulars.
- **F, existing HUD — scoped pass:** Live checkpoint photos show the recovered shotgun/MG, nearby medkit and correct next objective on both tiers. The objective/minimap do not overlap the action. No HUD layout changed; this is not a new approval of physical-phone HUD legibility.
- **G, night readability — scoped pass:** Player and pickup ground pools, lit courier and bright telegraphs remain visible against the dark roads. The quiet service route contrasts with the crowded depot. Backend compositions match. No lighting/reflection system changed.
- **H — not applicable to this lane:** E1 adds no explosions, fire or smoke; cure mist/finale effects belong to subsequent lanes.

Scoped encounter/health pairs score 8/10 or better, with no P0/P1 in the reviewed fixtures. This does not claim full E32 art/HUD/effects approval.

Scene counters peak at **45 draws / 234,409 triangles high**, **43 / 101,076 low**, on either backend (shadow pass reported separately). Every fixture also gates at the stricter 300 draws / 500k triangles. Scene step timings include render submission and do not claim GPU fps; gameplay frame/sim/heap measurements come from the native sweep.

This report approves the owned encounter/health slice. Full finale/epilogue, campaign timing, five complete region cycles and physical phone evidence remain with their named E/Q lanes. Reproduction commands are in [commands.md](commands.md).

## Native performance result

All eight requested backend/quality/zoom combinations passed under the exclusive quiet-run lock, with real 59/38 high/low military peaks. [Per-case measurements](native-perf.json) and [validation summary](validation.json) retain the actual zooms, backend, every sampled region and budgets.

| Maximum across backends/zooms | High | Low |
| --- | ---: | ---: |
| Frame p95 (ms) | 6.70 | 5.60 |
| Sim p95 (ms) | 1.10 | 0.90 |
| Draw calls | 169 | 162 |
| Triangles | 420736 | 43681 |
| Detailed chunks | 25 | 9 |
| Infected | 59 | 38 |
| Heap (MB) | 214.05 | 166.37 |

Preflight recorded load 2.54, no other headless Chrome or local Vitest, and all configured browser slots held. Browser tests used at most two workers; native timing used one. No deploy or merge was performed.
