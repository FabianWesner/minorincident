# s60 L8 redesign, part 1

## Changes

- Kept the existing path and L8 gate state machine, shortened route prompts, moved route markers to each entry gate, and move the marker to the arena centre after entry. Completed exits close once the whole party is through the next entry gate.
- Added compact 28 m inner fence pens inside the existing zoo enclosures, paved spurs to their gates, and compact monkey and elephant arena bounds. The new placement geometry is appended after the existing layout placements to preserve their IDs.
- Changed habitat floors to a light sidewalk material. Added an arena outline to the minimap and restricted L8 threat dots to living infected inside the active arena.
- Replaced fight objective tips with short kill counters. Existing encounter announcements continue to show the arena tip once as a subtitle. Kept the plaza breach and finale flow.
- No animal models, motion code, or §3 flamingo mechanic changes.

## Captures

None. The D-ZOO assets could not be rebuilt in this restricted checkout, so no runtime capture is representative of the changed layout.

## Checks

- `npm run typecheck`: pass (also re-run directly through the TypeScript CLI after the final gate changes).
- `npm run lint`: pass before the final small gate/test edits; rerun required.
- `node --import tsx/esm node_modules/vitest/vitest.mjs run --project default tests/engine/missions.test.ts --maxWorkers=4`: pass, 6 tests.
- `npm run layouts:build -- D-ZOO`: blocked. The `tsx` wrapper cannot create its IPC socket in this sandbox. Calling `tools/layouts/build.ts` directly avoids that wrapper, but Blender 5.2.2 crashes in its Metal backend probe before the layout script starts. Restore of incidental generated physics metadata was verified.
- `sh tools/ops/slim-worktree.sh "$PWD"`: blocked because it cannot write the linked `.git/worktrees/.../config.worktree` outside the writable workspace.
- Smoke, threat audit, nightly invariants, full `npm test`, and real-input playthrough/captures: pending. Smoke and playthrough require the rebuilt layout; remaining checks have not completed yet.

## Remaining for part 2

Rebuild and validate the D-ZOO output, capture the actual gated route and zoom-1 pens, run the requested audits and real-input path through flamingo → lion → monkey, then score the arena presentation. Part 2 still owns the flamingo rework, signature-attack telegraphs, and deliberate 3–4-piece arena cover pass.

## Continuation validation (2026-11-12)

Filesystem access restored. `slim-worktree.sh` now passes. D-ZOO rebuilt successfully (source hash `71f158d2adc0f3649cf451249f8817bdee4a950d6ecfea0b792387118a517913`). The required smoke run on 4965/4966 completed: 5 passed, 1 failed because L8 load rejects road lane overlaps for crowd-fence placement IDs 2007, 2008, 2022, 2023, 2024. These overlaps must be fixed before playthrough. Latest lint and main TypeScript check pass; mission scenarios remain 5/6 with Hale charge distance Infinity. Earlier pass above predates the final elephant geometry and is superseded. Threat audit reported tunnel-breach first attack 30.45 s; remote checks and captures remain pending. None of these pending validations belong to part 2; they remain required for this lane.

Rebuild continuation: corrected appended placement allocation after filtering (duplicate fence IDs were detected during mission loading). Build succeeded with hash `e1b0021815b05f3829739f45974a0ba1f728fd50dbd4a00e44d88b7525d5e46a`; generated placements now have zero duplicate IDs. Elephant gate openings widened for the vehicle lane, obsolete western through-road edge removed. Runtime checks still pending.
