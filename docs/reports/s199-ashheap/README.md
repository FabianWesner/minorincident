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
