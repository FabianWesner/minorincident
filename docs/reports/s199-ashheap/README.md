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
- Scene Lab capture (`s199-ash-heap`, WebGL2 HIGH, zoom 1.5) — NOT RUN: browser pool could not bind `127.0.0.1:4329` (`EPERM`), including a retry with `E2E_PORT=5161 SCENE_PORT=5162`.

## Open acceptance

No requested frames were produced or visually reviewed in this environment. Therefore the death sequence, settled heap at zoom 1 and 1.5, LOW zoom 1, and WebGPU appearance remain unaccepted. The report does not claim the visual brief complete. Re-run the scene through the headless browser pool when its local socket access is available; capture six death frames plus settled HIGH zoom 1/1.5 and LOW zoom 1, inspect the sheets, and refine from those observations. Also run the focused corpse/fire scene gate rows and remote unit suite when their runners are available.
