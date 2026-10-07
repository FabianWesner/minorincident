# Arrival and bicycle PO fixes

## Commits

- `68764147`: navigation/arrival, full pavement placement and surface metadata, simulation/asset guards.
- `ac9ab9ed`: rider frame binding, runtime measurements and browser regressions.
- `995ca225`: resting contact correction noise and corrected measurement fixtures.
- `12a9a0a7`: remount eligibility outside garage approach margins.
- `81cf5809`, `cf7c5b82`, `9509af7e`, `9eb83d93`: real touch input, mission start, rendered approach and per-frame saddle guards.
- `9ecfea8b`, `bbd2ec75`, `562cf4f6`: existing lock fixes cherry-picked from `main` for reliable shared-slot validation.

## Cause and measurements

The parked bicycle supplied three solid push-out circles to the player controller, but was absent from navigation. A click inside that frame, or a route through it, made steering continually pull the courier back into the push-out. This also alternated navigation/idle ground clearance and walk/idle animation. Existing animation hysteresis was already present; it was not the cause.

Using the original lane HEAD and the corrected code with the same blocked-target scenario, the final 180 ticks (3 seconds) measured:

| Measurement | Before | After |
| --- | ---: | ---: |
| X position range | 64.522 mm | 0 mm |
| Y position range | 15.002 mm | 0 mm |
| Z position range | 0 mm | 0 mm |
| Yaw range | 17.979 degrees | 0 degrees |
| Total position travel / second | 1.012 m/s | 0 m/s |
| Maximum reported horizontal speed | 0.923 m/s | 0 m/s |
| Animation states | walk, idle | idle |
| Latched target | present | cleared |

Small before/after frame traces are in `test-results/arrive-jitter/`. The temporary baseline source checkout was deleted after measurement.

The curb regression also exposed resting Rapier skin-contact corrections: up to 1.216 mm/s of vertical travel with zero horizontal velocity. The controller suppresses corrections below 0.1 mm when there is no movement intent, horizontal displacement or appreciable horizontal velocity. Falls, steps and pushes remain active. All three arrival simulation guards then passed the 1 mm/s bound.

## Changes

- Register the parked frame with navigation, resolve destinations outside its capsule clearance, and stop locomotion when reaching the arrival radius. Clearing the target also removes its ring.
- Validate parking and mounting against the full toy-scale bike footprint, wheel/frame margins within one sidewalk polygon, equal paving height, navigation clearance and Rapier collider overlap. Search nearby level pavement for start/depot/automatic parking; retain the last safe parked position if no local spot is available.
- Export surface top heights from Blender layout metadata. D-GROVE's existing 299 surface records now include those heights; geometry and GLB files are unchanged. The bike uses this height rather than assuming pavement is at zero.
- Use the bike's current yaw and lean directly for mounted rider orientation. Update the bike once per rendered frame, and refresh skinned cached rider orientation/seat placement on fractional render frames.
- Include bicycle availability in the ACTION interaction check. The bat objective releases its story lock normally; the touch ACTION button ignored bicycles and remained disabled. Returning from the garage also stopped 1.32 m from the bike outside the actual garage polygon, but inside its 0.6 m approach margin. Allow that outside approach to mount; the full mounted frame must still pass the safe placement check. Mounting inside the building remains disallowed.
- Add simulation guards for arrival, start/depot/road parking, rack mounting and bat pickup followed by walking back, remounting and riding 30 m. Browser guards cover rigid/skinned arrival and frame-by-frame turn alignment, plus touch ACTION after the bat.

## Corgi scale

Loaded GLB world heights are 0.953 m for the corgi and 1.455 m for the courier (ratio 0.655). Both match their asset manifest dimensions, and no corgi runtime scale multiplier is applied. E08 specifies the character reference and required nodes rather than a numerical corgi height. Runtime scale was not changed; changing the authored proportions is an art decision.

## Validation

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run build`: pass.
- `sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2`: 257 passed across 78 files.
- `sh tools/sim-lock.sh npx vitest run tests/sim/l1-toys.test.ts tests/sim/arrival-stability.test.ts tests/sim/bicycle-pavement.test.ts tests/sim/controls.test.ts --maxWorkers=2 --reporter=default --reporter=json --outputFile=test-results/arrive-jitter/targeted-sim-ready.json`: 23 passed across 4 files.
- `E2E_PORT=3347 npm run test:smoke`: 5 unit smoke tests passed (648 skipped), 22 browser smoke tests passed across Chromium, mobile Chromium and WebKit.
- `E2E_PORT=3348 sh tools/e2e-lock.sh npx playwright test tests/e2e/arrival-stability.spec.ts tests/e2e/bicycle-stability.spec.ts tests/e2e/bicycle.spec.ts tests/e2e/controls-playtest.spec.ts --project=chromium --workers=2`: 8 passed.
- `E2E_PORT=3348 sh tools/e2e-lock.sh npx playwright test tests/e2e/bicycle-stability.spec.ts --project=chromium --workers=2`: 3 passed after adding saddle alignment assertions for every fixed/live frame.
- `E2E_PORT=3349 sh tools/e2e-lock.sh npx playwright test tests/e2e/arrival-stability.spec.ts --project=chromium --workers=2`: 2 passed; retained the complete arrival recordings separately from the bike rerun's output directory.

Validation uses the existing shared locks. Cherry-picked `main`'s re-entrancy/queue fixes (`ce1fd5a1`, `5ee85ee9`, `2bc1aa8c`) after polling browser runs repeatedly starved behind queued runs. No additional slots or unlocked browser runs were used; npm smoke uses its own internal lock.

Earlier validation caught and corrected: missing Y in the bike-view unit mock; residual Rapier resting correction; a steering measurement fixture that drove into Grove props; the garage approach-margin remount rejection; test input injection masking real touch; and new browser fixtures leaving the briefing open. The arrival fixture now renders every approach tick and completes the normal stop blend before recording; skipping 300 sim ticks in one render otherwise gives the animation mixer an averaged displacement after the sim has already stopped.

The rider turn measurement passed for both rigid and skinned couriers: 89.419 degrees of yaw change, maximum rider/bike frame mismatch below 0.000004 degrees over 180 fixed frames and 145–158 live frames. Pelvis/saddle position mismatch (including the authored -0.04 m seated offset) was below 1e-12 m in the recorded turn frames.

Both courier variants at both arrival locations measured 0 mm/s accumulated drift, zero horizontal velocity, zero yaw range, only idle animation/clip, and no visible target marker over 180 fixed frames plus 3 seconds of live render frames. Small frame recordings are retained in `test-results/arrive-jitter/evidence/`; no videos were created.

Removed the temporary baseline source checkout, measurement scripts, resolved failure trace archives and the 147 MB preview build after validation. Tracked test artifacts from unrelated epics were restored.

## Scope and remaining behavior

No specification files changed. The PO's parking add-ons supersede E19 §5.10's literal "stays exactly where dismounted" wording: dismounting in the street now parks on nearby clear pavement. The proposed criterion is "persists at its safe parking position after dismount." Infected contact still intentionally dismounts the rider; the bat/remount travel regression isolates that rule by removing infected after the weapon objective. The parking search extends to 8 m and falls back to the last safe parking location when nearby pavement is obstructed. No merge, push or deployment was performed.
