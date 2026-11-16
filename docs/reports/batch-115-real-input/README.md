# Batch 115 real-input QA — in progress

Candidate `c02a9b91`. Permissions were restored after initial listener and Git denials. HIGH WebGPU zoom 1.5 real-input L6/L7/L8 now complete without skips: 288/131/550 seconds. Renderer receipts explicitly record `webgpu`. Raw evidence: `test-results/playtest/b115-high-l6-l8/`. L7 uses the two survivors carried from L6; full authored-cohort coverage remains open.

QA build, typecheck and lint passed. Required unchanged remote unit suite passed on 46.225.66.90 in 190.3 seconds within 240 seconds; log `/tmp/s152-remote.log`.

Driver warnings: L6 opening rest delay; L8 following Nadia navigation/ring delays. All recover through full level completion; product severity awaits review.

Coverage and remaining qualification are detailed below. No checks remain running. No source or tool edits.

LOW WebGPU L6 expired at the 595-second reservation limit while at the exit; no completion receipt. LOW L7 debug entry (24-person cohort) completed in 147 seconds with no skips/issues. Tick 6317 HUD: 21/24 nearby, Waiting for Marcus (19 m away); recovered through completion. Raw: `test-results/playtest/b115-low-l6-l7/`.

Created and opened `contact-sheet.jpg`: HIGH L6 ticks 8131/13537 show close threats and an under-attack warning; HIGH L7 tick 5465 shows Group 2/2 nearby; HIGH L8 tick 16392 shows plaza combat. Navigation assists use map knowledge and physical input; runs are not described as unassisted.

HIGH WebGPU L10 completed with no skips through three retained-profile segments (480 + 480 + 388 seconds). Both 480-second segments saved through production Resume and yielded cleanly. Actual Credits visually inspected at `test-results/playtest/b115-high-l10/captures/campaign-3-L10-t19010.jpg`, segment three tick 19010. Driver also records finished=true. Region/death counts and melee limitations are detailed below. No checks remain running.

## Measured review and remaining qualification

L10 death-release events by objective: farms 2, restricted zone 1, research hangar 0, delivery corridor 0, installation 0, console defense 1 (four total). All three segments have explicit WebGPU receipts. Farms and delivery contain long repeated corridor travel with close pursuers; repetition is a pacing concern, while danger remains visible in captures and deaths. No universal melee arc/hit alignment claim follows: this run primarily used firearms, and detailed attack-to-hit visual sequences remain unqualified.

The compact JSON includes sampled waiting-HUD duration and sample counts per segment. These are not distinct alarm-event counts or intentional player waiting measurements. No sampled objective text says “Wait for us” or “lost behind you”; dedicated transient follower-alarm telemetry was not enabled, so zero exact prompt counts are unproven. LOW L7's full cohort has explicit waiting-for-survivor text; HIGH L7's two-person carryover is weaker coverage. No geometry enclosure is confirmed from sparse frames. Injured-survivor continuous follow-through still requires stronger individual trajectory review.

**P2 provisional — LOW L6 exit completion not reproduced.** Twenty-one player death-release events (five retreat, sixteen exit) precede reservation expiry. At tick 28374 the player is dead near x249, 24 m from the exit. Capture neighborhood: `test-results/playtest/b115-low-l6-l7/captures/continue-L6-L6-t27060.jpg`, tick 27060, opened full-size (15 HP, dense crowd, 24 m exit distance). Difficulty and driver stair steering are confounded; this is not a confirmed permanent softlock. HIGH completes with six deaths (two retreat, four exit). No confirmed P1/P3 product finding.

Driver gaps remain: exact transient prompt counting, intentional waiting measurement, continuous individual survivor/contact traces, and melee arc/hit sequence qualification. Recovering navigation warnings are not automatically product defects. LOW L6 full completion remains open. This report is evidence of completed HIGH escorts and full L10 credits, not full batch approval.

LOW L7 sampled waiting-for-survivor HUD duration is approximately 21.73 seconds; HIGH L7 records none in sampled objective text. One inspected contact sheet is committed; raw captures stay ignored.
