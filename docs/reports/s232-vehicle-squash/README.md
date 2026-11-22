# s232 — Vehicle zombie hits

**Status: acceptance remains open.** The isolated APC sheet below was reviewed; native L9 and L10 sequences are still required.

## Implemented

- Player-driven cars emit a positional vehicle-hit event for contact onsets. Slow contacts keep the knock-aside reaction; regular infected hit at 4 m/s and above receive a permanent vehicle kill with zero horizontal launch impulse.
- The L9 APC applies the under-hull run-over rule to ordinary infected on contact at any speed. Brute, armored, riot, elephant, Alpha, and Mega archetypes retain resistance behavior.
- L10 motorbike contact uses the same sound and damage policy at its rider contact point.
- Run-overs add a small vertical chassis impulse and camera shake. Permanent corpses retain a `squashed` marker and render as flattened ground poses; the existing kill feedback supplies the blood decal.
- The audio adapter uses a separate `vehicle-squash` bank with a wet impact and a deeper, slower run-over cue. Both use pinned CC0 Independent.nu wet squish/slurp recordings documented in `assets/audio/imports.json` and `docs/licenses/audio/8-wet-squish-slurp-impacts.json`.

## Checks

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npx vitest run tests/engine/vehicles.test.ts --maxWorkers=4 --configLoader runner` — pass (2 tests; includes the run-over corpse/event assertion).
- `npm run qa:vehicle-motion` and `npm run qa:vehicle-campaign-motion` — blocked before scene execution: browser pool failed to bind `127.0.0.1:4329` (`EPERM`).
- With full access, `E2E_PORT=5259 SCENE_PORT=5260 npm run qa:vehicle-motion` ran all HIGH scenes but exceeded its 595-second reservation before LOW. HIGH clinging, prop-momentum, prop-push and surrounded pass; push, ram, ram-survivor and reach-recovery fail their contact proofs. The ram-survivor diagnostic expects a launched living target, so its expectations need review against the new policy; the other failures also need investigation. This is not a gate pass.
- Follow-up: stationary unoccupied APC contact no longer triggers a run-over. Typecheck and lint pass. A focused `VEHICLE_MOTION_SCENE=push` run completed HIGH and LOW but both still fail the shove contact proof: this fixture drives slowly in reverse and the new APC run-over policy kills the regular targets instead. The diagnostic and intended reverse-contact behavior need resolution; this is not a pass.
- Corpse presentation follow-up: squashed corpses bypass the clear-ground vehicle avoidance search, preserving their impact position beneath the hull. Typecheck and lint pass; native visual confirmation is still required.
- Motorbike follow-up: a run-over now produces a brief visual lift and pitch. Vehicle hit audio is limited across the pack to one playback per 90 ms. Typecheck and lint pass; the visual bump and audio mix still need native review.
- Isolated Scene Lab APC capture, HIGH WebGL2 at zoom 1: [sheet](sheet.jpg), [events and corpse state](high-apc.json). Six run-over events occurred at ticks 90–100 and six marked corpses remained at tick 230. Reviewed the sheet: frames 70–100 show the APC reaching the group and blood at contact; frames 110–150 show bodies behind it. The dark, wide framing does not establish a readable under-wheel pose or bump. LOW did not complete before the 595-second reservation expired. This is not the requested native L9/L10 visual acceptance.
- `npm run qa:threat` — wrapper stopped before execution because the existing inventory is 151 cases against its 150-case cap. The unwrapped `node --import tsx/esm tools/qa/threat-audit.ts` completed in 811.4 s with 0 fail flags; skilled L9 and L10 completed. Several other passive stages ended at their tick budget, with no passive flags.
- `sh tools/remote/run.sh "$PWD" -- npm test` — no healthy remote runner is provisioned; runner reported that the Mac fallback is not eligible for this command.
- Audio bank rebuild — attempted, but source download failed under the restricted network. No new bank offsets or generated sound files were introduced.
- With network access restored, `node --import tsx/esm tools/audio/build.ts vehicle-squash` built the separate Opus and AAC bank and updated its license ledgers. Typecheck and lint pass. Audible mix review remains open.
- Remote unit follow-up: the runner is available. The initial run stopped at the 151/150 case inventory. Two related scene-gate cases were combined without dropping assertions, bringing collection to 150/150; their focused local file passes (7 tests). Two unchanged full remote attempts then reached the 240 s limit. Both reported the vehicle file passing; the first also exposed a scope error in the combined test, subsequently corrected. A full remote pass on the corrected tree remains open.

## Open acceptance

- Capture and review HIGH then LOW at zoom 1 for L9 APC and L10 motorbike (before / under / bump / squashed corpse), and add one small sheet here.
- Re-run `qa:vehicle-motion`, `qa:vehicle-campaign-motion`, and the vehicle-contact gate when the browser pool can start. Validate driving over a pile of 10+ corpses at L9 speed.
- Run the `qa:threat` wrapper after reconciling its 151/150 inventory discrepancy; the direct audit reports 0 fail flags and skilled L9/L10 complete.
- Run the remote unit suite when a runner is available.
