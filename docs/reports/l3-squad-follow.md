# L3 squad follow and army rescue — PO 2026-10-09

Branch `lane/l3-squad-follow`. Baseline `1c31479f`. Main's police tactics (`924ea686`) merged in `7a6dfbca`.

Implementation: `e50f3a53` escort/density/rescue; `63755ba7` spread clusters/covering fire; `810491bd` spacing/hinge pose; `c51dc92d` carried army rifles; `63776a6b` finale framing; `a8c6e436` distributed emergence; `293e240d` real mouse driver correction; `3e8e309f` late-placement pose caching; `a38ed41d` packed visible hinge; `541c56e6` regenerated collision metadata; `afe8059b` every surviving officer retreats; `57b36a5e` seven-officer QA fixtures. `12e037c3` corrects and checks sidewalk pickups. Latest main `ab90c079` (medbag carry) merged cleanly in `fbf97fc0`; `a26b00d2` clears the authored Boulevard pickup; `84e2b5ec` retries another ground approach after a mouse-driver stall. Code HEAD `84e2b5ec`, followed by the report commit.

## Goal results

| Goal | Result | Evidence |
| --- | --- | --- |
| 1 Squad follows | PASS | Every living human officer joins fallback, including yard posts. Shared follower/navigation, 3–8 m band, tactical fighting/catch-up. Ten-officer tests on all three wreck routes: no stationary straggler >3 s beyond 10 m; final distances 3–8 m. Seed 1: nine retreat, eight reach checkpoint, one bite loss; near-8-m share 97.9%, max displacement/tick .222 m. |
| 2 Fivefold street population | PASS | Actual unique street spawns **83 → 408 = 4.92×**, excluding every yard-wave ID. All street main values multiply by five; final 35 pursuers count toward the total. |
| 3 Med packs | PASS | **15 → 28**: armory plus nine sidewalk packs on each street, spacing ≤35 m and packs around major clusters/before finale. A focused sim check verifies sidewalk surface (including cross streets), clear pickup positions and navigation paths from every street. |
| 4 Finishable | PASS | All three real-input streets pass without god mode. Deaths Commerce/Boulevard/Oak **0/0/1**; seven/eight/nine officers arrive. Seed-1 complete bot **0 deaths**, 212.03 sim seconds. Calm checkpoints and death-loop relief retained; L4 handover passes. |
| 5 Performance | PASS | Exact retained gameplay/assets: **2/2** high/phone tests; all unchanged timing/draw/triangle budgets pass. Quiet load **2.901**, both slots reserved, no other headless Chrome. Numbers below. |
| 6 Follow Scene Lab | PASS | Seven officers follow, fight the wave and regroup around a wreck. Final contact sheet opened and inspected. |
| 7 Army chase finale | PASS | Last 75 m, three pursuing packs **8/12/15**, L4 HMG soldiers cover escape. Seed 1: **62 army shots**, all 35 finale pursuers spawned; barrier closed at tick **12680**, after every remaining officer crossed. Seven-officer sheet shows raised arm → crossing → closure → cover fire and fallen infected outside. |
| 8 Closed gates block | PASS | Courier walking into closed arm stops; closed blocks shared NPC/infected navigation, opening restores lane. Closure waits for last living officer; dead officers cannot hold it open. Army-kit arm collider repaired globally; other L2/L3/L4 gates audited. Pressed-arm sheet inspected. |

## Implementation

The existing allied follower and E08 NPC movement/navigation are reused. Officers trail 4–6 m behind the courier in lateral bands, move out of her path, route around wrecks, disengage distant fights and catch up. The old four-officer retreat cap is removed. Officers can still die or become infected; scripted separation losses are removed. Main's aim stance, recoil, tactical moves and baton remain. Officers may fire during steps as explicitly instructed. No ally combat animation code was edited.

After the yard, covering-fire stats become damage 25, cycle .35 s, near/far hit probability .85/.55, range 22 m. Yard officers retain damage 15, cycle .667 s, probabilities .6/.25. Yard waves/headroom/cadence remain unchanged. Street density, pressure, spills and horde packs multiply by five. Five clusters spread each original group across offsets 0/−24/−12/+12/+24 m with individual nearby doors. Additional clusters wait for fallback. Street emergence is one resident every three ticks (20/s) rather than three together every ten (18/s). Existing crowd LOD, instancing, simulation LOD, retirement and **80/40** active caps retain the population without stacking it.

Med packs sit .9 m beyond each road edge: Boulevard uses a 4.4 m lateral offset, Commerce/Oak 3.4 m. The last pickup is at x122, before the crossing, keeping all 27 route packs on sidewalk surfaces. The first Boulevard pack uses x−101 on the south sidewalk to clear a prop.

Eight checkpoint soldiers use L4 HMG stats and soldier/rifle assets with the existing muzzle flashes/tracers. The boom starts open, closes after the courier and last remaining human officer, then permits the unchanged L4 handover after .7 s. Officers are directed through the arm before settling at the checkpoint.

Two asset defects were fixed: collision baking discarded the elevated authored arm, and packing flattened the visible red/white meshes into the static body. The bake retains the arm; explicit open placements omit only that arm and retain the post. Declaring `gateArm` animated preserves visible hinge meshes in all three packed LODs. Per-placement pose caching handles late-loaded checkpoints. Generated physics/collision records were refreshed; repacking changes one arm-end quantized coordinate by 0.1 mm. New regressions check both late placement posing and packed visible mesh ancestry. The actual mission photo now visibly has the arm upright at objective 13–14 m. L2's procedural sliding gates already have blockers; the separate checkpoint-gate asset already has arm/post proxies; no additional closed boom placement was found in L4.

## Validation and deaths

- `npm run typecheck`, `npm run lint`, `npm run build`: PASS.
- `sh tools/remote/run.sh "$PWD" -- npm run test:unit -- --maxWorkers=2`: **415/415**, 118 files (final merged source). An intermediate run caught two stale generated GLB hashes; regeneration resolved both. A later 414/415 run caught an authored Boulevard pickup inside an obstacle, despite its runtime snap being reachable. Its authored location was moved to x−101 on the opposite sidewalk; final static and sim checks retain their assertions.
- `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/levels/L3-follow.test.ts --maxWorkers=2`: **8/8**, including all-survivor enrollment, ten-officer steering on each street and pickup reachability. The focused pickup check was repeated after clearing the one authored obstacle contact.
- `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/levels/L3-follow.test.ts -t "sidewalk med packs" --maxWorkers=2`: **1/1**, seven unrelated tests skipped. All 27 route pickups are on exported sidewalk tile, outside every asphalt surface, clear and reachable; gaps ≤35 m.
- Remote `npx vitest run -t @smoke --maxWorkers=2`: **6 passed**, 975 skipped after the street-stream change. Final browser foundation smoke: **2/2**.
- `sh tools/remote/run.sh "$PWD" --pull test-results/epics/E21/squad-follow-bot.json -- npx tsx tools/sim-runner/l3-follow-proof.ts`: seed 1 complete, **212.03 sim seconds, 0 deaths, eight of nine officers rescued**, one bite loss. Baseline: **154.92 seconds, 0 deaths, three rescued, 83 street spawns**. Final actual street spawns **408**, all 35 finale pursuers, 62 HMG shots; planned segment population [50,120,200], near-30-m medians [14,14,18], active cap 80. No protected NPCs/god mode; no med packs needed by the bot.
- `E2E_PORT=3407 E2E_SLOTS=1 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/L3.spec.ts tests/e2e/smoke.spec.ts --project=chromium --workers=1`: **6/6**, 3.1 minutes (final merged source/driver).

| Street | Before deaths/result | After deaths/result | Officers arriving after |
| --- | --- | --- | ---: |
| Commerce | 8 / FAIL near x104 | 0 / PASS | 7 |
| Boulevard | 0 / PASS | 0 / PASS | 8 |
| Oak | 3 / PASS | 1 / PASS | 9 |

The preceding all-survivor run passed with 0/0/1 courier deaths and 5/5/9 officers arriving; its Oak death occurred in the yard (respawn near x−160). The sidewalk-only rerun passed with 0/0/0 and 5/7/5. Final merged-source/stall-recovery run: 0/0/1 and 7/8/9; the Oak death was again in the yard (respawn x−160,z4). Real browser input varies between runs. The original mouse driver could click corpses instead of ground, restored the camera before its queued click resolved, and sometimes activated HUD cards. The corrected driver resolves actual mouse clicks under their projecting camera and tries nearby ground **inside the unchanged arrival tolerance**; combat/backoff clicks reject HUD-covered points. After merging the carry lane, Oak once stalled beside a wreck near x−69 with HP100, deaths0 and no nearby infected. The driver now retries a different physical ground approach inside that same arrival tolerance after movement stalls. Every route waypoint, assertion, fight rule, 600-iteration limit and god setting remains unchanged. This death comparison includes the driver correction and merged police tactics; it is not an isolated difficulty experiment.

## Performance: before / final

`E2E_PORT=3407 E2E_SLOTS=1 PERF_CONDITIONS_LOG=test-results/epics/E21/perf-merged-conditions.jsonl sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx playwright test tests/perf/l3-budgets.spec.ts --project=chromium --workers=1`: **2/2**, 3.1 minutes. Both slots held; no other headless Chrome. One-minute load before **2.862**, final **2.901**. Phone tier uses 4× CPU throttling. The added populated-street sample uses the existing budgets unchanged. Baseline used the same test against an archived pristine build with `--config=test-results/l3-baseline.config.ts`.

| Measurement | Before | Final | Unchanged budget |
| --- | ---: | ---: | ---: |
| High attack p95 | 10.2 ms | 7.6 ms | ≤14 ms |
| High Boulevard p95 | 11.1 ms | 8.4 ms | ≤14 ms |
| High occupied street p95 | 10.5 ms | 8.5 ms | ≤14 ms |
| High occupied street draws / triangles | 196 / 723,317 | 159 / 874,288 | ≤600 / 1,500,000 |
| High fallback maximum | 28.6 ms | 14.5 ms | ≤50 ms |
| Phone attack p50 | 21.9 ms | 18.3 ms | ≤33.33 ms |
| Phone Boulevard p50 | 27.7 ms | 16.3 ms | ≤33.33 ms |
| Phone occupied street p50 | 23.5 ms | 20.3 ms | ≤33.33 ms |
| Phone occupied street p95 (reported) | 37.4 ms | 31.3 ms | No p95 gate |
| Phone occupied street draws / triangles | 178 / 387,551 | 183 / 406,965 | ≤300 / 500,000 |
| Phone fallback maximum | **53.5 ms FAIL** | **36.4 ms PASS** | ≤50 ms |

Final sampled concurrency **75 high / 36 low** (before 61/32), with the unchanged 80/40 active caps. Attack draws/triangles high 133/460,918 → 136/467,763; phone 108/296,118 → 110/301,289. Boulevard high 174/995,476 → 191/1,057,088; phone 135/382,142 → 141/396,966.

Earlier quiet attempts failed the phone fallback peak at **52.6** and **53.7 ms** while other gates passed. They remain in the evidence. A temporary CPU sample showed Rapier collider bookkeeping and render/shadow submission dominating that window; instrumentation was removed. A vehicle-LOD probe did not affect authored static wrecks and was discarded. No infected count, quality gate or performance budget was reduced. Shared-machine timings vary, so the measured differences cannot all be attributed to the code change.

## Captures inspected

`E2E_PORT=3407 E2E_SLOTS=1 SCENE_PORT=3407 SCENE_SERVER=preview npm run scene:catalog -- --filter 'qa-l3-*' --jobs 1`: **3/3**, 58 s (after the carry merge). All three final contact sheets were opened at original resolution.

- **qa-l3-squad-follow:** seven officers follow at f0–180, shoot visible tracers at the wave around f240–360 and regroup around the blue wreck at f720–900. Console errors 0, undrawn frames 0; static overlap pairs 0, actor hits 10, piercing samples 5. View draws p95 53, triangles p95 417,951; CPU sim/render submission step p95 4.2 ms.
- **qa-l3-finale:** raised arm through f0–330; courier crosses around f270–300, officers follow through f300–360. Closure begins **f365**, arm lowers at f390, horizontal at f420. Seven officers are inside; HMG flashes/tracers and infected falling/staying on the street side are visible. The army kills the nearby pursuers before they press against the arm; closed physical/nav behavior is separately tested. Console errors 0, undrawn frames 0; static pairs 2, actor hits 20, piercing 13. View draws p95 76, triangles p95 468,510; CPU submission step p95 5.0 ms, max 44.9 ms.
- **qa-l3-closed-boom:** courier pressed against the horizontal arm f30–180, remains at **x136.706**, barrier x137.1. Corgi remains outside. Console errors 0, undrawn frames 0; static/actor/piercing counts all 0. View draws p95 59, triangles 210,898, CPU submission p95 3.4 ms.

Scene step timings are CPU sim/render submission, not GPU timer queries or the performance FPS gate; shadow draws are reported separately. The finale's two static contacts are authored cafe/fence and lamp/glass seams. Actor diagnostics include infected limbs intersecting the cart/wreck and the boom's unposed diagnostic mesh during passage. These remain reported visual imperfections; no gate was loosened.

The actual mission checkpoint photo was also opened: upright arm, rifle-armed soldiers and nearby infected on the minimap. Cover tracers are visible in the finale contact sheet. Fixed preset photos can omit the player/squad when another street is chosen; the game-camera contact sheets supply the group/crossing evidence. Earlier flat-arm captures were superseded after discovering the packed-hinge defect.

## Deviations, evidence and handover

PO all-survivor retreat supersedes the original E21 3–4-officer fallback cap and scripted attrition/time targets. Legacy twenty-seed attrition/time-band tests remain unchanged and were not run, per PO validation policy. The seed-1 bot evidence predates the render-only carry merge and final pickup-position corrections; L3 mission/follower/combat code is unchanged by those updates and that bot consumed zero pickups. No twenty-seed batteries or full verify run; no spec criteria or budgets loosened.

Evidence: `test-results/epics/E21/` — baseline/final bot JSON, per-street browser JSON/logs/PNGs, baseline/final performance JSON/captures/preflight conditions, and `scenes/qa-l3-{squad-follow,finale,closed-boom}-{sheet.jpg,metrics.json}`. The report records the intermediate failures and remaining clipping diagnostics. All eight requested goals pass the stated validation. No push, deployment or merge into main.
