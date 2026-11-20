# s199 — Flamethrower ash heap

## Implementation status

Fire deaths now dissolve over the existing 90-tick (1.5 s) charred-body interval instead of disappearing at the end of a body-only shrink. Screen-door fading, a gradual sink, eight irregular instanced ash clumps, and two crossed bone meshes share the transition. The ash clumps begin grey-white with two darker charred pieces and a small warm tint that fades as the heap settles. The existing pooled VFX path emits repeated smoke puffs during the same interval. Settled heaps remain represented by the dead entity and are rebuilt in the existing ash instance batches; this adds no mesh or draw call per heap. HIGH and LOW use the same presentation and both renderer backends use the same Three.js instancing path.

## Validation

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npx vitest run --project default tests/engine/combat.test.ts` — PASS (7 tests).
- `npm test` locally — PASS (106 tests, 27 files; 150-case budget manifest, which includes non-default projects and browser cases not run by this command).
- `sh tools/remote/run.sh "$PWD" -- npm test` — PASS on retry: 105 passed, 1 skipped, 192.8 s.
- `scene:gate` filtered to the seven corpse, under-fire and firefighter rows — PASS 7/7, with the gate list's HIGH/LOW WebGL2 and WebGPU selections.
- Scene Lab capture (`s199-ash-heap`, WebGL2 HIGH, zoom 1.5) — PASS for console and clipping gates after access was restored. Visual review **fails**: the dark figure falls, then becomes a very small bright white patch; the bones and crumbling are not discernible at this scale. The 16-frame sheet is in `test-results/s199-ash-heap/high-z15/sheet.jpg`.

## Open acceptance

The latest HIGH zoom 1.5 capture shows two tan crossed bones over a lighter irregular pile with dark patches. HIGH and LOW zoom 1 on WebGL2, HIGH zoom 1.5 and LOW zoom 1 on WebGPU were also captured and personally reviewed; all four passed their scene checks. They show a similar bone-dominated silhouette over a dark, flat-looking patch, which does not yet read as grey-white ash. The crumble sequence also remains unaccepted. Refine both and repeat the visual review. Typecheck, lint, and the seven focused combat tests passed after the latest code revision.

Follow-up HIGH WebGL2 zoom 1.5: making the largest clumps pale produces a pale irregular patch and visible tan bones. The sequence still reads as a dark figure falling followed quickly by a light patch; convincing crumbling remains open. The scene checks, typecheck, lint and seven combat tests pass. The other tier/backend captures and remote suite precede this colour revision and need repeating for final acceptance.

Next HIGH WebGL2 zoom 1.5 iteration grows individual clumps and fades them from char to ash. The reviewed sequence now shows a dark fallen shape gradually becoming pale, but individual breaking pieces and smoke remain hard to discern at this scale. Visual acceptance remains open. Scene checks, typecheck, lint, and seven focused combat tests pass; other backend/tier captures and remote tests predate this change.

The next iteration enlarges pooled smoke puffs and adds short ember sparks during collapse. HIGH WebGL2 scene checks pass, but the reviewed sheet still does not clearly distinguish smoke or sparks at gameplay scale. Typecheck, lint and seven focused combat tests pass; visual acceptance and current-revision backend/tier and remote checks remain open.

Full-size frames reveal a concrete transition defect: the falling body extends to the left of the heap, which forms around the actor root. Following the corpse placement root did not fix this fixture, so that trial was discarded. The heap needs to follow the visible fallen pose or its breakup pieces, and the effects need a further readability review. HIGH WebGL2 scene checks passed for the trial; it is not part of the committed implementation.

The next iteration offsets the heap toward the centre of the fallen pose using its resting yaw. In the HIGH WebGL2 frame it overlaps the body rather than forming alongside it. The fragments still look broad and flat; visual acceptance remains open. Scene checks, typecheck, lint and seven focused combat tests pass. Other poses, tiers, backends and the remote suite need current-revision verification.

A HIGH WebGL2 trial of taller, smaller, alternately shaded clumps passed scene checks but obscured the bones, including after raising them. The trial was discarded. A different geometry or shading approach is needed to make ash texture readable without losing the bones.

An Alpha HIGH WebGL2 trial using the opposite offset implied by the prone layout did not align the visual pose: the body was left of the heap. The trial was discarded. The existing offset was reviewed only on the runner; verify or derive placement from the drawn Alpha pose before accepting it.

The committed offset was then captured on the Alpha: it overlaps the falling body, and increasing its reach from .6 to .9 m puts the heap nearer the centre of that larger silhouette in this fixture. Scene checks, typecheck, lint and seven focused combat tests pass. This does not prove every Alpha look or obstructed placement; visual acceptance and current-revision backend/tier and remote checks remain open.

Face shading was added to the existing instanced ash geometry. The HIGH WebGL2 settled frame shows slight tonal variation around the visible bones and smoke above the heap, but the heap remains small at zoom 1.5 and the full visual brief is not accepted. Scene checks, typecheck, lint, and seven focused combat tests pass; current-revision matrix and remote checks remain open.

Current geometry review: HIGH and LOW zoom 1 WebGL2, HIGH zoom 1.5 and LOW zoom 1 WebGPU all passed scene checks and were inspected. The settled heap shows pale angular clumps, tan crossed bones and smoke on both tiers. The WebGPU death sheet shows a falling dark body fading into the pale heap, but distinct breakup is still weak; visual acceptance remains open. The remote unit and corpse/fire gate results above predate the latest code changes.

The next iteration staggers fragment descent and outward spread. The HIGH WebGL2 sequence shows a gradual dark-to-pale collapse with movement around the body, but individual fragments are still hard to distinguish at sheet scale; visual acceptance remains open. Scene checks, typecheck, lint and seven focused combat tests pass. Other tier/backend captures, gates and the remote suite predate this change.

Smoke and ember emission now uses the same body-centre position as the forming heap. In the inspected HIGH WebGL2 frame, small red embers and smoke rise over the heap rather than at the actor root. Scene checks, typecheck, lint and seven focused combat tests pass. Broader visual acceptance and current-revision tier/backend, gate and remote verification remain open.
