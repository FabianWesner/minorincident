# s59-apcvisual — APC render fixes

## Changes

- `Blasts` now draws flame cards before transparent cab glass (`renderOrder = -1`). The pooled cards retain depth testing, so opaque APC hull panels reject flames behind them; the later windshield draw overlays flames behind the glass. This changes ordering only and adds no draw call.
- `VehicleView` now terrain-fits only tyres with Rapier contact in the current or previous physics tick. Unsupported wheels keep their suspension pose through ramp airtime instead of being pulled down to terrain below the APC.

## Source review

- `veh.military-apc.unarmed.glb` and its LOD1/LOD2 counterparts all retain the six named wheel pivots and their wheel meshes. The render path has no visibility toggle for them. `VehicleView` did, however, ground-fit all six wheel pivots unconditionally while a ramp jump was in progress; this is the cause addressed here.
- APC hull front blood marks use the existing paint material's `bloodCoverage` shader. Staged armor dents and windshield cracks are appended to the existing `transportRoof` geometry/draw range by `ApcDamage`; neither uses an independent coplanar decal draw.
- Vehicle reveal is disabled for the ridden APC and when the courier is hidden inside it. That rules out the courier foreground outline as the source in the seated/drive case; the forced flame render order was the cab-glass ordering issue found in source.

## Verification status

- `npm run typecheck`: passed.
- `npm run lint -- --no-fix`: passed.
- `npm test`: passed, 107 tests in 27 files, 211 seconds (the suite budget is 240 seconds). The prescribed remote wrapper had no healthy remote runner, so this ran locally.
- `SCENE_PORT=4962 npm run scene:gate` remains pending. Browser captures are blocked: the shared coordinator cannot bind `127.0.0.1:4329` (`EPERM`), and the legacy headless path is stopped by `tools/mac-gpu-guard.py` because the sandbox denies `ps` (`PermissionError`).
- Before/after captures have not been opened. `tools/qa/r33-l9-ramps.ts` still needs to capture both L9 ramps at zoom 1/1.5, low/high, WebGL2/WebGPU, and be reviewed alongside the APC flame/cab matrix.

## Draw-call budget

Both changes reuse existing meshes and materials. They introduce no geometry or render objects, so the source-level draw-call delta is zero; runtime counter verification remains pending with the captures.

## Resumed capture verification

Sandbox restrictions lifted. The current high/WebGL2 `l9-apc-ram` capture passed and `test-results/s59-apcvisual/current/shot-0030.png` was opened: visible tyres are present on flat ground. Ramp, flame, roof flicker and full matrix verification remain outstanding.

The full high/WebGL2 r33 ramp tool completed with zero page errors. Opened `ramps-after-high-webgl2/overpass-air-z1.5.png`: middle/rear tyres remain visible, but front tyres still disappear into the ramp, so the wheel fix is incomplete. The rear roof bracket/red lamp is clearly identifiable in this frame. Further work is required.

Found a separate roof depth defect: `transportRoof` inherited transparent glass material with depth writes disabled despite opacity one. The APC roof now uses an opaque clone with depth writes enabled, retaining the existing mesh/draw. Typecheck passed after this change. Flame captures remain outstanding.

Ramp diagnostics proved the front wheel pivots were lowered to local Y -1.419 with contactOffset -2.058 m while Rapier reported ramp contact. The final terrain contact solver now resolves penetration only; it no longer lowers tyres toward sampled road beneath an elevated ramp. Runtime re-capture remains required. The r33 tool now records physics wheel contact/suspension and render wheel positions/correction offsets for direct diagnosis.
