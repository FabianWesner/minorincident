# s199 — Flamethrower ash heap

## Implementation status

Fire deaths now dissolve over the existing 90-tick (1.5 s) charred-body interval instead of disappearing at the end of a body-only shrink. Screen-door fading, a gradual sink, eight irregular instanced ash clumps, and two crossed bone meshes share the transition. The ash clumps begin grey-white with two darker charred pieces and a small warm tint that fades as the heap settles. The existing pooled VFX path emits repeated smoke puffs during the same interval. Settled heaps remain represented by the dead entity and are rebuilt in the existing ash instance batches; this adds no mesh or draw call per heap. HIGH and LOW use the same presentation and both renderer backends use the same Three.js instancing path.

## Validation

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npx vitest run --project default tests/engine/combat.test.ts` — PASS (7 tests).
- `npm test` locally — PASS (106 tests, 27 files; 150-case budget manifest, which includes non-default projects and browser cases not run by this command).
- `sh tools/remote/run.sh "$PWD" -- npm test` — NOT RUN: no healthy remote runner; command exited 69 before tests started.
- `npm run scene:gate -- --filter 'corpse-look-close,corpse-look-alpha,s69-brute-under-fire,s69-butcher-under-fire'` — NOT RUN: tsx could not bind its local IPC socket (`EPERM`).
- Scene Lab capture (`s199-ash-heap`, WebGL2 HIGH, zoom 1.5) — PASS for console and clipping gates after access was restored. Visual review **fails**: the dark figure falls, then becomes a very small bright white patch; the bones and crumbling are not discernible at this scale. The 16-frame sheet is in `test-results/s199-ash-heap/high-z15/sheet.jpg`.

## Open acceptance

The revised HIGH zoom 1.5 capture shows two tan crossed bones over an irregular dark pile. Allocating instance colours before shader compilation fixed the previously white heap, but the ash still reads too dark; the sequence remains unaccepted. Settled HIGH zoom 1, LOW zoom 1, and WebGPU appearance remain unreviewed. Refine the heap and crumble, repeat the requested captures, and inspect them. Also run the focused corpse/fire scene gate rows and remote unit suite when their runners are available. Typecheck, lint, and the seven focused combat tests passed again after this revision.
