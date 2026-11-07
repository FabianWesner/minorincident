# r4-bus — evacuation coach passengers

## Result

Every healthy story EVAC coach was audited in its registered production level. Occupied coaches show seated people at the game's camera angle at zoom 0.5, 1 and 1.5, on WebGL2 and WebGPU, low and high quality. Boarding increases the visible roster; departure retains it; unloading removes it. The exact level in the original PO crop remains unconfirmed (details below).

| Level | Coaches | Story state and verified presentation |
| --- | ---: | --- |
| L3 | 2 | Six seated civilians each, retained in both quality tiers. Also verified against the deployed public production bundle. |
| L4 | 2 | Six each on low / twelve each on high during convoy travel; zero after actual unloading. |
| L7 | 1 | Actual boarding: 0 → 1 → 6 → 12 → 24; all 24 retained during departure. Repeated with a 35-person carried-roster capacity case. |
| L8 | 1 | Correctly empty: the carried group has already unloaded. Audit confirms roster actors are outside and unhidden. |
| D-CURE layout | 12 placements | Burned EVAC wrecks; no aboard story population. |

## Cause and changes

L4/L7 buses are scripted `setpiece` entities rendered by `EntityAssets`, not drivable `VehicleView` vehicles. Their story rosters never created seated render copies. `EntityAssets` now loads existing `VehicleOccupant` models for those identities, attaches them to the active coach LOD and follows the hull's interpolated transform. Copies appear only for living, hidden aboard actors and disappear when those actors unload. Copies are owned and disposed with the renderer. No simulation actors, mission rules or RNG changed.

The implementation retains seated poses between chassis updates, fits larger carried rosters within the cabin and fills the near central window first. Visual review caught a one-passenger failure that copy counting missed: the original far rear seat could hide the passenger completely. The first passenger is now visible through the near window at normal and close zoom.

L3 keeps its existing six-person `VehicleOccupant` presentation per coach and separate glazing. The PO checklist now includes “every evacuation bus shows passengers when people are aboard.” No specifications or acceptance thresholds were edited.

Game commits:

- `3c4d4f46` — story passenger rendering.
- `8b28536b` — larger roster cabin bounds.
- `f202926f` — retain seated poses.
- `a4e85cf1` — visible first seat.

## Opened capture evidence

Final game source: `a4e85cf1`. Production QA build: `NODE_ENV=production VITE_QA_HOOKS=1`, entry `dist/build/index-DocG40-1.js`. Captures use headless Chrome, Metal, 1280×720, DPR 1. Each receipt asserts the **actual** backend and render tier; URL settings alone are insufficient because persisted settings can override them.

The final audit produced **228 matrix PNGs** across four renderer/quality cells and the additional 35-person cases, plus eight departure frames. I opened all four `occupied-sheet.jpg`, all four `lifecycle-sheet.jpg`, all four `capacity-sheet.jpg`, and `native-departure-sheet.jpg`. At zoom 1 and the wider 1.5 view, occupied cabins read as occupied; close zoom 0.5 shows seated torsos and bent legs through the windows. Roofs and pillars naturally obscure parts of heads. Empty and unloaded states show the blue seats without people. The first passenger is visible in the central near-side window in every matrix cell; the 35-person case remains inside the cabin.

Final artifact directories under `test-results/r4-bus/`:

- `{webgl2,webgpu}-{low,high}/`: full levels, receipts and occupied/lifecycle sheets.
- `roster-35-{webgl2,webgpu}-{low,high}/`: capacity receipts and sheets.
- `prod-l3-{low,high}-bus{0,1}-z{0.5,1,1.5}.png`: twelve public production captures, opened through `prod-l3-sheet.jpg` and individual close views. Both coaches visibly contain people; the story banner partly covers the lower cabin.
- `before-after.jpg`: the sole committed image (112 KiB). Top: disabled L4 passenger presentation versus six passengers. Bottom: one copy in the hidden old seat versus the fixed near-window seat. These are labelled diagnostic controls, not claimed as original deployment captures.

[evidence.json](evidence.json) records SHA-256 hashes, capture identities, cameras, counts, actual renderer/quality and pixel checks. Earlier scratch captures are deliberately excluded: initial L3 frames targeted pre-offset coordinates, and early runs could inherit persisted quality. Only final matrix directories above count as proof.

The public production probe used `/build/index-DkTUBysS.js` from `https://minor-incident.com`. It exposed the existing Game instance and initialization completion in the local browser response only; rendering and mission code were unchanged, with no remote writes. Chrome selected **WebGPU**, so this public evidence is not claimed as WebGL2. Both actual low/high tiers report twelve L3 passenger copies and no console errors. Local production QA captures cover both backends.

## Automated guard and checks

`npm run qa:evac-buses` builds the production QA bundle and runs real registered levels through the existing headless SceneSession infrastructure. Examples:

```sh
REVIEW_BACKEND=webgl2 REVIEW_TIER=low npm run qa:evac-buses
REVIEW_BACKEND=webgpu REVIEW_TIER=high REVIEW_LEVELS=L7 REVIEW_ROSTER=35 npm run qa:evac-buses
```

The audit asserts visible copy counts, cabin positions, unloading, actual boarding/departure state, actual backend/tier and zero console errors. For one passenger it compares the same paused canvas frame with that copy shown/hidden, in a region around the seated body. Required area is `100 / zoom²` pixels with a channel difference greater than 12/255, which includes dark clothes at night. Final normal-zoom first-passenger results are 740 / 599 / 746 / 586 pixels (WebGL2 low/high, WebGPU low/high).

Both deliberate regression controls fail as required:

- `EVAC_NEGATIVE=1`: disable passenger presentation; count assertion fails with 0 versus 6 (`count-negative-final.log`).
- `EVAC_OCCLUDED=1 REVIEW_LEVELS=L7 REVIEW_ROSTER=35`: restore the old far rear seat; visibility assertion fails with **zero** passenger pixels (`pixel-negative-12.log`).

The audit relocates the courier/group to the authored boarding queue, enables god mode and clears L7 infected to isolate presentation, then steps the production boarding simulation. The extra eleven capacity actors use the existing survivor machinery. This is a rendering/lifecycle audit, not a full-route completion claim.

Required final checks:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `sh tools/perf/quiet-run.sh npm test` — **107/107**, 27 files, 25.7 seconds. An earlier contended run exceeded the gate-tools case's 30-second timeout; the quiet rerun passed with the original timeout unchanged (`final-unit-quiet.log`).
- `SCENE_SERVER=preview SCENE_PORT=3368 npm run scene:gate -- --jobs 1 --out test-results/r4-bus/scene-gate-final` — **50/50**, zero known failures, zero skipped, 7.5 minutes.
- Final eight passenger audit cells — passed, 228/228 matrix captures, zero console errors.
- Production QA build and `git diff --check` — passed.

## Original PO image attribution and limits

`epics-pipeline/po-findings/1107-empty-bus.webp` shows the healthy base EVAC model, visible empty seats, lit frontage and a lamp. Its exact level/scene could not be uniquely established from the crop. A level/URL clarification was requested; no answer arrived during the work. An earlier working assumption of L3 was withdrawn because the current checkpoint surroundings do not establish a match. The current public bundle already contains the r3 L3 passenger path and lacks the new scripted L4/L7 presentation path. The implementation therefore audits every candidate story coach rather than relying on that unproven attribution.

No push or deployment was performed. Images remain under `test-results/`; only the small before/after sheet is committed.
