# Batch 112 real-input browser QA — in progress

Candidate `cc2f7476c7e7834d5060b07a2b654a5d1cb1c873` (batch 112). **No gameplay acceptance result yet.** The QA build, typecheck and lint pass. Browser execution is pending because the worktree sandbox rejects the required local preview bind (`EPERM` on `127.0.0.1:5019`); the shared browser pool is also currently unavailable. No production or playtest source was changed.

## Scope and method

Requested method: real keyboard/mouse playtest driver, ordinary mortal combat, HIGH before LOW, WebGPU, headless, one browser through `tools/e2e-lock.sh` / browser pool, ports 5019/5020. Planned L9 matrix is HIGH road ×2, HIGH shortcut ×1, LOW road ×1 with `PLAYTEST_L9_EVAC_AUDIT=1`; planned L4 tank attack view is HIGH zoom 1.5; planned broad sweep is L1/L2/L3/L5/L7/L8 at HIGH zoom 1 for about four minutes each.

The report has no in-game capture or gameplay tick to cite. The blocker is captured in the command record below and is not a product finding. No contact sheet is attached because no game frame was produced or reviewed. Raw gameplay captures therefore do not exist for this batch.

## Browser admission attempts

1. `npm run playtest -- --levels L9 --quality high --zoom 1 --l9-route road --level-minutes 8 --out test-results/playtest/b112-l9-high-road-1` completed the QA build, then tsx could not create its temporary IPC socket under the default temp directory (`EPERM`).
2. Retried the same L9 run using `TMPDIR=/private/tmp` and Node's ESM tsx loader. The preview did not become reachable on port 5019 and the launcher exited before browser execution.
3. Confirmed with a direct Vite preview startup on the required port: `listen EPERM: operation not permitted 127.0.0.1:5019`.
4. `sh tools/browser-status.sh` reports `Browser pool unavailable (fetch failed)`.
5. Retried the guarded admission wrapper with a writable temporary pool cache: `TMPDIR=/private/tmp MI_WORKTREE_CACHE=/private/tmp/mi-b112-cache E2E_PORT=5019 SCENE_PORT=5020 E2E_RESERVATION_SECONDS=60 E2E_ADMISSION_TIMEOUT_SECONDS=30 sh tools/e2e-lock.sh true`. Pool startup failed with `listen EPERM` on `127.0.0.1:4329` (and its 4321 probe); no browser launched. The pool log is `/private/tmp/mi-browser-pool.log` and is not a report artifact.

These attempts produced no gameplay evidence and do not count as coverage. Retry the ordinary guarded browser workflow if the sandbox/runtime changes before the job time box expires.

## Results

| Check | Status | Evidence / open item |
| --- | --- | --- |
| L9 HIGH road ×2, HIGH shortcut ×1, LOW road ×1; evacuation timing and 2–4 fps visual review | Pending | No browser session or capture; all four runs required |
| L4 HIGH zoom 1.5 Alpha strike/roar/slam foot planting | Pending | No browser session or capture |
| L1/L2/L3/L5/L7/L8 broad sweep, HIGH zoom 1, ~4 min each | Pending | No browser session or capture |
| Contact sheet reviewed | Pending | No gameplay frame could be captured |
| Typecheck | Pass | `npm run typecheck` |
| Lint | Pass | `npm run lint` |
| Prescribed remote unit suite | Not run | `sh tools/remote/run.sh "$PWD" -- npm test` exited 69 before test execution: no healthy Hetzner runner; local Mac fallback disallowed by runner policy. This was not a runner timeout. |

## Findings and driver gaps

No P1/P2/P3 gameplay finding is established: there are no batch 112 gameplay captures or ticks to support one. Driver gap: local preview binding is denied by the current sandbox, preventing all requested real-input checks and the contact sheet. The L9 boarding deadline, route naturalness, bridge stall attribution, L4 foot sliding, broad level glitches/appeal, and screamer arrow judgment remain unmeasured.

The JSON ledger is [qa.json](qa.json). It records the candidate, commands, validation status, and pending coverage. No raw captures were added.

## Browser access restored

The sandbox restriction was removed on continuation. The first HIGH WebGPU road run completed L9 in 221 seconds with zero skips and zero driver issues (`test-results/playtest/b112-l9-high-road-1`). Its frequent captures and evacuation census are awaiting review; this is not yet an evacuation timing or visual pass. The prescribed remote suite now passes on 46.225.66.90: 27 files, 105 passed / one skipped, full 150-case inventory, 134.9 seconds. Earlier environment failures above are historical. Remaining matrix runs, visual review and contact sheet remain pending.

### HIGH L9 matrix collected

Both road runs and the shortcut completed with zero skips and zero driver issues (221 / 235 / 190 seconds). Road 1 last living native evacuation is observed +1.02 s after Defense complete; road 2 +13.47 s. The earlier road-2 +0.48 s figure used `aboard`, which also includes APC passengers, and is invalid as truck boarding proof. The JSON now uses `census.evacuated`. Maximum recorded grab ages are 0 / 180 ticks for the roads. Road 2 visual sequence reviewed under `test-results/b112-review/road2.jpg`: running survivor and advancing boarding are visible; dense crowd occlusion prevents ruling out subtle sliding or brief infected penetration. Shortcut frames await review.

### L4 HIGH zoom 1.5 sample

Collected 240 seconds of ordinary real-input combat with no objective skips (`test-results/playtest/b112-l4-high-z15`). Reviewed `test-results/b112-review/l4.jpg`, ticks 5993–11507: busy plaza fighting, multiple large Alphas, corpses and explosive pressure; visually lively and dangerous. These wide samples do not establish planted soles during every strike/roar/slam at the tank. Driver gaps: empty opening HUD warns at tick 1253; the four-minute no-skip cap stops on the newly entered cellar route at tick 14236 and emits an automatic cannot-finish label. Neither establishes a product P0. Exact captures are in that run’s captures directory. Tank attack sequence review remains pending.

### L1 HIGH zoom 1

Completed the level in 143 seconds with no skips or driver issues (`test-results/playtest/b112-l1-high`). Reviewed sheet `test-results/b112-review/l1.jpg`, ticks 947–8092: bright readable streets and clear silhouettes; quiet package delivery escalates to pursuit and melee on returning to the clinic. Pleasant and legible rather than spectacular in the quiet opening, then purposeful pressure. No obvious geometry glitch in inspected frames. This covers the complete level but is shorter than the requested approximate four-minute sample because the mission finished.

### L2 HIGH zoom 1

Collected 241 seconds without skips, ending at the bridge-route sample cap. Reviewed `test-results/b112-review/l2.jpg` ticks 1558–13498: strong fire-engine staging and readable bright streets, then crowd pressure and repeated retreat/return around the market. The repetition feels less engaging than the staging, but driver navigation/deaths confound a product pacing judgment. No obvious geometry glitch in these frames. Driver warnings at ticks 1244/2713/2921 concern axe pickup and empty-HUD navigation; automatic tick-14287 cannot-finish is the four-minute cap, not a verified product P0. Exact issue captures and ticks are retained in qa.json.

### L3 HIGH zoom 1

Collected 240 seconds, no skips. **P2 provisional — close infected takes no damage during driver fire:** tick 10983, `test-results/playtest/b112-l3-high/captures/campaign-L3-10983-enemy-unhittable.jpg` (opened and reviewed). Driver reports #793 at 0.1 m, 60/60 HP after eight seconds of attacks. Capture shows the courier tightly surrounded on a narrow bridge and overlapping red telegraphs. Target selection, muzzle occlusion and product hit logic remain unseparated; this is not proven invulnerability. Bridge crowd pressure reads dangerous and visually dramatic, with clear courier outline, rather than harmless. Repeated confinement is frustrating in this driver sample. Four-minute stop at tick 14270 is a driver cap, not product P0. Broader frame review remains pending.

### L5 HIGH zoom 1

Collected 240 seconds with no skips. Reviewed `test-results/b112-review/l5.jpg`, ticks 1540–13514: atmospheric ash-dark streets, scattered persistent bodies, readable red Alpha warnings, and recurring combat around the fire station. The repeated search/return feels repetitive in this sample; it is not harmless, but survivor rescue/babysitting is unexercised because the driver remains on “Look for anyone still alive.” No obvious geometric glitch in inspected frames. The sole emitted issue is the sample cap at tick 14142 (`test-results/playtest/b112-l5-high/captures/campaign-L5-14142-cannot-finish.jpg`), not a verified product P0.

### L7 HIGH zoom 1

Completed in 183 seconds with zero skips/issues. Reviewed `test-results/b112-review/l7.jpg`, ticks 931–9470: dense dark escort, strong fire-lit departure, readable courier outline. “Wait for us! Stay with the group” at tick 3449 and “Survivor lost behind you” at 4688 make group-speed management conspicuous: this sample feels like babysitting amid real crowd pressure. The fire/departure staging is visually appealing; no obvious geometry glitch in sampled frames. Initial admission failed `external-exclusive` before execution; normal guarded retry succeeded. Full mission is shorter than the approximate four-minute request. No ordinary off-screen scream arrow judgment established by these frames.

### L8 HIGH zoom 1

Collected 241 seconds with no skips. Opened the tick-5252 follow warning capture (`test-results/playtest/b112-l8-high/captures/campaign-L8-5252-stuck-at-ring.jpg`) and `test-results/b112-review/l8.jpg`, ticks 1658–13474. Quiet Nadia following feels like group babysitting; the later crowded plaza ring is more dramatic and dangerous. The warning frame shows Nadia ahead with a visible ring and the courier six metres behind; subsequent frames reach the plaza fight and habitat objective, so a permanent mission stall is not supported. No obvious geometry glitch in inspected frames. Tick-14264 cannot-finish is the four-minute cap; follow-navigation warnings remain driver gaps pending exact cause. No ordinary off-screen scream arrow assessment is established by these frames.
