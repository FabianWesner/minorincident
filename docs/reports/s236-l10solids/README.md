# s236 L10 building solids

## Changes

Farm house and barn ruin collision now comes from the structural mesh parts, transformed by the placement position, yaw, and scale. This keeps visible door and collapsed-wall openings while blocking the visible wall sections. The farm placement helper uses the same source geometry. Destructible structure walls are restored to the active navigation/combat wall set after chunk residency refresh; before this change, the refresh discarded them and a courier sweep could pass through the house after activation.

See-through selection for buildings now tests the camera-to-subject centre segment, avoiding false occlusion from a generous subject-box corner. Selected buildings use a shared ordered-noise dissolve across their instanced wall and roof surfaces, so the roof does not remain as a lone slab.

## Sweep audit

`tools/qa/building-wall-sweep-audit.ts` is wired into `tools/qa/solid-placement-audit.ts`. It sampled 664 building placements across L1–L10 with 9,760 capsule sweeps. L10: 242 buildings, 1,958 samples, zero misses. The existing solid placement portion reports 572 before and zero after across all district datasets.

Coverage limitation: the sweep samples existing collider faces, not independently extracted visible mesh wall faces. It can catch colliders lost at runtime and placements with no body-height collider, but cannot detect a missing wall on a building that has other colliders. An independent mesh-face audit remains open. The five known misses below are ratcheted: any additional reported miss fails the audit.

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
- `sh tools/remote/run.sh "$PWD" -- npm test`: unavailable; no healthy Hetzner runner and the configured Mac slot rejects the full suite.
- Focused scene gate and native HIGH/LOW captures: unavailable; browser-pool startup failed with `EPERM` binding its local listener / registering the browser process. No captures were produced or reviewed.
- On a subsequent unrestricted run, the focused `l10-d2-military-breach@low-z0.5` scene row passed. The requested camera captures and other scene rows remain open.
- `tools/qa/eg-l10-farm.ts`: fails an existing crop-spacing assertion (`farmLaneDistance >= 11`); this is outside the wall collision change.

Visual inspection of the barn wall/door and the reported see-through camera spot remains open. The opaque instanced dissolve and the collision sweeps are mechanically audited, but the requested HIGH/LOW native game-camera review still needs a working browser pool.
