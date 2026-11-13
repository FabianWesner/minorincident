# Batch 91 real-input QA — HOLD (in progress)

**Timebox closeout, 2026-11-13 06:01 UTC: HOLD. The full QA objective is not achieved.** Report, evidence index and one inspected contact sheet are retained. No confirmed gameplay P1/P2 is assigned; the intermittent L9 final-bay wait remains a candidate. Missing coverage independently prevents GO. All checks/browsers owned by this job have ended. No game fixes, push, deployment or main movement occurred.

Final validation: fresh production and QA builds passed; typecheck and lint passed; unchanged prescribed remote suite rerun passed106 tests, one skipped,27 files in222.5 s. Initial infrastructure failures and one transient suite failure are attempt history below, not the final validation status.


Target PROD revision: `d9db5d49` (worktree HEAD). This report records an infrastructure-blocked QA attempt; it does **not** claim the requested HIGH then LOW real-input coverage was completed.

## Resumed execution — 2026-11-13

The sandbox restriction was lifted. The existing browser pool was healthy; one GPU context was used, through the playtest driver and pool wrapper, on ports 4941/4942. A fresh QA build passed.

HIGH zoom 1 L6: an eight-minute real-input run completed its observation window, but did not finish L6 or reach the first hatch. It progressed through shelter → stop → retreat and yielded at checkpoint `abandon`, tick 28390. Full post-hatch cadence remains open. Raw receipts and captures: `test-results/s94-b91high/high-z1-l6/`. Captures have not yet been opened, so no visual conclusion is claimed. The driver's one P2 warning concerns the scripted shelter rest and needs review before promotion to a finding.

The prescribed remote unit suite ran on 46.225.66.90: 105 passed, one skipped, one failed (27 files; 211.2 s inside 240 s). Failure: `tests/tools/test-budget-tools.test.ts:66`, “killed watchdog must reap its process group”. This was not a timeout. No test changes were made. Browser and remote command handles were terminal before this update.

The initial infrastructure diagnosis below is retained as attempt history; its browser/runner blockers are resolved. Remaining gameplay coverage is still open.

## Additional measured evidence

- Opened L6 `campaign-L6-t27060.jpg`: courier at 6 HP under active pressure, objective 189 m away. The run had eight deaths and one driver assist. This first run used default WebGL, so it does not qualify the requested WebGPU pass.
- L7 HIGH zoom 1, explicit WebGPU, completed in 302 s, six deaths, zero assists, no skipped objectives. The driver's `simSeconds: 0` is invalid across handover and is not used. Opened `campaign-L7-t16262.jpg`: crowded combat around vehicles before boarding, HUD Aboard 0/18. Opened `campaign-L7-result.jpg`: L8 loading. Neither frame captures the moving departure, so bus/soldier collision remains unverified. Raw receipts: `test-results/s94-b91high/high-z1-l7-webgpu/`.
- Per-level experience: L6 observed segment was dangerous and repeatedly lethal; post-hatch experience unknown. L7 had sustained fighting and completed without a measured >10 s no-progress interval (maximum 4.82 s); six deaths make it demanding. No confirmed visual defect is assigned from these frames.

Next L7 pass must set `PLAYTEST_L7_DEPARTURE_CAPTURES=1` to retain moving departure frames, which the normal 45 s capture interval missed. HIGH zoom 1.5 and all LOW coverage remain open. No browser/check remains running after these samples.

## Latest passes

| Pass | Evidence | Disposition |
| --- | --- | --- |
| L7 HIGH z1.5 WebGPU | 157 s, zero deaths/assists, completed. Opened timed departure captures at 1.52, 3.07, 8.23 s. Actual quality high, actual/target zoom 1.5 in capture receipts. | No live-soldier/bus intersection visible in these samples. Does not cover every intervening instant. The “wide-z0.8” filename is misleading: receipt reports actual zoom 1.5; excluded as a wide view. |
| L8 HIGH z1 WebGPU, elephant-yard fixture | 54 s, zero deaths/assists, reached 14/14 aboard, approached driver marker from 6 m to 1 m, then departed. Opened tick-2763 14/14 frame and L9 loading result. | Previous 14/14 stall did not reproduce. Hale-alive predicate still requires runtime proof. `simSeconds: -1` invalid across handover, excluded. |
| L8 HIGH z1.5 WebGPU, same fixture | Driver terminated with assertion: requested zoom 1.5, observed target 1. | Unqualified attempt; no zoom-1.5 pass claimed. No code changed. |
| L9 HIGH z1 WebGPU, before-rail fixture | 480 s, zero deaths/assists, rail progressed to evac-point. Ended at “Defense complete · 3/4 at the trucks · 12 m”. Maximum no-progress 139.13 s; active APC stationary at x468.49,z−1.23. | Candidate final-bay stall; needs manual exit/interaction and survivor-state investigation before calling a soft lock. No L10 handover reached. |

Opened L9 tick-27116 frame shows the courier inside the APC at the barrier, crowd outside, 3/4 objective. Driver reports 21 stationary-enemy warnings plus one no-progress warning; these are not 22 distinct confirmed defects. The vehicle barrier/crowd may explain enemy movement; reachability and manual input remain unverified. Per-level experience: L8 boarding moved promptly; L9's final wait was prolonged and confusing under this driver.

[Contact sheet](contact-sheet.jpg) contains four opened source captures: two HIGH z1.5 L7 departure frames, HIGH z1 L8 14/14, HIGH z1 L9 final bay. The generated sheet was also opened.

Raw new evidence resides in `test-results/s94-b91high/high-z1-5-l7-webgpu/`, `high-z1-l8-yard-webgpu/`, `high-z1-5-l8-yard-webgpu/`, and `high-z1-l9-rail-webgpu/`. These are local artifacts. No process/check remains running at this report boundary.

## L9 retry and L10 opening sample

L9 HIGH z1 WebGPU retry from the same rail fixture completed in 214 s. The manual-input watcher submitted **no F input**: the driver advanced without it, so this retry did not reproduce the prior final-bay wait. The automatic P1 `ally-passive` warning names vehicle #667 at 0/1000 HP; the authored L9 vehicle zero-HP floor makes that insufficient evidence of an injured survivor or P1 gameplay failure. The prior 139 s wait remains an intermittent candidate, not a proven soft lock. Raw receipts: `test-results/s94-b91high/high-z1-l9-manual-exit/`. Actual upright L10 pose still needs a live post-load capture.

L10 HIGH z1 WebGPU opening sample: 300 s, ten deaths, zero assists, 409 fire-axe attacks, no skipped objectives. It did not reach the requested Mega hunting encounter. No Mega damage/recovery, ≥60-infected performance, arrivals, rack, knife, molotov or road-crop pass is inferred. The two retained frame entries are loading frames; they cannot substantiate gameplay fps. Raw receipts: `test-results/s94-b91high/high-z1-l10-hunt-webgpu/` including route audit. All processes ended before this update.

[Evidence index](evidence.json) preserves compact run receipts. The coverage ledger below retains the full original scope and records the current evidence limits.

## Verdict

**HOLD — required gameplay coverage remains incomplete.** No batch-91 gameplay P1/P2 is confirmed yet; the L9 final-bay stall is a candidate requiring manual confirmation. The prior s88 P1/P2 dispositions describe earlier revisions and are not carried forward as current findings.

### P1 / P2 list

- **Confirmed P1:** none confirmed; no soft-lock claim is made from a bounded driver run.
- **Confirmed P2:** none confirmed; candidate L9 final-bay no-progress (139.13 s) remains under investigation.
- **Open:** all requested QA checks below. In particular, the prior s88 reports of L7 bus/soldier overlap and the L10 Mega damage behavior need fresh batch-91 real-input verification before disposition.

## Attempt and evidence

- Read `docs/qa/po-checklist.md` before QA.
- Verified a clean worktree at `d9db5d49`, matching the requested PROD snapshot.
- `TMPDIR=/tmp MI_BUILD_CACHE=off npm run build` passed. The standard cached build first failed because its shared cache lock is outside the writable worktree (`PermissionError`); disabling that cache produced a fresh production build, and the public-build check passed (21 HTML/JS files, no QA hooks).
- `npm run typecheck` passed.
- `npm run lint` passed.
- `sh tools/remote/run.sh "$PWD" -- npm test` did not run: no healthy Hetzner runner was available, and the remote runner rejected local fallback for this command (exit 69). It was not shortened or replaced with a local run.
- `npm run browser:pool` could not start. With both the default temp path and `TMPDIR=/tmp`, the `tsx` launcher failed to create its IPC socket (`EPERM`). Launching the daemon without the `tsx` CLI avoided that socket but the sandbox denied TCP listen on `127.0.0.1:4329` (`EPERM`). `tools/browser-status.sh` confirmed the pool was unavailable. No browser session or playtest driver was started.
- No captures were produced in the initial sandbox-blocked attempt; later opened captures and sheet are documented above. No code or game-content changes were made.

## Coverage ledger

| Requirement | HIGH | LOW | Disposition |
| --- | --- | --- | --- |
| L6 full cadence after first hatch | z1 incomplete; z1.5 reached exit-platform, closure unproved | Completed399 s; closure confirmed,92.4 s post-close attack samples, death/reset-qualified | HIGH and uninterrupted alive cadence open |
| L7 departure vs soldiers | z1 route passed, timed frames missing; z1.5 three opened frames show no live-soldier intersection | z1 route passed; three opened departure frames show no intersection | Sampled clearance; HIGH z1 capture still open |
| L8 boarding through driver handoff, Hale alive | z1 Hale100 HP handoff confirmed; requested z1.5 boarding completed after fixed-camera arena | LOW-configured z1 route passed; Hale100 HP at boarding; exact departure sample/actual quality receipt incomplete | HIGH z1 Hale-alive passed; z1.5 scripted-camera exception qualified; LOW render receipt open |
| L9 rail/final bay | z1 one139 s 3/4 wait, later retry passed; z1.5 passed | Five-minute attempt ended after15 deaths at hatch | LOW final bay open |
| L9 bus/APC and upright playable L10 handover | z1.5 live capture upright | z1 live capture upright | Pose sampled pass; school-bus clearance open |
| L10 all14 returned weapons click/key | Click passed; Q reached all14 at z1.5; direct shortcuts combat-qualified | Actual LOW click and Q reached all14; direct key1 qualified | Original hangar/knife identity open |
| L10 molotov aim/restoration | Gold dashed marks and circle inspected at z1; prior rifle restored | Same at actual LOW z1 | Sampled pass; partly occluded trajectory |
| L10 hunting Mega |52 axe hits, positive damage; recovery begins~1.17 s after hits stop |46 axe hits, recovery~1.15 s | Gun damage and~35% floor open |
| L10 road crops | Farms views only | Missing systematic sweep | Open |
| L10 arrivals/pop-in/sprinters | First-observed IDs logged; no spawn proof | Same | Full journey cadence open |
| L10 frame time with60–70 infected |59.90 FPS at peak24, no60–70 frames |59.92 FPS at peak12, no60–70 frames | Required load unverified |
| Per-level glitches, >10 s waits, experience | Partial observations documented below/above | Partial L7–L9/arsenal | Full requested scope incomplete |

The environment blockers are resolved. Continue executing the specified HIGH zoom 1 and 1.5 passes followed by LOW zoom 1, with the real-input playtest driver and approved checkpoint saves. Record captures only after opening them; then produce the contact sheet and replace this blocked-attempt ledger with measured findings.

## HIGH z1 departure retry

`high-z1-l7-departure`: 300 s, seven deaths, one driver assist, no skipped objectives, incomplete at corridor checkpoint (tick 17811); no timed departure captures were produced. Max no-progress interval 10.801 s. This attempt neither clears nor reproduces the bus/soldier overlap. The previous HIGH z1 completed route remains valid for its narrower route-completion scope. No process remains running.

## HIGH z1 arsenal input sample

Used one pooled headless WebGPU context, ports 4941/4942, approved `l10-dispersal-console` save, no cheats or state changes after fixture setup except quality/camera. Actual render receipt: WebGPU, high, zoom/target 1. The sampler sends real toolbar clicks and keyboard input while simulation runs; it does not attack or relocate the player.

All 14 returned weapons plus fists selected successfully by toolbar click with 800 ms observation spacing. Number shortcuts2–9 matched expected selection; the earlier key0 claim was incorrect and is superseded by the controlled explicit0 check below. Key 1's receipt retained army MG rather than fists, and Q cycling observed 13 distinct selections in this combat-exposed sample; full key coverage is **not passed**. The earlier 150 ms sampler observed stale prior selections and is superseded. The first exploratory sampler included the disabled corgi ability and timed out; it is excluded from weapon results. The selected-state receipt is embedded in evidence.json. This later-arsenal save does not qualify the original hangar presentation, literal knife, molotov arc/restoration or early-hunt Mega recovery.

Opened the initial arsenal frame: heroine alive at 65 HP beside the Mega, all rack icons visible, molotov selected. The later input receipt supersedes that initial sampler; no visual pass is inferred from its overwritten image. No sampler remains running. No game code was modified.

## HIGH z1.5 then actual LOW z1 arsenal comparison

One serial pooled context per pass. HIGH z1.5 actual render receipt confirms WebGPU/high/1.5. All 14 returned weapons plus fists selected by click; Q cycling reached every returned weapon. Direct key 2 retained MG in one observation; final opened capture shows 0 HP/downed courier, so this remains combat-qualified rather than a confirmed selection defect. The sampler only clicks/selects; it does not attack, teleport or enable cheats.

The first nominal LOW sample actually rendered HIGH because the fixture restored saved quality. It is excluded from LOW coverage. The corrected checkpoint setup sets only campaign.settings.quality=low before restoring the approved save. Its receipt confirms WebGPU/low/zoom 1. All 14 returned weapons plus fists selected by click; Q cycling reached every returned weapon. Direct key 1 retained MG once; full direct-shortcut coverage remains open. Raw corrected receipts: `test-results/s94-b91high/low-z1-arsenal-actual/receipt.json`; HIGH: `high-z1-5-arsenal/receipt.json`. Compact exact inputs/selections and render identity are embedded in evidence.json. The unrelated large render-entity dump was removed from that index.

These later-console results do not prove the original hangar presentation, knife identity, early Mega damage/recovery, molotov aiming/restoration, crops, or high-density journey performance. All of that original scope remains required. No process/check remains running.

## LOW L7 and L8 route passes

LOW z1 L7 WebGPU: completed in 214 s, one death, one driver assist, no skipped objectives. Max no-progress 11.97 s. Opened departure frames at 0.67, approximately 3, and 8.27 s; no live-soldier intersection with the bus is visible in these samples. Receipt confirms actual LOW and zoom 1. Nearby corpses and moving infected remain visible; this is sampled clearance evidence, not continuous footage. Route remained combat-heavy and progressed. Raw: `test-results/s94-b91high/low-z1-l7-webgpu/`.

LOW-configured z1 L8 WebGPU elephant-yard fixture: completed in 54 s, no issues reported, 14/14 aboard and driver handoff progressed. Opened tick-2769 frame shows the departure cinematic caption “The APC engine roars as the survivors pull away.” The 14/14 count is established by the preceding HUD observations, not that cinematic frame. Used an untracked /tmp copy of the approved fixture with only campaign.settings.quality=low changed, preventing the prior saved-HIGH override. This standard driver run does not retain a separate actual-quality receipt; configuration is supported, but render identity remains less strongly evidenced than L7. Hale-alive state remains unverified. Raw: `test-results/s94-b91high/low-z1-l8-yard-webgpu/`. No process remains running.

## L9 HIGH z1.5 and LOW z1 comparison

HIGH z1.5 WebGPU rail-fixture run completed in 130 s, zero deaths/assists/skips, maximum no-progress 6.1 s. Opened tick-2769 restart frame (“Engine’s back! Drive, now!”), tick-5472 final-bay frame (4/4 at trucks, hatch-defense countdown 11 s), and result frame (L10 loading). These show explained stops and final-bay progression. They do not prove the courier's upright post-load pose or school-bus clearance. The previous HIGH z1 3/4 wait did not recur. Invalid handover simSeconds=-1 excluded.

LOW-configured z1 WebGPU rail-fixture run ended at 300 s with 15 deaths, zero assists/skips, maximum no-progress 3.003 s. Last observed checkpoint mid-crossing, hatch defense 0:05, courier 20 HP. The HUD explicitly states shoot boarders, F close/open hatch, cannot leave APC. Opened tick-8184 hatch scene; no final-bay or L10 handover pass is claimed. Repeated deaths create a difficult/repetitive experience; a time-limited run is not proof of a soft lock. Used approved fixture copy with only saved quality set LOW. Actual LOW render identity is not separately logged by this standard sampler. Raw directories: `test-results/s94-b91high/high-z1-5-l9-rail-webgpu/` and `low-z1-l9-rail-webgpu/`. No process/check remains running.

## HIGH z1.5 L6 audit attempt

Eight-minute WebGPU route with owned shotgun selected at entry, existing L6 audit/capture options enabled: ended at exit-platform checkpoint, tick 28654, incomplete; ten deaths, one driver assist, 15 shotgun attacks then 3222 army-MG attacks. Max no-progress 32.18 s includes scripted shelter rest; that automatic P2 warning is not promoted. No L6 approved checkpoint fixture exists in the repository.

Opened tick-27084 frame: courier 62 HP, survivor-lost banner, multiple attacking infected, hatch objective “Let everyone pass · 7/10 through · 31 m”. Final audit sample: exit phase, 54 alive infected, two attack starts against player in the preceding second. This supports ongoing pressure in the observed retreat but **does not establish first-hatch closure**. No claim is made about the requested full cadence after closure. Raw `test-results/s94-b91high/high-z1-5-l6-shotgun/` includes campaign-l6-hold.json. Experience: dangerous escort with repeated deaths and survivor losses; post-closed-hatch boredom is still unverified. No process remains running.

## Controlled molotov previous-weapon checks

HIGH z1 then LOW z1 WebGPU, actual render identities confirmed in receipts, same approved console fixture. Real input: click hunting rifle, observe selection, click molotov, mouse aim, then six spaced left clicks. Both sequences record three molotov-selected observations followed by hunting-rifle restoration after the fourth click; combat.attack receipts identify actual molotov attacks. No death/reset is indicated by the opened HIGH after-frame (courier alive at 2 HP). No intermediary weapon selection occurred. Thus previous-rifle restoration passed in these sequences; no return to axe was observed. Subsequent rifle shots are part of the six-click sequence, not molotov charges.

Opened HIGH aim and after frames. The pre-throw aim frame shows molotov selected but **no visible arc**. Mouse movement alone does not provide sufficient evidence that the game's aiming condition was active, so gold dashed arc/blue-line disposition remains open. The later-console fixture does not qualify the early hunt. Raw `test-results/s94-b91high/high-z1-molotov/` and `low-z1-molotov/`; exact selected states and attack receipts embedded in evidence.json. No game code changed; no process remains running.

## Molotov held-aim captures — HIGH then LOW

A real left-mouse hold after selecting molotov establishes active pointer aim. Opened HIGH and LOW z1 captures show gold dashed aim marks extending from the courier and a gold landing-radius circle, partly occluded by the foreground structure. No blue aiming lines are visible. Read-only input-frame receipts confirm aimSource=pointer, right.held=true and mouseAttack=true. Both render receipts confirm WebGPU, requested actual quality, zoom 1. Final selection again returned to hunting rifle. This supersedes the earlier mouse-motion-only stills for active aiming; it is a sampled view with occlusion, not a full unobstructed trajectory sweep. The arrow-key exploratory samples moved the courier and are excluded from the aiming pass.

Raw directories: `test-results/s94-b91high/high-z1-molotov-held/` and `low-z1-molotov-held/`. The single contact sheet now includes both opened held-aim frames; the updated sheet was opened. No process remains running.

## L10 HIGH manual sprint / farms attempt

480 s HIGH z1 WebGPU route, eight deaths, 364 axe attacks, reached cure-pace-2 in farms. Sent ordinary DS movement for 10 s, then D for 4 s, through the existing control-file input handler. Opened sprint-east-live frame shows courier alive, river exit 16 m away, barrier ahead. Driver then progressed into farms. The initial queued movement was consumed on speculative L1 before run initialization and is excluded from gameplay evidence; manual mode was explicitly released to start the run. A later manual interval contributes to the 72.4 s max-no-progress metric, so this is not a clean automatic soft-lock measurement. Two driver P2 warnings are retained as candidates, not confirmed defects.

No teleport, god mode or objective skip. The retained profile must be inspected before assuming cure-pace-2 can be resumed; no persisted-resume claim is made yet. This attempt is concrete route progress but does not verify the hunting Mega, road-crop sweep, arrival cadence or high-density frame time. Raw `test-results/s94-b91high/high-z1-l10-sprint/`. No process remains running.

## Verified farms save continuation

Decoded the retained campaign gzip record: cureResume exists, source current checkpoint cure-pace-2, tick 30189. Copied this profile into `high-z1-l10-farms-continue`, entered through normal Continue. Runtime resumed farms at x~925 (tick reset on load); eight-minute HIGH z1 WebGPU sample recorded twelve deaths and no assists. Opened tick-5432 frame shows downed courier amid hunting Mega, dogs and infected.

Read-only route audit contains 760 combat.hit events, but no player-hit victim with Mega health scale (>=1000 max HP); thus **no Mega-contact damage or recovery result is available**. Crowd-priority combat is insufficient for that requirement. Candidate driver warnings: navigation delay and nearby 45-HP infected not damaged during an attack window; no P1/P2 promoted without targeted reach/facing confirmation. Retained raw route audit and profile remain under `test-results/s94-b91high/high-z1-l10-farms-continue/`. Next action should target Mega contact with normal input, rather than repeat crowd combat. No process remains running.

## Targeted hunting-Mega melee and recovery — HIGH then LOW

Used the persisted real-input farms save, identical campaign state, changing only saved quality. One pooled headless WebGPU context per 90 s pass, normal WASD approach toward projected visible Mega and physical left-mouse axe attacks, read-only HP/event samples. No god mode, relocation, stat changes, or objective edits.

HIGH z1: Mega #129 received 52 player fire-axe hit events; typical positive damage 78.4/hit. Minimum sampled HP 2137.6/3000 (~71%). Alive-player recovery samples show HP 2294.4 at tick789 →2354.4 at tick805, 1.167 s since the last hit, then2450.4 at821. LOW z1: 46 player axe-hit events, minimum sampled HP2294.4/3000 (~76%); alive-player recovery2294.4→2348.4 at tick805,1.15 s since last hit. Exact hits/recovery samples and actual WebGPU/quality receipts are in evidence.json.

Thus the s88 zero-melee-damage defect did **not** reproduce, and rapid recovery after ~1 s without hits is demonstrated in both passes. The requested ~35% floor and gun damage remain unverified: these axe contact sequences did not sustain damage that far. Opened HIGH end capture shows courier upright among farm crop rows after the contact sequence; it is not a road-crop sweep or combat-damage still. Raw `test-results/s94-b91high/high-z1-mega-contact/` and `low-z1-mega-contact/`. No process remains running.

## Farms frame-interval diagnostics — HIGH then LOW

Three-minute real-input targeted-contact routes from the verified farms save, one headless pooled WebGPU context each. Read-only rAF interval probe annotated by live, nonhidden infected count sampled by the input controller. Actual HIGH/LOW identity retained. Includes combat, deaths and respawns; reported FPS is presentation interval, not isolated renderer CPU/GPU time.

| Setting | Peak live infected | Mean frame interval | Mean FPS | P95 interval | Max interval | Frames with 60–70 infected |
| --- | --- | --- | --- | --- | --- | --- |
| HIGH z1 | 24 | 16.695 ms | 59.897 | 16.700 ms | 50.0 ms | 0 |
| LOW z1 | 12 | 16.690 ms | 59.916 | 16.800 ms | 33.4 ms | 0 |

These are **not** the requested 60–70-infected performance pass, nor an equal-load quality comparison. No enemies were injected or stats tuned. First-observed entity IDs and projected visibility were logged, but deaths/respawns and visibility entry prevent those alone from proving spawn pop-in or ≤45 s arrivals. The full journey cadence, sprinter spawn presentation and requested load remain open. Raw `test-results/s94-b91high/high-z1-farms-perf/receipt.json` and `low-z1-farms-perf/receipt.json`; compact summaries are in evidence.json. No process remains running.

## Validation rerun and Hale-alive qualification

Unchanged prescribed remote suite passed on46.225.66.90:27 files,106 passed,1 skipped;222.5 s inside240 s. Earlier test-budget process-cleanup failure did not recur. No tests changed or trimmed.

Two HIGH L8 targeted attempts establish Hale#422 alive at100 HP after elephant defeat and while HUD reaches14/14 aboard. Opened first attempt handoff.jpg shows14/14, driver marker5 m away, courier on far side of APC. The straight WASD approach stopped4.54 m away; click approach ended15.72 m away. Both retained hale-fallen=false, hale-keys=false, player-boarded=false. These custom controllers did **not** reach the valid driver marker, so they do not prove a Hale-alive handoff or a soft lock. The successful ordinary-driver handoffs above still lack Hale health at the exact transition. Raw `high-z1-l8-hale/` and `high-z1-l8-hale-click/`. No browser or remote check remains running.

## Ordinary-driver Hale health proof

A temporary copy of the ordinary playtest controller added only a read-only100 ms Hale/state observer. Same approved elephant-yard save, normal input policy. HIGH z1 and LOW-configured z1 both completed in54 s with zero deaths/assists/skips and no issues. Hale#422 remained100 HP throughout observed L8.

HIGH: player-boarded true at tick2755; departed true at3233, phase progression, Hale100 HP, hale-fallen false. This confirms the requested Hale-alive handoff for HIGH z1. LOW: player-boarded true and Hale100 HP; last observer sample tick3231, departed still false, followed by successful ordinary-driver completion. LOW exact departure health transition was not sampled and is qualified accordingly. Raw `high-z1-l8-hale-driver/` and `low-z1-l8-hale-driver/` contain runs-hale-driver.json and hale-audit.json. HIGH z1.5 camera assertion remains open. Temporary observer source removed; no game source changes remain. No process remains running.

## Actual playable L9→L10 handover captures

Approved l9-at-bridge checkpoint, real-input driver. HIGH z1.5 reached live L10 in25 s, LOW-configured z1 in24 s; no deaths/assists/skips/issues. Opened both actual-handover frames: courier upright with axe, corgi beside her, “Get away from the river ·101 m” objective and Sam radio caption. The PO folded-pose finding did not reproduce in these samples. Invalid negative simSeconds across handover excluded.

LOW used a temporary copy of the capture helper changing only its forced zoom1.5 to requested zoom1; ordinary input behavior was identical, temporary source removed. Raw directories `high-z1-5-l9-live-handover/` and `low-z1-l9-live-handover/`. These bridge-only passes do not settle school-bus/APC clearance or LOW final-bay progression. Both opened handover frames were added to the single contact sheet. No process remains running.

## LOW L6 completed with first-hatch closure

LOW z1 WebGPU driver completed L6 in399 s, five deaths. Gate observation confirms first hatch x90 closedAt17437; a later checkpoint reset updates closedAt17875. Attack audit samples after first closure span92.38 s through tick22980:30 s windows contain86,37,97 attack starts, followed by3 in the final2.38 s. This measures ongoing attack activity, not exclusively attacks targeting the group. A death/reset occurred in that interval (death count4→5), so uninterrupted alive cadence is qualified. Full route completion and post-first-closure combat are demonstrated for this LOW sample; HIGH remains open. Automatic shelter-rest warning is scripted; nearby-infected-unhittable warning remains unconfirmed. Raw `test-results/s94-b91high/low-z1-l6-cadence/` includes gate observations, hold audit and completed run. No game code changed.

## Timebox closeout and remaining work

Final HIGH z1 L6 attempt:480 s,14 deaths,one assist,ended gate-150; no first-hatch closedAt receipt. Last audit sample has52 alive infected and5 attack starts in the preceding second, but that does not establish post-closure cadence. LOW completed with the closure/cadence qualifications recorded above. Opened LOW gate90-prompt frame at17286 shows “Everyone through · E or click the gate to close it”, ring at the gate, player100 HP; later telemetry proves closure.

### PO wording and current disposition

| PO finding, verbatim | Current evidence and limit |
| --- | --- |
| L6: “After I closed the first door, no more Zombies attacked the group, which made the game boring from there on” | LOW closure and92.4 s attack-start samples contradict no further attacks in that run, but include a death/reset and are not group-target-exclusive. HIGH full post-closure condition unverified. |
| L7: “The bus is crashing to soldiers” | No live-soldier intersection in three opened HIGH z1.5 and three LOW z1 departure samples. HIGH z1 timed departure frames still missing. |
| L9: “L9; I am stuck here” (rail crossing hatch) | HIGH z1/z1.5 rail progressed. LOW five-minute attempt had15 deaths and did not clear hatch. |
| L9: “Also the end is strange, bc I cannot walk away but also not drive anymore” | Countdown/restart prompts inspected; HIGH final bay passed on retries, one139 s3/4 wait remains intermittent candidate. Full moment-by-moment input availability unverified. |
| L9: “It somehow proceeded, but now I am this... super strange” | Opened live HIGH z1.5 and LOW z1 L10 handovers show upright axe-holding courier. |
| L9: school bus overlapping the APC | Not verified. |

### P1/P2 list

- Confirmed gameplay P1: none. This is not a clean-bill-of-health claim.
- Confirmed gameplay P2: none. Automatic driver warnings were reviewed or retained as qualified candidates rather than counted as defects.
- Candidate requiring reproduction: L9 HIGH z1 final-bay3/4 wait,139.13 s. Subsequent HIGH z1/z1.5 passes progressed; manual exit/roster-state confirmation remains missing.

### Coverage still required before GO

1. L6 HIGH full route with first hatch closed and full post-closure cadence; LOW uninterrupted alive/group-target cadence qualification.
2. L7 HIGH z1 timed departure clearance captures; existing HIGH z1.5/LOW samples do not cover the entire motion continuously.
3. L8 HIGH z1.5 requested framing; exact LOW departure-health/actual-quality receipt. HIGH z1 Hale-alive handoff is proved.
4. L9 school-bus/APC clearance, LOW rail through final bay, final-bay input availability, and intermittent3/4 wait investigation. HIGH z1 playable-pose capture remains absent; HIGH z1.5/LOW z1 pose samples passed.
5. L10 original hangar presentation and all direct weapon shortcuts under live controlled conditions, literal knife identity, HIGH z1.5 broader weapon/throwable presentation, unobstructed molotov trajectory sweep. Later arsenal clicks/Q and sampled molotov restoration/aim results are narrower evidence.
6. L10 gun damage and sustained damage to~35% hunting-Mega floor. Positive axe damage and~1 s recovery are proved at HIGH/LOW; floor/gun check is not.
7. Full road-crop sweep, journey arrivals every≤45 s, visually reviewed pop-in/sprinter spawning, and real-input frame timing with60–70 active infected at HIGH and LOW. Current farms peak24/12 diagnostics do not qualify that load.

The authorized~2.5 h execution window is exhausted. Further runs require an extended execution window; the original scope remains intact and the goal is not marked complete. Temporary QA observer copies were removed. Raw artifacts remain local under test-results/s94-b91high; only README,JSON evidence and the one small sheet were committed.

## Extended execution — rifle-route attempts

Continuation after the timebox closeout was treated as authorization to continue QA. Three HIGH z1 WebGPU120 s normal-input approach probes attempted the farmhouse rifle: backtrack from the real farms save, fresh L10 preset, and fresh preset with explicit visible Begin-button handling. No rifle ever appeared in the rack; no player Mega gun hit was recorded. Best backtrack distance89.54 m. These are **controller approach failures, not confirmed pickup defects**. Opened backtrack end-frame shows courier30 HP surrounded by infected beside crop rows. Source-map rifle location was used as a disclosed route assist; no item grants, teleport, god mode or stat changes occurred.

The rifle/gun-damage requirement remains open. Repeating direct-line movement is not sufficient; the next route attempt needs visual waypoint navigation around the starting/farm geometry. Raw `high-z1-mega-rifle/`, `high-z1-rifle-fresh/`, `high-z1-rifle-begin/` under test-results/s94-b91high. Compact actual-quality and input outcomes are in evidence.json. No process remains running. The original goal remains incomplete; this extension does not alter the HOLD verdict.

## HIGH L8 requested zoom1.5 after scripted framing

Read-only trace/source inspection resolves prior immediate assertions: View.zoom ignores requests while blendTarget/scripted camera is active. Merely awaiting screenshotReady still observed target1 during the elephant arena. A temporary ordinary-driver copy deferred the framing assertion and retried the same request until normal camera control returned; game camera rules and input controller were unchanged.

The route completed56 s, zero deaths/assists/skips. Camera samples show actual/target1 in scripted arena, then actual/target1.5 with actual quality HIGH at player-boarded tick2871 and through the departure staging. This qualifies the HIGH requested-z1.5 boarding route with an explicit fixed-camera arena exception; it is not a claim that user zoom changed the scripted arena. Exact camera/state samples embedded in evidence.json.

The temporary250 ms observer lacked a null-missions guard and threw a state-read error during level teardown. This is observer contamination, not promoted as a game P1; it does not erase the preceding render/state receipts. Temporary source removed. Raw `high-z1-5-l8-camera/` (await-only failed probe) and `high-z1-5-l8-deferred-camera/` (completed deferred-assertion probe). No process remains running.

## Controlled live direct shortcuts and key0 correction

Fresh later-console fixture samples, HIGH then actual LOW WebGPU,z1. Before the long click/Q sequence exposes the player to combat, physical keys1–9 each selected the expected fists/bat/axe/handgun/MG/shotgun/launcher/molotov/pipe bomb; every receipt records100 HP. Key0 was explicitly pressed after9 and left pipe bomb selected, also100 HP. Authored key mapping assigns0 to crowbar, absent from these returned racks; unchanged selection is expected. Earlier report wording claiming0 passed as a weapon-selection shortcut was inaccurate: the original sampler never sent0 because no returned action has key10. These new receipts supersede that claim.

Together with all14 click selections and Q visits already recorded, later returned-arsenal input coverage is satisfied for HIGH/LOWz1 (and existing HIGHz1.5 click/Q coverage). This does not prove the original hangar's presentation. Source audit also confirms weapon.knife and weapon.machete are distinct catalog actions; cureHangarWeapons includes machete and no knife. No legitimate literal-knife selection is demonstrated; the machete test does not settle that PO finding. No weapons were granted or substituted. Raw `high-z1-direct-zero/receipt.json` and `low-z1-direct-zero/receipt.json`, exact receipts embedded in evidence.json. No process remains running.
