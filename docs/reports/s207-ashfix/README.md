# s207 — ash heap appearance fix

## Change

The fire heap and bone instance batches in `src/render/CrowdView.ts` now use `MeshLambertNodeMaterial`, so they take scene lighting like nearby corpses instead of staying self-lit under WebGPU or WebGL2. Settled ash clumps are dark grey with charcoal pieces, narrower across the body's width, and no more than about 10 cm high by the geometry dimensions. The two crossed bone meshes are reduced to small, dark fragments. There is no emissive material or warm coal tint.

The supplied before capture shows two bright white, broad heaps with large tan crossed bones at night. It is available at `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/po-ashheap-white.png`. I inspected it. A post-change before/after image sheet is **not available**: local Scene Lab could not start its browser pool (`listen EPERM` on loopback port 4329), and `scene:gate` also failed at `tsx` IPC startup (`listen EPERM`). I have not visually reviewed the changed look.

## Validation

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npx vitest run --project default tests/engine/combat.test.ts` — PASS, 7 tests.
- `npm test` — PASS locally, 106 tests / 27 files in 208.5 s (the 150-case budget manifest includes browser/invariant cases not exercised by this default Vitest command).
- Remote `sh tools/remote/run.sh "$PWD" -- npm test` — NOT RUN: no healthy/provisioned runner; command exited 69.
- `npm run scene:gate -- --filter 'corpse-*,alpha-hit-corpse-*'` — NOT RUN: environment rejected local IPC socket creation with `EPERM` before gate selection.
- Requested L10 night and L4/daylight views, zoom 1 and 1.5, HIGH/LOW, WebGL2/WebGPU, comparison against a normal corpse, and the before/after sheet — OPEN pending an environment that permits browser capture.

## Visual evidence

Before: the supplied PO screenshot, described above. After: not captured or reviewed. No claim of visual acceptance is made.

## Follow-up with restored browser access

The seven selected corpse, under-fire and firefighter scene-gate rows passed 7/7 across their selected WebGL2/WebGPU and HIGH/LOW configurations. The `s199-ash-heap` HIGH WebGL2 daylight fixture at zoom 1.5 passed its console and clipping checks. I inspected its settled frame: it reads as a very dark, fragmented patch, with visible smoke; the ash texture and bone fragments are hard to distinguish at this scale. This single fixture does not establish the requested night, normal-corpse comparison or full tier/backend/zoom matrix. The earlier IPC failure above describes the first attempt; browser access subsequently worked.

The remote full suite was retried after a runner became available. It exceeded the 240 s budget and exited 1; before termination Vitest reported one failure in the L1–L10 starts case in `tests/engine/save-progression.test.ts`, but the runner stopped before printing its diagnostic. This is not a green remote run. The local full suite passed as recorded above.

A [before/after sheet](before-after.jpg) now includes the PO image and four HIGH WebGL2 comparison fixture frames. The L4 daylight and L10-night lighting fixtures both pass at zoom 1 and 1.5. I inspected all four settled frames: the ash is darker than the ground and smaller than the normal corpse, but appears as separate black fragments rather than a continuous grey pile; individual bones are not distinguishable. Smoke is visible. This is an isolated asphalt fixture with L10 lighting, not the specified L10 checkpoint; the other tier/backend views and actual location remain open. An initial attempt used an invalid `L10` preset; it was corrected to `L10-night` for these captures.

## Latest revision

`b6e003f1` lowers and overlaps the clumps and lightens their grey. Typecheck, lint and all seven focused combat tests pass on this revision. The updated sheet shows the PO before and current HIGH WebGL2 zoom 1 fixture frames. Both L4 and L10-night lighting fixture checks pass. I inspected both: the pile now reads as a continuous flat dark patch with smoke, considerably smaller than the normal corpse. In daylight it is dark grey; at night it is nearly black. Bones and ash texture remain difficult to discern. The actual L10 checkpoint, other zoom/tier/backend combinations, current-revision scene gate and green remote suite remain open. Earlier captures and gate results above precede this revision.

Current-revision validation: the seven selected corpse/fire scene-gate rows pass 7/7. Remote `npm test` timed out at 240.4 s without a reported failure; the previously failing save-progression case passed in this retry. Per the timeout fallback, local `npm test` passed 106 tests in 225.5 s and remote `tests/engine/l4-contact.test.ts` passed in 220.94 s. The complete remote suite did not finish green.

Additional current-revision isolated comparison captures: HIGH WebGPU, LOW WebGL2 and LOW WebGPU each passed all four fixture checks (L4 and L10-night lighting, zoom 1 and 1.5). I inspected all 12 settled frames together: each shows a compact dark patch beside the normal corpse; the night patch is almost black, the daylight patch dark grey, with smoke visible. At zoom 1.5 the pile is smaller on screen, and neither ash texture nor bone fragments is identifiable. These are lighting fixtures, not the specified L10 checkpoint. HIGH WebGL2 zoom 1.5 on the latest revision and actual checkpoint captures remain open.

The remaining HIGH WebGL2 zoom 1.5 L4 and L10-night fixtures pass. I inspected both: the small flat patch is dark grey in L4 and nearly black in night lighting, with smoke; fragments are not individually readable. A HIGH WebGPU district fixture at the supplied coordinates also passes and was inspected: the heap is a very dark patch against the dark ground, with smoke and a normal corpse nearby. This fixture did not restore the actual checkpoint: Scene Lab rejected `cure-pace-15` as unknown, so the checkpoint-specific state remains unverified. The location fixture is at zoom 1; the requested checkpoint and zoom 1.5 location review remain open.

The HIGH WebGPU district fixture at the supplied coordinates also passed at zoom 1.5. I inspected the settled frame: the heap is a small, nearly black patch with smoke beside the normal corpse; its texture and fragments are not discernible. This is still a constructed district fixture, not a restored `cure-pace-15` save. The checkpoint name appears in historical save evidence but is not a literal in the current source or test fixtures searched; Scene Lab's direct checkpoint loader rejected it. The actual checkpoint state remains open.

Checkpoint investigation: `cure-pace-15` is generated by `curePaceCheckpoints` in `src/levels/L10/mission.ts`; the earlier literal search missed this generated name. The cropped district fixture does not supply the checkpoint to Scene Lab's loader. A trial without the crop failed because the player start was outside the resulting composition bounds. Neither attempt proves the real saved checkpoint state.

Further investigation explains the loader failure: `Mission.loadCheckpoint` reconstructs checkpoints by completing authored objectives, whereas pace checkpoints are created dynamically by the movement controller. The direct Scene Lab loader therefore cannot reconstruct `cure-pace-15` merely from its name; a captured native resume or a route run is needed to verify that saved state.

A native complete-policy L10 route was run with `node --import tsx tools/qa/make-checkpoint.ts --out /tmp/s207-native-saves --what l10 --max-l10 1800`. It exited successfully after writing ten saves through `cure-pace-3`; it did not reach `cure-pace-15`. The requested real checkpoint capture therefore remains open. Generated saves are temporary and were not committed.

The sheet now includes both L10-coordinate fixture zooms as well as the daylight comparison. The route generator's manifest shows the last pace checkpoint at tick 7,321, with a live save at tick 8,521; the configured 1,800 simulated seconds ended without another checkpoint. A longer native route or an appropriate captured resume is needed to reproduce the actual pace-15 state.

A second unchanged native route with `--max-l10 3600` also completed with only the same ten saves through pace-3; increasing the duration did not produce the requested resume. The pace-15 checkpoint remains unverified.

A seed-327 native route succeeded where seed 1 stalled: `make-checkpoint.ts --what l10 --seed 327 --max-l10 1800` produced `l10-22-cure-pace-15.json.gz` and its live counterpart under `/tmp/s207-native-seed327`. The route ran to completion and wrote 49 saves. These temporary native saves provide a route-derived state for a follow-up capture; the earlier constructed location views did not use them.

Native state review: the seed-327 `cure-pace-15` campaign save was restored, the player was teleported to the PO coordinates, and a controlled runner was killed by flamethrower nearby (spawn used `offNav` because normal spawning was rejected). HIGH WebGPU captures at zoom 1 and 1.5 passed with no console errors; the runtime reported checkpoint `cure-pace-15` and `ashDeath: true`. I inspected both: the heap is a small near-black patch against the dark ground, with no white mound; at zoom 1.5 it is barely legible, and bone fragments and ash texture cannot be identified. The intended normal corpse was also spawned but is not clearly distinguishable in these frames, so the earlier isolated corpse comparison is the reliable comparison. The restored save and controlled death are not the original PO's two heaps. The sheet now shows these native-state frames. Visual acceptance of the requested grey ash texture remains open.

Latest color revision: the central lit clumps were lightened to improve grey separation, while edges and char remain dark. HIGH WebGL2 zoom 1 isolated L4 and L10-night fixtures pass; I inspected both. Daylight shows a muted grey patch and the night version remains very dark relative to its ground. Fine ash texture and bones remain difficult to see at game scale. Typecheck, lint and seven focused combat tests pass. The earlier native checkpoint captures, remaining tier/backend matrix, scene gate and full-suite fallback predate this color change and must be repeated for current-revision evidence.

On the lighter color revision, the selected corpse/fire scene gate passes 7/7. Remote `npm test` passes: 27 files, 105 tests passed and one skipped, 200.5 s within the 240 s budget. The remaining visual matrix and native checkpoint images still predate this color revision.
