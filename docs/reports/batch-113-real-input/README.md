# Batch 113 real-input browser QA — incomplete acceptance

Candidate `69562fd1ee5ba56140a8ce1f0a2f5e6b407e1c11`. Report only. **L4 full completion, broad outside-wire routing and complete Alpha tank foot planting remain open.** Identified HIGH ordinary strikes and LOW charge recovery have bounded visual evidence without obvious prolonged sliding. Both L3 tiers completed, the three L7 wreck closeups were reviewed, and HIGH L6/L9/L10 four-minute sweeps were collected.

## Method and validation

Headless WebGPU, ordinary mortal keyboard/mouse combat, debug level entry, no objective skips. HIGH runs precede LOW. One guarded browser at a time through the pool / `tools/e2e-lock.sh`, ports 5025/5026, reservations below ten minutes. L7 closeups supplement the real-input route with camera-only framing in the registered level, paused at tick 0. No source or playtest edits.

QA build (`MI_BUILD_CACHE=off npm run build:qa`), typecheck and lint pass. The unchanged prescribed `sh tools/remote/run.sh "$PWD" -- npm test` passes on 46.225.66.90: 27 files, 105 passed, one existing skip, 150-case inventory, 183.2 seconds within 240 seconds. Initial sandbox cache/socket denials and runner unavailability were resolved before successful runs. No checks remain running.

[qa.json](qa.json) is below 200 KB. One small [contact sheet](contact-sheet.jpg) was created and opened, containing L3 tick 21652, L4 tick 11864, L9 tick 9495 and L10 tick 13892. All raw captures remain ignored under `test-results/`.

## Coverage

| Check | Collected evidence | Qualification |
| --- | --- | --- |
| L3 HIGH zoom 1 | Full level, 414 s, no skips/issues, seven deaths | Opened bridge tick 21652: infected on deck, one damaged target; no obvious sink/float in frame. Universal hitability unproven. |
| L3 LOW zoom 1 | Full level, 157 s, no skips/issues | Extra bridge frame is post-fight; geometry readable but no infected to qualify close damage. |
| L4 HIGH zoom 1.5 | 480 s through cellar escape; no skips | Not complete. Stationary warnings require attribution. Original feet occluded; later identified HIGH strikes reviewed without obvious prolonged slide. Additional zoom1/manual completion attempts also stop at cellar. |
| L4 LOW zoom 1.5 | 540 s through cellar escape; no skips, 25 deaths | Not complete. No stationary-enemy warnings. Opened north-breach tick 10839: feet occluded. Later identified LOW charge recovery reviewed without obvious continuing glide. |
| L7 HIGH zoom 1.5 | Full real-input route, 154 s, no skips/issues; three camera closeups | Opened military-1/3/4 closeups: supported on paving, no obvious deep sink/float. Dark wheel contact limits fine judgment. |
| L6 HIGH zoom 1 | 240 s, no skips | Opened tick 13543: dark readable shield/courier, survivor separation makes babysitting conspicuous. Combat pressure visible, courier full HP. No obvious geometry glitch in frame. |
| L9 HIGH zoom 1 | 240 s, no skips | Opened tick 9495: strong hatch pressure and nearly disabled smoking APC; conspicuous crowd rendering corruption. |
| L10 HIGH zoom 1 | 240 s, no skips | Opened tick 13892: sparse dark farm staging, repetitive close fighting, threatening damage; provisional close-target warning. |

## Findings

- **P2 — L9 visible crowd rendering corruption.** Tick **9495**, `test-results/playtest/b113-l9-high/captures/campaign-L9-9495-enemy-frozen.jpg`. Several infected have large black/white striped surfaces projecting above their bodies. Opened at full size. Cause unproven. Read-only inspection confirms joint telemetry records coordinates and does not draw geometry; it does not explain these surfaces.
- **P2 provisional — L10 close target takes no damage during driver attacks.** Tick **13892**, `test-results/playtest/b113-l10-high/captures/campaign-L10-13892-enemy-unhittable.jpg`. Driver reports #134 at 1.1 m stayed 60/60 HP for eight seconds of attacks. Opened frame shows target and melee arc. Aim, collision and product hit logic remain unseparated.
- **P2 provisional — HIGH L4 stationary actor warnings.** #214/#328/#208 at ticks **11864/11908/11941**. Captures: `test-results/playtest/b113-l4-high/captures/campaign-L4-<tick>-enemy-frozen.jpg`. Opened tick 11864: dense truck/perimeter crowd and infected inside the wire, but flagged actor identity and obstacle combat are not resolved. No frozen-AI conclusion.

No confirmed P1 or P3 product finding. Driver severities are not automatically accepted as product severities.

## Driver gaps and outstanding qualification

L4 opening empty-HUD navigation warnings, L6 shelter-wait warning, and intentional sample-cap cannot-finish labels are driver gaps. L9 passive-ally warning targets the player APC during the scripted engine interruption; it does not establish ally AI failure. L9 stationary warnings around the hull remain unqualified. L4 bounded continuation restarted the opening rather than preserving the cellar state; repeated identical continuation is not evidence of progress.

Still required: full HIGH and LOW L4 completion; broad ordinary-infected outside-wire routing and breach-wave arrival qualification; complete readable Alpha foot-contact windows near the tank. Identified same-actor Alpha crossings are established in both tiers, with bounded HIGH strike and LOW charge-recovery observations detailed below. Existing wide frames show substantial interior combat but cannot independently establish every outside actor's route or planted feet. L3 close-target visual coverage also remains bounded to the reviewed HIGH frame; the LOW extra capture landed after combat.

## L4 evidence and remaining gaps

Both tiers reached cellar escape under ordinary mortal input. HIGH collected a 480-second segment, additional 540-second normal-camera runs at zoom1/1.5, and two manual physical-key escape attempts. LOW collected540 seconds at zoom1.5. None completed L4. Logs show repeated escape deaths/checkpoint resets, not a motionless run. LOW recorded25 deaths; the first HIGH segment has24 death-input-release events. Manual legs reached residential fencing then returned toward plaza/café combat and died. Steering, combat difficulty and route-design contributions remain unresolved. Full-level acceptance is **not achieved**.

Bounded continuation restarted at quartermaster rather than preserving cellar progress. Read-only inspection confirms explicit live save-on-yield is restricted to L10. Repeating the same L4 continuation is not useful.

Read-only Alpha observers and screenshot sequences were collected in ignored wrappers, with camera-only static and tracked views. Production infected.alpha identity, alphaType, health, transforms and brain states are recorded every500ms. HIGH tracking followed #372 for218 samples; LOW tracked living Alphas for210 samples. Same live actors cross the authored south boundary z22.5: HIGH #372 at9771→9801 and LOW #246 at12074→12104. This establishes arrivals for those actors, not every ordinary infected route or zero wire stalls throughout the level.

Opened identified HIGH #372 strike sequence ticks13322–13533, including attack states13352/13413/13473/13533. No obvious prolonged foot slide in those sampled ordinary strikes; objective arrow/nearby actors intermittently obscure parts of feet. Opened LOW #246 charge sequence8161–8342: active travel followed by fixed recovery position at8282/8312/8342, without obvious continuing recovery glide. Fence partly obscures contact. LOW ordinary strikes and complete readable attack/contact coverage remain unqualified. No roar/slam acceptance is claimed. Half-second samples can miss brief events.

Local review sheets `test-results/b113-tracked-attack-review.jpg` and `test-results/b113-low-charge-review.jpg` were opened. They stay ignored. Static tank views were limited by hull/fence occlusion; the identity-tracked view finally exposed the actor fully. Exact receipts, earlier attempts and review ticks remain in qa.json.

## Driver gaps

- L4 empty opening HUD and L6 shelter wait trigger navigation warnings.
- Intentional sample caps emit automatic P0 cannot-finish labels; they do not establish product P0s. Manual-mode time can also influence no-progress labels.
- L9 passive-ally warning targets the player APC during its scripted engine interruption; ally AI failure is not established. Stationary warnings around its hull remain unresolved.
- L4 continuation does not preserve live cellar progress through the bounded driver path.
- Pooled launchProfile drops recordVideo options. A permitted ignored wrapper explicitly forwarding recordVideo still produced no video directory. No native-video proof is claimed. A read-only screenshot fallback worked, producing approximately two frames per second.
- Wide crowds hide feet and actor identity. Identity receipts resolve actor attribution, but some contact windows remain visually occluded.

## Evidence locations and scope audit

Primary raw runs: `test-results/playtest/b113-l3-high`, `b113-l3-low`, `b113-l4-high`, `b113-l4-low`, `b113-l4-manual-high`, `b113-l4-wide-high`, `b113-l4-bearing-high`, `b113-l6-high`, `b113-l7-high`, `b113-l9-high`, `b113-l10-high`. The interrupted initial HIGH L4 parent lacks a final aggregate summary; its first segment receipt is retained.

Camera/observer runs: `test-results/b113-l4-sequence-high`, `b113-l4-fixed-high`, `b113-l4-opposite-high`, `b113-l4-south-high`, `b113-l4-south-low`, `b113-l4-identified-high`, `b113-l4-tracked-high`, `b113-l4-tracked-low`. They supplement physical-input coverage and do not become normal-camera completion runs.

L7 registered-level camera closeups: `test-results/b113-wrecks/military-1.jpg`, `military-3.jpg`, `military-4.jpg`, all opened at HIGH WebGPU zoom1.5, tick0. Placements D-FAIR/l7-military-1(214,25), military-3(138,25), military-4(100,6) appear supported on paving; dark wheel contact limits fine judgment. No actor or lighting edits.

Broader HIGH sweep sheets were opened: `test-results/b113-l6-broad-review.jpg` (2720/5427/8129/10834/13543), `b113-l9-broad-review.jpg` (2710/5412/8117/10825/13528), and `b113-l10-broad-review.jpg` (2713/5418/8136/10854/13560). L9 striped corruption remains visible at10825/13528. Driver backtracking limits pacing attribution in L6/L10.

Only this README, qa.json (below200KB) and one99,726-byte reviewed contact sheet are tracked. Raw captures, wrappers and extra local review sheets stay ignored. Candidate simulation/render source is unchanged; validation was run on that source. No deployment, push, main movement, zombie stat tuning, corpse removal, protected-reference edits, source fixes or playtest-tool edits occurred. This report is **not batch approval**.
