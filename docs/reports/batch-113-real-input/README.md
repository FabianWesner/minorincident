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

## Capture locations

Runs: `test-results/playtest/b113-l3-high`, `b113-l3-low`, `b113-l4-high`, `b113-l4-low`, `b113-l6-high`, `b113-l7-high`, `b113-l9-high`, `b113-l10-high`. Each contains logs, capture ticks and available summaries. The interrupted HIGH L4 parent lacks a final aggregate summary; its first segment receipt is retained.

L7 camera-only captures: `test-results/b113-wrecks/military-1.jpg`, `military-3.jpg`, `military-4.jpg`. Registered placements are D-FAIR/l7-military-1 (214,25), military-3 (138,25), military-4 (100,6). Backend HIGH WebGPU and camera/tick receipts are in qa.json. These are placement observations, not extra combat runs.

No deployment, push, main movement, zombie stat tuning, corpse removal, protected-reference edits, source fixes or playtest-tool edits occurred. This is an incomplete acceptance report, not batch approval.

## L4 escape telemetry attribution

Read both full logs: HIGH has 24 death-input-release events; LOW summary records 25 deaths. During hide, the courier repeatedly advances from the line-break spawn around x−4/−5,z16 to x−15…−32, then resets. This is repeated failed escape under combat pressure, not a motionless simulation. Driver steering, route design and combat contribution remain unresolved. Representative tick/position/checkpoint samples are in `l4EscapeAudit` in qa.json. Repeating the identical route without a different observation or physical-input approach is unlikely to close acceptance.

## L3 close damage audit

Existing ordinary-input logs establish close bridge targets losing HP in both tiers. HIGH tick 21837: #545 45→20 HP at 0.69 m and #444 47.5→15 at 0.87 m, courier x161.79. LOW tick 7087: #1472 60→20 at 1.18 m (x164.16); tick 7155: #1242 60→20 at 1.08 m (x166.42). These are sampled same-actor HP changes, not shot-by-shot attribution; companion damage can contribute. They support close-target damage on the bridge during real play, without proving universal hitability. Exact sampled receipts are in `l3CloseDamageAudit`.

## Native recording driver gap

Read-only inspection of `tools/browser-pool/client.ts` shows pooled `launchProfile` creates its context with viewport, DPR and storage state, omitting `recordVideo`. Merely supplying video options to the helper cannot record the pooled run. A permitted ignored wrapper must explicitly create a recording context before another camera/sole attempt; no source/helper fix was made.

## Recording wrapper smoke result

Ignored esbuild wrapper explicitly forwards recordVideo into pooled browser.newContext; checked-in sources/driver remain unchanged. One-minute ordinary HIGH L4 smoke run completed its cap at tick3412 (`test-results/b113-video/smoke`). Expected `test-results/b113-video/smoke-video` directory was absent after context disposal. No native recording is claimed; forwarding alone did not resolve recording. Pool/protocol recording behavior remains a driver gap, and identical wrapper retries are not justified.

## Consecutive capture fallback verified

A permitted ignored wrapper added read-only page screenshots every500ms during an unchanged ordinary HIGH L4 zoom1.5 four-minute run. Saved473 frames under `test-results/b113-l4-sequence-high/sequence`. Opened local review sheet `test-results/b113-sequence-review.jpg`, consecutive ticks9021–9200: active breach fighting, but overlapping crowd still hides individual Alpha soles. This verifies the capture fallback without closing tank-foot acceptance. Raw sequence/review sheet remain outside git; the sole retained report contact sheet is unchanged.

## Full-size sequence review

Opened original sequence frames `00299-t9021.jpg`, `00300-t9049.jpg`, `00301-t9079.jpg` at full size. Large infected and surrounding actors move between frames; no obvious frozen crowd in this short window. Courier-follow camera movement and body overlap still prevent continuous individual sole tracking. These are breach-area frames and do not qualify all tank attacks.

## Prepared next camera observation

Ignored `test-results/b113-video/fixed-tank-entry.ts` is prepared and syntax checked, not yet run. It retains the screenshot observer and sets only camera framing after tick4500: position(−6,11,39), target(−20,0,27.5), zoom1.5, using the authored l4-tank-stop anchor. No gameplay or input-policy modification. This is not collected acceptance evidence.

## Fixed tank camera run

Prepared wrapper now ran240 seconds HIGH zoom1.5;472 frames saved at `test-results/b113-l4-fixed-high/sequence`. Opened original ticks7250 and14202. Camera holds the tank consistently, but the near hull blocks large infected lower bodies on the far side. Neither frame qualifies planted soles. This corrects the earlier prepared-only status; an opposite-side camera would be needed for that actor cluster. No additional simulation/input changes.

## Opposite tank camera run

Collected240 seconds HIGH zoom1.5 from camera(−34,11,16), target(−20,0,27.5);473 frames under `test-results/b113-l4-opposite-high/sequence`. Opened ticks7258 and14140: south-wall large infected are partly frame-edge/fence occluded, later fallen. This exposes the opposite side but still supplies no continuous planted-sole track. Tank-foot acceptance stays open; another identical view is not useful.

## South-shifted camera candidate

Collected240 seconds HIGH zoom1.5,478 frames (`test-results/b113-l4-south-high/sequence`) from camera(−34,11,6), target(−20,0,17.5). Opened ticks7228 and14360. Early view has corpses and clear paving; final frame exposes a large standing infected feet near sandbags. This is a candidate for consecutive review, not a planted-foot verdict. Preceding saved frames remain to be inspected; no additional replay is needed to review that window.

## HIGH south-window consecutive review

Opened local crop sheet `test-results/b113-south-feet-review.jpg`, ten consecutive frames ticks14089–14360 (~4.5 s). The large infected visible foot remains near the same paving lines while upper-body pose shifts; no obvious sliding in this bounded HIGH window. Identity and complete strike/roar/slam cycles are not established. This narrows the visual gap but does not close all tank attacks or LOW. Raw review sheet remains ignored.

## LOW matching south-camera run

Collected240 seconds LOW zoom1.5 with identical south camera after the HIGH pass;474 frames (`test-results/b113-l4-south-low/sequence`). Opened local final-ten-frame crop sheet `test-results/b113-south-low-review.jpg`, ticks13974–14245. Ordinary infected moves around sandbags; the large actor is clipped at left edge. This does not supply a comparable Alpha sole track. LOW tank-foot qualification stays open. Cap is intentional; no native video claimed.

## Wider LOW crop identity audit

Opened `test-results/b113-low-left-review.jpg` from the same final ten frames, crop(0,160)–(700,650). Mixed ordinary/armored infected move through the left side; no confidently identified Alpha or stable sole track. Nearby sampled observations list IDs/HP but lack archetype; visual size alone cannot establish Alpha identity. A read-only identity observer is required before attributing this window to the requested Alpha. No new replay performed.

## Identity observer prepared

Ignored `test-results/b113-video/identified-feet-entry.ts` is prepared and syntax checked, not run. Each half-second sample records actors selected by archetype containing alpha or infected.alphaType, with ID/type, transform, HP, brain state/special/target and projected position. This will distinguish Alpha identity from visually large ordinary actors. No actor/simulation mutation; existing camera-only framing retained. No new identity evidence is claimed yet.

## Alpha identity observer verified

Four-minute HIGH observer run produced473 half-second receipts under `test-results/b113-l4-identified-high/alpha-observer.jsonl`, with screenshots alongside. Living Alpha states include43 ordinary attack samples and charge special samples;89 living Alpha observations fall within10m of tank anchor. Brute #372 is identified near the tank. No roar/slam sample is claimed. Identity hookup works; matching visual attack/sole review remains pending. Telemetry does not substitute for visible planting.

## Identified attack frames reviewed

Matched brute Alpha #372 ordinary attack states at ticks10017/10077 to `test-results/b113-l4-identified-high/sequence/00332-t10017.jpg` and `00334-t10077.jpg`; opened both full-size. Actor is at the upper edge behind the perimeter; fence/tank obscure lower legs. Identity is established, but planted soles remain unqualified. Charge windows are recorded at9325–9445 and9807–9927; these are not roar/slam proof.

## Identified camera tracking succeeds

Four-minute HIGH camera-only Alpha tracking run saved475 samples;218 track living #372 near tank (ticks7273–13804). Opened `test-results/b113-l4-tracked-high/sequence/00332-t10012.jpg`: identified Alpha full body and feet visible beside opened south breach. This provides a useful consecutive review candidate, not yet a no-slide verdict. Tracking supplements ordinary input; it is not a normal-camera completion run.

## Identified HIGH strike sequence

Opened local crop sheets `test-results/b113-tracked-high-review.jpg` (ticks9921–10132, movement/turning) and `test-results/b113-tracked-attack-review.jpg` (ticks13322–13533, including #372 attack states13352/13413/13473/13533). The identified Alpha steps/pivots, then strikes beside the opened breach. No obvious prolonged foot slide in sampled HIGH strikes; objective arrow and nearby actors intermittently obscure portions of feet. This is bounded ordinary-strike evidence, not all-special or LOW qualification.

## Identified LOW tracking collected

Four-minute matching LOW run saved479 receipts,210 tracking living Alpha (`test-results/b113-l4-tracked-low`). Tracked state samples:151 attracted,46 chase,11 alerted,2 stagger; charge specials start at8191. Zero ordinary attack samples on tracked actor, so no comparable LOW ordinary-strike window is supplied. Half-second sampling can miss brief states; this is not proof no strike occurred. Charge visual review remains pending.

## LOW identified charge review

Opened `test-results/b113-low-charge-review.jpg`, consecutive ticks8161–8342, Alpha #246. Telegraph8191, active8222/8252, recovery8282/8312/8342. Charge travel is followed by fixed recovery position(−17.6114,.75,23.2720), with no obvious continuing recovery glide in viewed frames. Fence partly obscures contact. This is bounded charge-recovery evidence, not ordinary strike/roar/slam or complete LOW sole qualification.

## Finding-sheet refresh

Replaced the sole retained contact sheet with four reviewed frames: L3 bridge, provisional L4 stationary warning, L9 visible rendering corruption, provisional L10 close-target warning. Opened the updated sheet at960×584;99,726 bytes. No second report image or raw capture was added.

## Manual HIGH escape attempt

Another540-second HIGH normal-camera run (`test-results/playtest/b113-l4-manual-high`) reached cellar escape but did not finish. Used existing control-file physical input:10s KeyA, then10s KeyW, then returned to driver. Opened `captures/campaign-manual-west.jpg` (96HP near residential fence) and `campaign-manual-north.jpg` (47HP back toward plaza). This manual route did not improve completion; steering/combat attribution remains open. No skips, teleport, immortality or simulation mutation. Additional stationary warnings remain unqualified; intentional cap is not product P0.

## Same-actor south-breach arrivals

Authored L4 south perimeter is z22.5 (`src/data/l4.ts`). Existing identified histories show live HIGH Alpha #372 and LOW #246 crossing from z>22.5 to z≤22.5 within perimeter X bounds. Exact before/after tick/transforms are in `observedSouthCrossings`. These establish exterior-to-interior arrival for the identified actors alongside opened-breach imagery. They do not prove every ordinary infected route or zero crowd stalls across the full level.

## Additional HIGH stationary capture review

Opened manual-attempt warning captures `campaign-L4-10809-enemy-frozen.jpg` (#257,9.1m) and `campaign-L4-11589-enemy-frozen.jpg` (#239,3.2m) under `test-results/playtest/b113-l4-manual-high/captures`. Both show dense truck/perimeter crowd. Actors are inside camp and near wire; flagged identity and obstacle attribution remain unresolved. These do not establish outside-wire frozen AI, and do not clear the warnings either. Provisional classification retained.

## Wider-view HIGH completion attempt

Ordinary HIGH zoom1 ran540 seconds without skips (`test-results/playtest/b113-l4-wide-high`) and again ended at cellar escape, tick32211,80m from objective. The wider view did not resolve the repeated route/death loop. No full L4 completion is claimed. Further unchanged completion replays are not justified by this result.

## Second manual bearing attempt

HIGH zoom1 attempt `test-results/playtest/b113-l4-bearing-high` stopped after336s without completion. Existing control-file physical legs:10s KeyA (fence79HP),10s KeyD+KeyW (back plaza30HP),10s KeyS (café death), then driver resumed. Opened all three `campaign-bearing-first/second/south.jpg` captures. Manual mode influences no-progress timing; the automatic90s stop at tick19955 is not a confirmed product P0. This manual approach also fails and does not justify more identical replay.

## Broader short-sweep review

Opened local five-frame sheets `test-results/b113-l6-broad-review.jpg` (ticks2720/5427/8129/10834/13543), `b113-l9-broad-review.jpg` (2710/5412/8117/10825/13528), and `b113-l10-broad-review.jpg` (2713/5418/8136/10854/13560). L6 repeatedly displays Survivor lost/Rejoin Marcus, reinforcing conspicuous babysitting; dark tunnel courier remains readable and crowded telegraphs create pressure. L9 moves from hull pressure to smoking evacuation crowd; striped corruption persists at10825/13528, not just one capture. L10 repeats close combat around the same dark crop patch; visually sparse and repetitive in this sample, with driver backtracking limiting product pacing attribution. No additional confirmed geometry defect is established by these sheets. All review sheets stay ignored.
