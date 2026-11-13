# s92 — L9 leaper foot contacts

`npm run qa:vehicle-campaign-motion` passes all eight HIGH/LOW windows on the retained runtime. Root fix: `281265e7`. Collision coverage fixture: `7a71f8af`. Nothing was deployed or pushed.

## Runtime cause and fix

Infected 882 is a leaper. Its stationary half-crouch uses the `alpha-pounce` pose atlas at phase 0.22 even when no special is active. A one-tick stop bypassed the standing contact solver; returning to shamble moved the planted sole. `CrowdView` now selects standing contact policy for that idle stance, while retaining the authored pose. `CrowdLocomotion` accepts that contact policy independently of the pose atlas. Active pounces retain their action policy.

The native HIGH receipt before any QA coverage changes reduced maximum slide from 22.1 cm to 1.8 cm, p95 from 1.5 cm to 1.3 cm, and 882's separation-window maximum to 0.2 cm. Every measured row passed. That run still failed the missing collision coverage requirement, preserved in [isolated runtime evidence](focused-high.json). The runtime fix therefore precedes and is independently measured from the later fixture addition.

No infected stats, corpse lifecycle, limits, row exclusions, threat tools, specs or protected reference assets changed.

## Collision recovery coverage

Both native tier routes produced no final-commit collision correction windows. Diagnostic observers of solid sweeps, navigation and parked-hull projection also found none; those experiments were removed.

The gate now adds one normally spawned sprinter at frame 8970, after the original 882 observation window. It finds a clear nose/rear hull boundary using the actor's unchanged radius, then proposes an 8 cm inward move from 5 cm outside the boundary on the next tick. The real final collision commit resolves the resulting small penetration. Nose/rear placement avoids the normal side-boarding rule. The fixture is explicitly identified in each receipt. Every native and added motion row retains the existing checks and limits; no corpse is deleted. [Both-tier correction receipts](collision-coverage.json).

## Final matrix

Limits remain p95 ≤5 cm and maximum ≤15 cm. All correction windows pass, with both correction kinds proven in L9. All runtime source hashes match, source stability is true, and browser error arrays are empty.

| Case | HIGH max / p95 cm | LOW max / p95 cm |
| --- | --- | --- |
| L9 | 1.8 / 1.3 | 1.2 / 1.0 |
| L7 bus | 0.5 / 0.4 | 0.5 / 0.3 |
| L4 parked | 1.7 / 0.9 | 2.1 / 1.6 |
| L4 tank | 2.6 / 1.8 | 6.4 / 2.0 |

[Final matrix and correction rows](final-matrix.json). Reproduce with `SCENE_PORT=4992 npm run qa:vehicle-campaign-motion`. The run uses the shared headless browser pool through `tools/e2e-lock.sh`, sequentially in one ten-minute reservation.

## Opened visual evidence and the 318 cm lift

Opened [the targeted sheet](leaper-flight-and-stance.jpg). Frames 6187–6191 show 882 horizontal in a stretched leap, with its legs and soles suspended above the terrain. Frame 6188 has active `alpha.pounce`, phase 0.72, and both rendered soles above 3.1 m; the maximum sole lift is 3.18 m. This is an airborne pounce, not a grounded ragdoll or get-up pose. Frames 7505–7509 show the grounded stance/crouch transition: the visible support foot remains at the same ground location without the former abrupt snap. The first cell of each capture window still shows the following camera as the target camera takes effect; those cells do not establish the pose review.

The track labelled `grounded` aggregates flight and later walking contacts. Its label means that the track contains measured grounded contacts; it does not classify every constituent frame as grounded. The lift maximum reports the genuine airborne pounce within that mixed track. No classifier or airborne exclusion was changed. [Rendered sole coordinates, clip/action identity and camera poses](visual-proof.json).

The targeted visual-only run centers the camera on entity 882 at frames 6186–6191 and 7504–7509 using `api.camera.cinematic`, with position `actor + [10,8,10]`, target at the actor, then restores follow. It writes to a separate directory and stops at frame 7510. Its expected nonzero gate status (no late collision fixture) is not used as acceptance evidence. The complete native-camera gate above supplies acceptance.

## Validation

- Full campaign motion gate: exit 0, eight windows, unchanged limits.
- Typecheck and lint: exit 0.
- Full remote `sh tools/remote/run.sh "$PWD" -- npm test`: exit 0, 106 passed / 1 skipped, 211.7 s within 240 s. An earlier repeat timed out and was rerun without trimming tests.
- L9 threat audit: zero skilled and passive per-level flags. Single-level invocation exits 1 solely for `PARTIAL_LEVEL_SELECTION`; this is not claimed as a full-campaign threat pass.
- Opened targeted visual sheet and reviewed flight/standing poses as described above.

[Validation receipt](validation.json). Raw logs remain under `/private/tmp/s92-complete-matrix.log`, `/private/tmp/s92-complete-unit.log`, `/private/tmp/s92-threat.log` and `/private/tmp/s92-target.log`. Raw native receipts are in `test-results/s83-vehicleslide/campaign/`; targeted visual-only output is in `test-results/s92-l9slide/visual/`.
