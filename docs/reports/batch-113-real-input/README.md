# Batch 113 real-input browser QA — incomplete acceptance

Candidate `69562fd1ee5ba56140a8ce1f0a2f5e6b407e1c11`. Report only. **L4 full completion, outside-wire route attribution and readable Alpha tank foot planting remain open.** Both L3 tiers completed, the three L7 wreck closeups were reviewed, and HIGH L6/L9/L10 four-minute sweeps were collected.

## Method and validation

Headless WebGPU, ordinary mortal keyboard/mouse combat, debug level entry, no objective skips. HIGH runs precede LOW. One guarded browser at a time through the pool / `tools/e2e-lock.sh`, ports 5025/5026, reservations below ten minutes. L7 closeups supplement the real-input route with camera-only framing in the registered level, paused at tick 0. No source or playtest edits.

QA build (`MI_BUILD_CACHE=off npm run build:qa`), typecheck and lint pass. The unchanged prescribed `sh tools/remote/run.sh "$PWD" -- npm test` passes on 46.225.66.90: 27 files, 105 passed, one existing skip, 150-case inventory, 183.2 seconds within 240 seconds. Initial sandbox cache/socket denials and runner unavailability were resolved before successful runs. No checks remain running.

[qa.json](qa.json) is below 200 KB. One small [contact sheet](contact-sheet.jpg) was created and opened, containing L3 tick 21652 and L4 tick 11864. All raw captures remain ignored under `test-results/`.

## Coverage

| Check | Collected evidence | Qualification |
| --- | --- | --- |
| L3 HIGH zoom 1 | Full level, 414 s, no skips/issues, seven deaths | Opened bridge tick 21652: infected on deck, one damaged target; no obvious sink/float in frame. Universal hitability unproven. |
| L3 LOW zoom 1 | Full level, 157 s, no skips/issues | Extra bridge frame is post-fight; geometry readable but no infected to qualify close damage. |
| L4 HIGH zoom 1.5 | 480 s through cellar escape; no skips | Not complete. Stationary warnings require attribution. Feet occluded. Continuation restarted at quartermaster and was interrupted. |
| L4 LOW zoom 1.5 | 540 s through cellar escape; no skips, 25 deaths | Not complete. No stationary-enemy warnings. Opened north-breach tick 10839: dense interior crowd and Alphas; feet occluded. |
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

Still required: full HIGH and LOW L4 completion; observable outside-wire routing and breach-wave arrivals; continuously readable Alpha soles near the tank. Existing wide frames show substantial interior combat but cannot independently establish every outside actor's route or planted feet. L3 close-target visual coverage also remains bounded to the reviewed HIGH frame; the LOW extra capture landed after combat.

## Capture locations

Runs: `test-results/playtest/b113-l3-high`, `b113-l3-low`, `b113-l4-high`, `b113-l4-low`, `b113-l6-high`, `b113-l7-high`, `b113-l9-high`, `b113-l10-high`. Each contains logs, capture ticks and available summaries. The interrupted HIGH L4 parent lacks a final aggregate summary; its first segment receipt is retained.

L7 camera-only captures: `test-results/b113-wrecks/military-1.jpg`, `military-3.jpg`, `military-4.jpg`. Registered placements are D-FAIR/l7-military-1 (214,25), military-3 (138,25), military-4 (100,6). Backend HIGH WebGPU and camera/tick receipts are in qa.json. These are placement observations, not extra combat runs.

No deployment, push, main movement, zombie stat tuning, corpse removal, protected-reference edits, source fixes or playtest-tool edits occurred. This is an incomplete acceptance report, not batch approval.
