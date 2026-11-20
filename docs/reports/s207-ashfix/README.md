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
