# s236 L10 building solids

## Changes

Farm house and barn ruin collision now uses the authored structural part bounds, transformed by the placement position, yaw, and scale. These bounds approximate the building generator's walls and door gaps; their match to every visible opening has not yet been independently verified. The farm placement helper uses the same bounds. Destructible structure walls are restored to the active navigation/combat wall set after chunk residency refresh; before this change, the refresh discarded them and a courier sweep could pass through the house after activation.

See-through selection for buildings now tests the camera-to-subject centre segment, avoiding false occlusion from a generous subject-box corner. Selected buildings use a shared ordered-noise dissolve across their instanced wall and roof surfaces, so the roof does not remain as a lone slab.

## Sweep audit

`tools/qa/building-wall-sweep-audit.ts` is wired into `tools/qa/solid-placement-audit.ts`. It sampled 664 building placements across L1–L10 with 9,760 capsule sweeps. L10: 242 buildings, 1,958 samples, zero misses. The existing solid placement portion reports 572 before and zero after across all district datasets.

Coverage limitation: the sweep samples existing collider faces, not independently extracted visible mesh wall faces. It can catch colliders lost at runtime and placements with no body-height collider, but cannot detect a missing wall on a building that has other colliders. An independent mesh-face audit remains open. The five known misses below are ratcheted: any additional reported miss fails the audit.

The farm generator specifies solid 0.18 m side walls, split 0.18 m gable piers, and 2.2 m high door openings. The authored part bounds were tightened to those dimensions; destruction adds its existing 0.035 m hit-zone margin. Typecheck, lint, and the ratcheted sweep audit pass after this correction. This generator comparison is not a substitute for the all-district mesh-face audit or movement captures.

Five non-L10 samples remain for follow-up because those placements have no collider intersecting courier body height:

- L3 D-CORRIDOR `bld.river-bridge` placement 893
- L4 D-FAIR `bld.garage-detached` placements 644 and 652
- L4 D-FAIR `bld.shed` placement 748
- L6 D-SUBWAY `l6-36`

L5 has no `bld.*` placements in the runner level data. L1, L2, L7, L8, and L9 had no misses.

## Verification

- `npm run typecheck`: pass
- `npm run lint`: pass
- `node --import tsx/esm tools/qa/solid-placement-audit.ts --out /private/tmp/s236-solid-sweep-final.json`: pass; L10 sweep misses zero
- `npm run qa:threat`: did not finish; test budget stopped it at 600 seconds while scenarios were still running. L10 skilled stage completed in 122.321 seconds.
- A subsequent remote `qa:threat` also exceeded its 600-second budget under runner load; it did not produce an aggregate verdict. L10 skilled started shortly before the timeout.
- `sh tools/remote/run.sh "$PWD" -- npm test`: unavailable; no healthy Hetzner runner and the configured Mac slot rejects the full suite.
- Subsequent full remote `npm test` passed: 27 files, 105 tests passed, one skipped, 213.5 seconds within the 240-second budget.
- After tightening farm bounds, the first remote unit run timed out at 240 seconds; the required unchanged retry passed 27 files, 105 tests with one skipped, in 236.2 seconds.
- Focused scene gate and native HIGH/LOW captures: unavailable; browser-pool startup failed with `EPERM` binding its local listener / registering the browser process. No captures were produced or reviewed.
- On a subsequent unrestricted run, the focused `l10-d2-military-breach@low-z0.5` scene row passed. The requested camera captures and other scene rows remain open.
- Both curated L10 gate rows passed on a later run (`l10-d2-military-breach@low-z0.5` and `l10-mega-close-contact@low-z1.5`; `/private/tmp/s236-l10-gate-final/index.md`). Their sheets show isolated actors on plain ground, so they do not verify farm walls or building fades.
- A temporary L10 farm crop at the reported shed coordinates rendered on HIGH at zoom 0.5, 1, and 1.5 without console errors (`/private/tmp/s236-farm-high/index.md`). The inspected zoom 1 sheet shows the courier over dark ground geometry, without a readable barn wall; it is not acceptable collision or fade evidence. The temporary fixture was removed.
- Scene Lab applies `levelTenLayouts` before cropping D-CURE, and the crop includes the target coordinates and tier 0 placement. The unreadable capture therefore needs further investigation; a passing console-error check alone does not establish that the shed is visibly rendered.
- Follow-up HIGH daylight crops show that with the courier at local `[-4, 0]`, the barn fades almost completely while its shadow remains; at `[5, 5]`, the red barn is visible above the courier with its doorway and roof (`/private/tmp/s236-farm-day/` and `/private/tmp/s236-farm-front/`). Recentering alone made no visible difference. These static crops do not demonstrate walking into a wall or through its doorway, and the near-total fade merits review against the requested soft fade.
- The whole-building dissolve was subsequently reduced from 95% to 75%. In the inspected HIGH farm crop (`/private/tmp/s236-farm-soft/`), roof and walls remain visibly translucent together and the courier remains visible; the dark cast shadow remains. Both see-through fixtures pass HIGH and LOW at zoom 0.5, 1 and 1.5 (`/private/tmp/s236-see-soft/`, `/private/tmp/s236-see-soft-low/`). Typecheck and lint pass after the change.
- HIGH WebGL2 catalog: `seethrough-not-in-the-way` passed at zoom 0.5, 1, and 1.5. `seethrough-building-first-frame` failed at all three zooms: courier visible share 0.3 against 0.6 required and zero measured cut pixels. The see-through change therefore needs correction before acceptance. Results: `/private/tmp/s236-see-high/index.md`.
- After correcting shader-node selection and using a strength-controlled 95% dissolve, both HIGH scenes passed at all three zooms (`/private/tmp/s236-see-high-fix/index.md`). The zoom 1 behind-building sheet was inspected: the courier is visible on the street and the foreground facade is cleared. A LOW rerun stalled before its first row and was stopped; LOW and the requested L10 captures remain open.
- A later LOW WebGL2 retry passed both scenes at zoom 0.5, 1, and 1.5 (`/private/tmp/s236-see-low-retry/index.md`). The zoom 1 behind-building sheet was inspected: the courier is visible on the street and the foreground facade is cleared. These L4 fixtures do not replace the requested L10 captures.
- `tools/qa/eg-l10-farm.ts`: fails an existing crop-spacing assertion (`farmLaneDistance >= 11`); this is outside the wall collision change.

Visual inspection of the barn wall/door and the reported see-through camera spot remains open. The opaque instanced dissolve and the collision sweeps are mechanically audited, but the requested HIGH/LOW native game-camera review still needs a working browser pool.
