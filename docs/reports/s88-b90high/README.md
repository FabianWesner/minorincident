# PO UAT 11–12 real-input QA — provisional HOLD

**Target:** `main` at `832d397886ede0042d3dc6867d4416238f48e507` (batch 89 / PROD 20984444), HIGH first at zoom 1 and 1.5, then LOW at zoom 1.

## Verdict

**Provisional HOLD — QA incomplete.** Candidate P1: L8 post-14/14 checkpoint stall on HIGH/LOW. Confirmed P2: L7 departure visibly overlaps soldiers at the front bumper on HIGH zoom 1; reproduced in opened captures at 0.7 and 3.43 seconds.

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

**Release verdict remains HOLD.** Confirmed P2: L7 bus/soldier overlap at HIGH z1; L10 early Mega receives seven actual axe hits for zero damage on LOW. Candidate P1: L8 post-14/14 stall on checkpoint HIGH/LOW; source suggests Hale story gate, final runtime flags/fresh-route confirmation missing. No confirmed P1 is claimed yet. Unverified requirements independently prevent GO.

Commands: production build, QA build, typecheck and lint passed; prescribed remote unit command passed (232.3 s). Contact sheet exists from opened captures. Target gameplay tree remains 832d3978; subsequent commits contain report artifacts only. No deploy, push or main movement was performed. Raw evidence is retained in `test-results/s88-b90high/` and is not committed.

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

## L8 boarding-gate source audit

Read-only source inspection provides a concrete hypothesis for the fixture-qualified post-14/14 stall. `LevelEightZoo.canBoardDriver()` requires `hale-fallen` in addition to every passenger seated and cleared arenas. In `story()`, `hale-keys` is set only while a live elephant performs `elephant.charge` near Hale; the delayed Hale death then sets `hale-fallen`. The inspected elephant-defeated fallback sets `elephant-fallen` but does not set Hale flags. The loaded elephant-yard fixture starts with `hale-keys=false` and `hale-fallen=false`. Thus an elephant killed before the required charge may leave the boarding predicate false despite 14/14. This is a **source-supported hypothesis**, not a captured final runtime predicate; retain candidate P1 status until that state or a fresh-route reproduction is observed. Source: `src/sim/missions/LevelEightZoo.ts` story and canBoardDriver; `src/sim/missions/objectiveText.ts` shows the cover/boarding text whenever canBoardDriver is false. No code changed.

## L9 LOW zoom 1 — rail through L10 loading

Same pre-rail checkpoint; completed in 153 wall seconds with zero deaths, assists or skips. No manual hatch override was needed. Rail countdown completed and the opened `campaign-L9-t2770.jpg` shows “Engine’s back! Drive, now!” plus the moving-boarder instruction. Opened `campaign-L9-t5476.jpg` shows final-bay hatch defense 11 seconds, 4/4 at trucks, full courier HP. Sequence proceeded through crash/crawl to L10 loading. No progression block reproduced in this LOW checkpoint pass; first playable L10 pose and school-bus overlap remain unverified. The visible courier inside the windscreen still reads as a horizontal/reclined body; record as a visual observation requiring pose review rather than proof of the post-L9 folded pose. Summary simSeconds=-1 is invalid due to tick reset at handover. Receipt: `test-results/s88-b90high/low-z1-l9-rail/`. The hold and restart prompts explain the stopped vehicle; no boring wait beyond the announced countdown was established. No check is running.

## L6 LOW zoom 1 — first-hatch checkpoint reached

Eight-minute attempt: 480 wall / 478 simulation seconds, six deaths, one assist, no skips, 2798 army-MG attacks. First hatch x90 closed at tick 28593; sample ended at tick 28680, only **1.45 seconds later**, insufficient for the required 30-second window. Later gates remained open. Final state: retreat, checkpoint `gate-90`, leader x107.16, courier x97.23 at 4.8 HP, one following survivor and 28 turned. Final second observer counted three attacking infected. Opened checkpoint-yield capture shows low-health courier, persistent bodies and survivor-under-attack warning. This is combat pressure, not an observed boring post-hatch gap, but the full criterion remains unverified. Retained profile: `test-results/s88-b90high/low-z1-l6/profile`; later inspection found campaign inventory only, with no L6 mission-resume snapshot. It cannot resume gate-90; the earlier continuation claim was incorrect. The only driver warning was the authored shelter rest (max no-progress 32.561 seconds). No check is running.

## L6 LOW longer attempt / save correction

Inspected retained browser storage: campaign save contains inventory/settings/survivors but no mission resume. Corrected the earlier claim that it preserved the gate-90 checkpoint. Fresh nine-minute attempt (`test-results/s88-b90high/low-z1-l6-long/`) stopped at its 540-second cap, nine deaths, one assist, no skips, first hatch closed at tick 30609. End tick 32280 gives **27.85 seconds after closure**; 1 Hz observer counted **36 attack starts** over that segment. Attacks continued after closure; no 30-second attack-free period exists inside this shorter observed segment. However the full 30-second-window/full-level criterion remains unverified. A death occurred in the segment; it is not an uninterrupted clean survival run. Second hatch was passed but not closed. Driver warned on shelter rest and a 20-second Rejoin Marcus delay, then reported cannot-finish at the time cap while offering E/click for the second gate; this is not proof of a game soft lock. No check is running.

## L10 LOW zoom 1 — five-minute route and confirmed zero damage

Resumed LOW L9 campaign profile; 300 seconds, two deaths, no assists/skips, 134 axe attacks, max no-progress 30.849 seconds (manual observation contributed). Opened rifle-selected capture shows Hunting Rifle selected by toolbar click. Subsequent fire attempt capture shows axe and a different nearby infected, so exclude that attempt from rifle/Mega conclusions.

**P2 reproduced: early hunting Mega takes no melee damage.** `campaign-route-audit.json` records seven real `combat.hit` events from player 1 with `weapon.fire-axe` against Mega 678; all have amount 0 and victim HP 3000/3000. Example tick 3833, attackId 14. This confirms actual contact with zero damage, not merely a full HP bar after possible regeneration. It contradicts the PO request that the hunter be hurt and rapidly recover. Positive-damage recovery remains unverified. Driver also flagged the Mega stationary for about five seconds at 3.2 metres; candidate observation requiring independent review. Knife, molotov, systematic crops sweep and full arsenal LOW tests remain open. Receipt: `test-results/s88-b90high/low-z1-l10/`. No check is running.

## HIGH combat ledger cross-check

Existing HIGH z1 early-route ledger also confirms four `weapon.fire-axe` combat.hit events against the 3000-HP hunting Mega, at ticks 3967, 4027, 4057 and 4087; all amount 0. Combined with seven LOW zero-damage contact events, the P2 damage failure is reproduced at both tiers. This is actual hit evidence; positive-damage regeneration remains unverified. Contact sheet refreshed to six previously opened frames covering L7 overlap, L8 post-count stall, L9 restart, HIGH/LOW rifle selection and molotov exhaustion restoration.

## L10 HIGH zoom 1.5 — five-minute route

Normal continue path; camera telemetry explicitly reports zoom 1.5 and targetZoom 1.5 with quality HIGH. Completed bounded 300-second sample, two deaths, zero assists/skips, 115 axe attacks. Three no-progress warnings occurred while moving through the farm route (maximum 44.17 seconds), so they require marker/navigation review rather than automatic adoption as P2 game defects. Opened final checkpoint-yield capture shows full-health courier, nearby infected, axe selected, machete and molotov present in toolbar, objective 768 m away. Hangar was not reached. No systematic road-crop inspection completed.

The route ledger records **four more actual axe hits for amount 0** on the 3000-HP early Mega. Thus zero-damage axe contacts reproduce at HIGH z1, HIGH z1.5 and LOW z1. Positive damage/rapid recovery still fails to be demonstrated. Contact sheet refreshed and opened as a single six-panel artifact using previously inspected source frames. No check is running.

## L9 HIGH zoom 1.5

Same pre-rail checkpoint, HIGH and camera zoom/targetZoom 1.5 verified. Completed through L10 loading in 158 wall seconds, zero deaths, assists or skips; no manual hatch override. Opened `campaign-L9-t2764.jpg` (post-rail driving / boarder instruction) and `campaign-L9-t5465.jpg` (final bay, 4/4 at trucks, hatch defense 5 seconds). No crossing/final-bay block reproduced. Playable L10 pose and school-bus overlap remain unverified; the session exits at level change. Summary simSeconds=-1 is invalid due to handover tick reset. Receipt: `test-results/s88-b90high/high-z1-5-l9-rail/`. No check is running.

## Uninterrupted L9-to-playable-L10 handover

First dedicated pre-rail attempt stopped at a four-minute cap near the bridge; unrelated opt-in L8 calm-audit assertion also failed, so that attempt did not verify pose. Then loaded existing `l9-at-bridge` save (evacuation already done) and used real-input continue mode without restarting L10. L9 completed in 25 seconds, zero driver issues/skips. Handover log records first playable L10 objective “Get away from the river · 101 m”. Opened `test-results/s88-b90high/high-z1-5-bridge-handover/captures/continue-L9-L9-L10-actual-handover-high-z1-5.jpg`: upright courier holding axe, corgi alongside, normal objective/radio HUD. **Folded pose did not reproduce in this HIGH zoom-1.5 bridge-save handover.** Earlier rail traversal was separately qualified; this does not claim a single continuous full L9 run from its start. LOW zoom-1 handover and school-bus overlap remain open. No check is running.

## LOW returned-arsenal attempt — partial only

Existing dispersal-console fixture, 120-second bounded session. Ten toolbar commands through machete were acknowledged in the manual-input log before closure. The fast selection sampler produced stale selected-weapon observations for several entries (e.g. bat→launcher and machete→nail gun); these mismatches do not prove selection failure and are excluded from pass/fail conclusions. Last four commands arrived after closure and are excluded. The raw `selection-receipt.json` therefore must not be read as a 14-weapon pass. No LOW molotov exhaustion test was completed. Receipt directory: `test-results/s88-b90high/l10-arsenal-low/`. No check or controller remains running.

## LOW returned arsenal — completed click sequence

Second LOW dispersal-checkpoint input sequence started immediately after run initialization. `test-results/s88-b90high/l10-low-input-final/input-receipt.json` confirms selected state for all 14 requested toolbar clicks. This supersedes the earlier stale/partial click sample. The initial three rapid molotov attack inputs did not empty charges; a later spaced sequence did. At tick 2400 molotov is in emptyWeapons and selection is army MG. Normal driver combat resumed between the two throw sequences, so this does not qualify as an uninterrupted rifle-return test. Opened `campaign-molotov-spaced-2.jpg`: Machine Gun selected and molotov empty; no automatic axe return in that frame. LOW key coverage and exact preceding-weapon tracking remain incomplete. Bounded session ended after 120 seconds without driver issues or skips. No check or controller is running.
