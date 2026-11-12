# PO UAT 11–12 real-input QA — provisional HOLD

**Target:** `main` at `832d397886ede0042d3dc6867d4416238f48e507` (batch 89 / PROD 20984444), HIGH first at zoom 1 and 1.5, then LOW at zoom 1.

## Verdict

**Provisional HOLD — QA incomplete.** The required HIGH/LOW coverage and exact first-hatch scenario remain open. P2: L7 departure visibly overlaps soldiers at the front bumper on HIGH zoom 1; reproduced in opened captures at 0.7 and 3.43 seconds.

## Current evidence

- Production build, QA build, typecheck and lint passed.
- Remote command `sh tools/remote/run.sh "$PWD" -- npm test` passed on runner 94.130.181.173: 27 files, 106 tests passed, one skipped; 232.3 seconds against the 240-second budget. Earlier infrastructure failures were resolved.
- Browser pool access is restored. Runs used one headless WebGPU session under the serial pool wrapper, port 4951, normal input, no objective skips.
- Initial HIGH zoom-1 L6 sample: 60 wall seconds, 54 simulation seconds, no deaths or assists, reached retreat.
- Extended HIGH zoom-1 L6 attempt: 480 wall seconds, 478 simulation seconds, 12 deaths, one logged assist, no objective skips; reached exit, did not finish. Army MG attacks: 2610; fire axe: 32. Receipt: `test-results/s88-b90high/high-z1-l6-full/summary.json`.
- Final gate state: first hatch x90 passed but `closedAt=0`; x150 closed at tick 25327; x210 closed at tick 27058. This does **not** verify the requested first-hatch scenario.
- At tick 28680, observer recorded seven attacking infected that second, including five attacking the player; player HP 30. One survivor remained following and 28 had turned. This attempt had substantial pressure; a complete post-first-hatch attack-gap analysis remains open.
- The only driver issue was 20 seconds without objective progress during the authored shelter rest (maximum 32.542 seconds). Classification remains open; the rest objective itself is not proof of a stuck defect.

## Captures opened

Both checkpoint-yield captures were opened. The initial sample shows retreat HUD, survivor warning, armed courier and threats on the minimap. The extended attempt shows an exit objective at 0/1 and 24 metres, courier at 30 HP amid attacking infected and ground telegraphs. These illustrate a pressured attempt; they do not establish completion. [Contact sheet](contact-sheet.jpg) contains these inspected captures.

## Remaining required coverage

All of the following remain open at HIGH zoom 1 and 1.5, followed by LOW zoom 1:

- L6 full completion and every 30-second attack window after the first hatch actually closes.
- L7 bus departure versus soldiers.
- L8 boarding to 14/14, timing and driver-door marker.
- L9 rail hatch, final bay, handover pose and school-bus/APC overlap.
- L10 first five minutes: every hangar weapon by click and key, all molotov charges and previous-weapon restoration, Mega damage/recovery, crops on roads.
- Per-level stuck moments over ten seconds and fun/boring/harmless assessment; final P1/P2 list and evidence-based GO/HOLD.

No check is running at this report checkpoint. No gameplay code was changed. Full raw evidence is retained under `test-results/s88-b90high/` and is not committed.

## L7 HIGH zoom 1

Completed in 284 wall seconds with no skipped objectives and zero driver issues. Departure carried 12 boarded identities. Opened captures `campaign-L7-departure-0-5.jpg`, `campaign-L7-departure-3.jpg`, and `campaign-L7-departure-8.jpg` under `test-results/s88-b90high/high-z1-l7/captures/`. Soldiers visibly overlap the front bumper in the first two frames; by 8.08 seconds the bus has moved clear. **P2, reproduced:** “The bus is crashing to soldiers.” The sequence completes, so no progression block was observed. The route has active combat and survivor losses; departure overlap is visually disruptive. Other quality/zoom passes remain open.

## L8 HIGH zoom 1 — approach only

Bounded eight-minute route ended before boarding, at “Enter the elephant yard · 60 m”. Receipt: `test-results/s88-b90high/high-z1-l8/summary.json`: 480 wall seconds, 477 simulation seconds, one death, three assists, no objective skips, 761 army-MG attacks. The Nadia-follow phase produced driver warnings at 20 and 31 seconds without objective progress (maximum 50.421 seconds); route later advanced, so these are recorded delays with defect classification open. The final checkpoint-yield capture was opened: courier and following group on a fenced bridge, elephant-yard objective visible, APC armour 1000/1000. Boarding timing, 14/14 completion and driver-door marker remain unmeasured. Next route must retain its profile across pool reservations rather than discard checkpoint progress.

## L8 HIGH zoom 1 — elephant-yard checkpoint

Loaded the existing `l8-elephant-apc-yard-engaged` checkpoint fixture (permitted setup), then used the normal input driver. Observed 0/14 at tick 822 and 14/14 at tick 2591: **29.48 simulation seconds**. Original 0/14 stall did not reproduce in this fixture pass. The driver subsequently remained at the marker with “Cover the survivors while they board · 14/14 aboard · 0 m” for 90.25 seconds and stopped without skipping. Candidate progression/boarding-input issue remains unclassified pending deliberate manual boarding input; the driver P0 cannot-finish label is not adopted as a confirmed game severity. Opened `test-results/s88-b90high/high-z1-l8-boarding/captures/campaign-L8-8145-cannot-finish.jpg`: full-health courier, APC armour full, marker beside APC, boarding HUD still active, no visible enemies. This was a quiet/boring wait after successful boarding count progression. Raw receipt: `test-results/s88-b90high/high-z1-l8-boarding/`. No check remains running.

## L8 manual-input follow-up

Same elephant-yard fixture, HIGH zoom 1, visible-only observation and explicit keyboard/screen-point input, bounded 120-second sample (`test-results/s88-b90high/l8-manual-board/`). Again reached 14/14. Courier stopped near the APC side at x97.83,z75.77, about five metres from marker x93.275,z74.71; movement toward the marker did not advance beyond that position. E presses from this offset produced no transition and no visible interaction prompt. This does not qualify as a valid driver-door interaction test. A final E command was submitted after the session had already ended and is excluded from evidence. Follow-up must route around the hull, verify an interaction prompt, then press E. No game code changed and no browser process from this lane remains running.

## L9 HIGH zoom 1 — rail checkpoint through L10 load

Loaded `l9-before-rail-stall` checkpoint, then normal driver input. Completed L9 to L10 loading in 445 wall seconds, no objective skips, 19 deaths. Rail HUD explicitly showed a 20-second countdown, hatch F control and inability to leave the APC. Repeated deaths roughly 15 seconds apart initially reset the attempt. A real F press was logged at tick 18365; subsequently the APC cleared the crossing, final bay reached 3/4 at trucks, bridge/crash/crawl sequence ran, and L10 loaded. **Rail and final-bay progression succeeded in this pass**, with the driver needing a manual hatch action. Summary simulation time -1 is invalid due to the handover tick reset and must not be used. Receipt: `test-results/s88-b90high/high-z1-l9-rail/`.

Opened `campaign-rail-hatch-F.jpg` (countdown and closed hatch), `campaign-L9-t24410.jpg` (post-bay drive-to-bridge HUD, courier horizontal inside windshield/cabin), and `campaign-L9-result.jpg` (L10 loading screen). The horizontal in-cabin figure is a visual observation requiring closer pose review; it does not establish the reported folded pose in playable L10. School-bus overlap was not captured/verified. Playable L10 handover remains open because the driver exited at level change. Combat/death loops were repetitive before the hatch action; after it the sequence progressed. No browser check is running.

## L10 HIGH zoom 1 — first five minutes

Resumed from the retained L9 campaign profile; 300 wall seconds / 298 simulation seconds, three deaths, no assists or objective skips. Hunting rifle acquired. Explicit Q input (the displayed shortcut) at tick 14277 and toolbar button click at tick 15055 each produced a selected Hunting Rifle HUD and highlighted toolbar entry in opened captures `campaign-rifle-key-Q.jpg` and `campaign-rifle-toolbar-click.jpg`. **Hunting rifle selectable by key and click in this pass.** Earlier key 7 was an unavailable rocket shortcut and is excluded from selection conclusions. Raw receipt/captures: `test-results/s88-b90high/high-z1-l10/`.

The driver flagged infected #678 at 3000/3000 HP after eight seconds of nearby axe attacks; without confirmed hit and recovery telemetry this does not establish invulnerability. Opened the live capture showing Mega nearby and ground attack telegraphs. Knife, all hangar weapons, all molotov charges/return behavior, confirmed Mega damage and regeneration, and road-crop sweep remain open. The inspected rifle captures show an upright courier after the resumed L9 handover, but this is a resumed save and cannot prove the uninterrupted handover pose. No check is running.

## L10 HIGH zoom 1 — supplementary returned-arsenal checkpoint

Used the existing `l10-dispersal-console` save (later finale, not early hunt/hangar). Physical toolbar clicks selected all 14 authored returned weapons, recorded in `test-results/s88-b90high/l10-arsenal-high/selection-receipt.json`: bat, axe, handgun, army MG, shotgun, launcher, pipe bomb, hunting rifle, nail gun, machete, molotov, assault rifle, flashbang, flamethrower. Keys 1–9 selected their expected actions; Q cycling selected rifle, nail gun, assault rifle, flamethrower, flashbang and other rack actions. Machete key selection remains unresolved. Knife is not in this fixture and remains untested. Key receipts: `key-throw-receipt.json`, `q-cycle-receipt.json`, `q-extra-receipt.json`.

Selected hunting rifle, then molotov with key 8. Three normal Space attack inputs exhausted the initial molotov charges; selected weapon returned to hunting rifle at tick 4285, with molotov in emptyWeapons. Opened `campaign-molotov-after-0.jpg` and `campaign-molotov-after-2.jpg`; the latter visibly shows Hunting Rifle selected and empty molotov toolbar state. No blue lines were visible in these post-use stills, which do not qualify the full aiming trajectory. Later throw attempts crossed a death/checkpoint reset and are excluded from the original charge-sequence conclusion. **Previous-weapon return passed on initial exhaustion in this later checkpoint.**

Initial manual mode preceded run initialization, delaying the driver wall timer; input timestamps are authoritative for the manual sequence. Manual mode was then released and the driver completed its bounded 180-second combat sample without skips. This is supplementary evidence only; early Mega recovery, hangar presentation, first-five-minute completeness, HIGH 1.5 and LOW passes remain open. No check is running.

## HIGH zoom 1.5 follow-up

L7 completed in 201 wall seconds with no skips or driver issues (`test-results/s88-b90high/high-z1-5-l7/`). Fifteen identities boarded. Opened departure captures at 0.95 and 3.13 seconds; telemetry confirms actual and target zoom 1.5, quality high. A soldier is near the front bumper in the first frame; an infected body overlaps the front in the second. These frames do not independently establish soldier penetration as clearly as HIGH zoom 1. The sequence completes, with combat and bodies along the departure route.

L8 elephant-yard fixture at HIGH zoom 1.5 aborted at the camera assertion: requested zoom 1.5, observed target 1, permitted range 0.5–1.5 (`test-results/s88-b90high/high-z1-5-l8-boarding/`). No boarding conclusion from this failed run. This is a coverage/harness failure, not a demonstrated gameplay defect. No check is running.

## L8 LOW zoom 1 — boarding checkpoint

Existing elephant-yard fixture, normal input, 121-second bounded sample. Observed 0/14 at tick 799 and 14/14 at tick 2493: **28.23 simulation seconds**. Original 0/14 failure did not recur. Explicit E press at the marker was logged at tick 6432; the HUD remained “Cover the survivors while they board · 14/14 aboard · 0 m” through the end. Opened final checkpoint-yield capture: courier/marker beside APC, full HP and APC armour, three standing figures in the yard and a figure beside APC, no apparent incoming combat. **Candidate P1:** post-14/14 progression stall reproduces in this fixture on HIGH and LOW; remains fixture-qualified pending fresh-route confirmation. Waiting is boring; more than ten seconds without advancement was observed. Receipt: `test-results/s88-b90high/low-z1-l8-boarding/`. HIGH zoom 1.5 remains unverified due the earlier camera assertion. No check is running.

## L7 LOW zoom 1

Completed in 166 wall seconds without skips; 24 identities aboard. Opened departure captures at 1.0 and 3.07 seconds; telemetry confirms LOW zoom 1. Soldiers stand close to the front and bodies pass under the bumper; the sequence continues. These stills do not distinguish live soldier penetration as clearly as HIGH zoom 1. Driver warnings at ticks 9011/9072 (20/21 seconds, blank HUD, departure step) occurred while the cinematic bus moved and then completed; recorded as harmless cinematic no-objective warnings, not progression defects. Combat/escort progressed and departure was not blocked. Receipt: `test-results/s88-b90high/low-z1-l7/`. No check is running.
