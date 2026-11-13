# PO UAT 11–12 real-input QA — HOLD

Target gameplay revision: **832d397886ede0042d3dc6867d4416238f48e507**, the requested main snapshot. PROD reference: batch 89 / 20984444. Later lane commits contain report artifacts only.

**HOLD. Full QA is incomplete.** Two P2 findings are reproduced; one fixture-qualified P1 candidate needs confirmation. Missing coverage independently prevents GO. This report does not claim the active QA objective is achieved.

## Findings

- **P2 — L7 bus overlaps soldiers:** opened HIGH zoom-1 departure frames at 0.7 and 3.43 seconds show soldiers intersecting the front bumper. The sequence completes. Other settings show nearby soldiers/body overlap, with less conclusive live-soldier penetration.
- **P2 — L10 early Mega cannot be hurt by melee:** actual player axe contacts report amount 0 with Mega HP 3000/3000: HIGH z1 four hits, HIGH z1.5 four hits, LOW z1 seven hits. Exact events and source hashes are in [evidence.json](evidence.json). Read-only source trace: `src/sim/combat/Damage.ts:80` returns 0 for an L10 pursuit enemy before cure-installed, bypassing the configured HP floor and regeneration path. No damage/recovery pass is claimed.
- **Candidate P1 — L8 stalls after 14/14:** elephant-yard checkpoint reaches 14/14 in 29.48 s HIGH and 28.23 s LOW, then remains on the boarding objective. HIGH observation exceeded 90 s without advancement; LOW explicit E at the marker did not advance. Fresh-route confirmation and final runtime predicate capture remain missing. Source hypothesis: driver boarding requires hale-fallen, which depends on Hale's elephant-charge story sequence; killing the elephant first may bypass it. This is not promoted to a confirmed P1 from source inspection alone.

No fixes were made.

## PO findings, verbatim disposition

| PO finding | Disposition against target main |
| --- | --- |
| L6: “After I closed the first door, no more Zombies attacked the group, which made the game boring from there on” | LOW longer retry: 36 attack starts in 27.85 s after closure; full level and every 30 s window remain unverified. HIGH first hatch was not closed. |
| L7: “The bus is crashing to soldiers” | P2 reproduced in opened HIGH z1 departure frames; route completes. Other passes show close soldiers/body overlap. |
| L8: boarding stalled 0/14 with survivors inside the elephant yard | 14/14 reached in 29.48 s HIGH and 28.23 s LOW checkpoint passes; later 14/14 handoff stalls. Candidate P1, fixture-qualified. Driver-door handoff not passed. |
| L9: “L9; I am stuck here” (rail crossing hatch) | Rail and bay progressed in all three requested settings, using checkpoint setup; HIGH z1 needed manual F after repeated deaths. |
| L9: “Also the end is strange, bc I cannot walk away but also not drive anymore” | Countdowns and restart/defense prompts observed; bay progressed. Exact full input availability at every final-bay moment was not exhaustively tested. |
| L9: “It somehow proceeded, but now I am this... super strange” | Upright courier in opened live HIGH z1.5 bridge-save handover. Other requested handover settings unverified. |
| L9: school bus overlapping the APC | Unverified. |
| L10: “I cannot select the gun. Not by clicking and not by number” | Hunting rifle key Q and click passed HIGH; LOW click passed. Later arsenal: all 14 clicks passed HIGH/LOW. Full hangar key coverage remains open. |
| L10: “also the new knife is not selectable” | Later arsenal machete click passed HIGH/LOW. Literal knife absent from fixture; knife identity/key coverage unverified. |
| L10: “Molotoc cocktail shows this strange blue lines.” | Post-use stills inspected; full aiming trajectory remains unverified. |
| L10: “also after using it, it swichess back to the axe for no reasin” | HIGH initial exhaustion restored rifle. LOW exhaustion selected MG after intervening normal combat; exact previous-weapon sequence qualified. |
| L10: “Corn field on the street” | No systematic road-crop sweep completed; unverified. |
| L10: “I really like the mega hunting me. I don't like that I cannot hurt it. Make it so I can hurt it, but it recovers very fast, so I cannot kill it.” | P2: actual axe contacts amount 0 in HIGH z1 (4), HIGH z1.5 (4), LOW z1 (7). Positive damage and rapid recovery not demonstrated. |


## Coverage audit (current)

| Requested check | HIGH z1 | HIGH z1.5 | LOW z1 |
| --- | --- | --- | --- |
| L6 full; first hatch closed; every 30 s attack window | Incomplete: exit reached, first hatch not closed | Missing | First hatch closed; longer retry observed 27.85 s and 36 attack starts, incomplete |
| L7 departure / soldiers | Complete route; P2 overlap reproduced | Complete route; nearby soldier/body overlap observed | Complete route; nearby soldiers/body overlap observed |
| L8 14/14 timing / driver-door handoff | 29.48 s; post-count stall in checkpoint | Camera assertion failure; unverified | 28.23 s; post-count stall after E at marker |
| L9 rail / final bay | Progressed with manual F, 19 deaths | Progressed, zero deaths | Progressed, zero deaths |
| L9 playable L10 handover pose / school bus | Missing; loading transition only | Bridge-save live handover upright; bus overlap unverified | Missing; loading transition only |
| L10 first 5 min / gun selection | Rifle key+click passed; incomplete broader scope | Five-minute sample; hangar not reached | Five-minute sample; rifle click selected; broader scope incomplete |
| L10 every hangar weapon key+click | Later fixture: all 14 by click; machete key unresolved | Missing | Later fixture: all 14 by click; keys incomplete |
| L10 knife | Missing (not in returned-arsenal fixture) | Missing | Missing |
| L10 all molotov charges / prior weapon | Later fixture initial charges exhausted; rifle restored | Missing | Later fixture exhausted; MG selected; prior-weapon sequence not controlled |
| L10 molotov blue lines | Post-use stills only; full aiming view missing | Missing | Missing |
| L10 early hunting Mega damage+recovery | Four axe hits amount 0; P2 damage failure | Four axe hits amount 0; P2 damage failure | Seven axe hits amount 0; P2 damage failure; recovery unverified |
| L10 crops on roads | No systematic sweep | Missing | Missing |


## Method and validation

Read `docs/qa/po-checklist.md` first. Used fresh production build, then QA build; headless WebGPU through `tools/playtest` and the serial browser-pool/e2e-lock wrapper, one lane browser, ports 4951/4952, bounded reservations. Normal WASD, mouse/Space combat, E/F, toolbar clicks and weapon keys; no god mode, teleport or objective skips. Existing checkpoint fixtures are identified below. Driver assists occurred in L6 and the full L8 approach and are retained in run receipts; these passes are not described as unaided human play. Some supplementary capture routines changed camera framing; only explicit run/capture telemetry supports quality/zoom claims.

Production build, QA build, typecheck and lint passed. Prescribed `sh tools/remote/run.sh "$PWD" -- npm test` passed on runner 94.130.181.173: 27 files, 106 tests passed, one skipped; 232.3 s within the 240 s budget. Initial sandbox/pool/runner failures were resolved. No push, deploy or main movement occurred.

[Evidence index](evidence.json) contains 23 run summaries and exact Mega hit receipts. A harness finished flag qualifies only that run's scope. L9 simSeconds=-1 is invalid because the tick resets at handover. Retained L6 browser storage contains campaign inventory, not a mission resume; the earlier assumption that it could resume gate-90 was disproved. Raw logs/captures remain local in `test-results/s88-b90high/`.

## Per-level observations and delays

| Level | Observed route / delays | Experience and limits |
| --- | --- | --- |
| L6 | HIGH 480 s: 12 deaths, exit reached, first hatch not closed. LOW 480 s: six deaths, first hatch closed only 1.45 s before end. LOW 540 s retry: nine deaths, first hatch closed at tick 30609; 36 attack starts over next 27.85 s, including a death. Shelter-rest warnings about 32.5 s; separate 20 s Rejoin Marcus delay. | Heavy repeated combat/deaths; no post-hatch boredom demonstrated in observed segment. Full level and every 30 s window still unverified. Time-cap cannot-finish is not proof of a soft lock. |
| L7 | Complete: HIGH z1 284 s, HIGH z1.5 201 s, LOW z1 166 s. LOW 20/21 s no-progress warnings occurred during moving departure cinematic and completed. | Active escort/combat with survivor losses. Cinematic warnings harmless; visible vehicle/body intersections disruptive. |
| L8 | Full HIGH approach 480 s ended before elephant yard, one death/three assists. Nadia delays 20/31 s, max 50.421 s, then progressed. Checkpoint boarding count passed HIGH/LOW; handoff stalled. HIGH z1.5 failed camera assertion (observed target 1). | Quiet post-count wait boring. Manual retry from five metres off marker did not qualify a valid door interaction. LOW later E at marker did not advance. |
| L9 | Pre-rail checkpoint through L10 load: HIGH z1 445 s/19 deaths/manual F; HIGH z1.5 158 s/zero deaths; LOW z1 153 s/zero deaths. Countdowns/restart prompts and final bay 4/4 observed. | Repetitive HIGH death loop before hatch action; other passes progressed. Stopped vehicle was explained by hold countdown. Separate bridge-save live HIGH z1.5 handover completed in 25 s and courier was upright. |
| L10 | Five-minute routes at all three settings. HIGH z1 two weapon selection captures passed rifle key/click. LOW rifle click selected. Early Mega zero-damage contact confirmed. Driver stationary-enemy and route no-progress warnings need review; LOW manual observation contributed to delay. | Hunter provides pressure but cannot be hurt in measured melee contacts. No complete road-crop or hangar presentation sweep. |

## Weapon and throwable checks

Later `l10-dispersal-console` fixture supplies the returned arsenal; it is not the early hunt or hangar presentation. All 14 authored returned weapons selected by toolbar click on HIGH and LOW: bat, axe, handgun, army MG, shotgun, launcher, pipe bomb, hunting rifle, nail gun, machete, molotov, assault rifle, flashbang, flamethrower. HIGH keys 1–9 and Q cycling selected the documented actions in receipts; machete key and full LOW key coverage remain incomplete. Literal knife was absent from this fixture; machete click success does not settle its identity.

HIGH initial molotov exhaustion restored the previously selected hunting rifle. LOW spaced inputs exhausted molotov and selected MG; normal combat had resumed between sequences, so exact prior-weapon tracking is qualified. Rapid inputs may land during cooldown. Later HIGH throws crossing a death/reset are excluded. Post-use stills show no blue aiming lines, but do not qualify the full aiming trajectory.

The first LOW click sampler was stale/partial; superseded by `l10-low-input-final/input-receipt.json`, which waits for selected state. Commands submitted after session closure are excluded. The initial HIGH manual mode preceded run initialization and delayed the wall timer; manual input timestamps, not its later 180 s driver timer, describe that sequence.

## Captures opened

[Single contact sheet](contact-sheet.jpg) was rendered and opened. It contains six inspected source frames: HIGH L7 soldier overlap; LOW L8 14/14 stall; LOW L9 restart prompt; HIGH rifle Q selection; HIGH molotov-to-rifle restoration; LOW rifle click selection.

Other inspected frames include L6 HIGH/LOW checkpoint-yield combat scenes; L7 departure frames at approximately 0.5/3/8 s across settings; L9 rail hatch, final bay and L10 loading; live `high-z1-5-bridge-handover/captures/continue-L9-L9-L10-actual-handover-high-z1-5.jpg` showing upright courier; L10 HIGH z1.5 final route and LOW post-molotov MG frame. The in-APC courier appears horizontal/reclined in some L9 frames; this is separate from the post-handover folded-pose report and remains a visual observation requiring review.

## Closeout

The original full scope is retained in the matrix. Additional execution time is required for the open cells, especially L6 full cadence/completion, L8 fresh-route handoff/HIGH z1.5, remaining playable handover and school-bus observations, full hangar keys/knife, molotov aiming/controlled LOW restoration and crops. No check or input controller is running. The extension request is pending; the goal remains incomplete.
