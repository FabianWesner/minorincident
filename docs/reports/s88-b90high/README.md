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
