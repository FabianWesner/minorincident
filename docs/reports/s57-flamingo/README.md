# S57 flamingo locomotion and foot-slide gate

**Status: in progress; acceptance is not proven.** The current lane changes contain the first presentation correction and p95 gate plumbing. The before/after motion matrix, reviewed frame strips, full animal/infected actor coverage, flock separation audit, required remote unit command, and complete Scene Lab gate remain outstanding.

## Finding and change

`AnimalMoves.sample()` treated arena engagement, chase, and attack state as a reason to fly at a 2.4 m cruise height. The paw solver correctly disables contact solving while the animal pose is airborne, so ordinary pursuit had no planted feet. Flamingos now take off only during the authored `flamingo.dive` telegraph/active stages; they return toward ground during recovery. This keeps the existing pose/flight blend for the move while allowing ordinary pursuit to use the grounded animal locomotion path. No model files, stats, or lion code changed.

Scene Lab expectations now support `footSlideP95MaxCm` and explicit `footSlideActors`. Each named actor must have a non-null contact p95 and stay at or below 3 cm; missing actors and actors with no contacts fail. The gate criteria cover the moving L8 animal lineup, dog trot/flee, and two ordinary infected chase rows. The L1/L3 scene criteria were extended because those existing rows did not assert the requested foot-slide invariant.

## Measurements

| Fixture | Before p95 | Current p95 | Target | Evidence status |
| --- | ---: | ---: | ---: | --- |
| Flamingo walk/run, day/night × low/high × WebGL2/WebGPU | not measured | not measured | ≤ 3 cm | browser gate blocked |
| L8 animal lineup, named actors | not measured | not measured | ≤ 3 cm | browser gate blocked |
| Dog trot/flee and L1/L3 infected chase | not measured | not measured | ≤ 3 cm | browser gate not run |

The authored source path establishes why the old flight pose released contacts, but it does not establish a measured before/after p95. The requested matrix and same-source baseline capture must be produced before acceptance.

## Visual evidence

The supplied `po-flamingos-292.webp` was opened. It shows a night arena with the courier and a clustered group at the lower left, but no visible flamingos in the image; it cannot establish their pose or spacing. No frame-strip contact sheet has been captured or reviewed in this run.

## Validation and blockers

- `npm run lint`: passed.
- `npm run typecheck`: passed after the change.
- Focused `tests/shared/render-contracts.test.ts`: 14/14 passed after correcting the new grounded-pose assertion.
- Required `sh tools/remote/run.sh "$PWD" -- npm test`: no healthy Hetzner runner; the local slot rejects this `npm test` package-script form.
- `SCENE_PORT=4958 npm run scene:gate`: the `tsx` CLI could not bind its temp IPC socket under sandbox restrictions. Running the gate runner directly with `node --import tsx/esm` reached all four L8 lineup rows, but the browser pool could not bind its coordinator at `127.0.0.1:4329`; all four rows reported not run (exit 75). No gate pass is claimed.
- Required `tools/ops/slim-worktree.sh "$PWD"`: Git could not write the parent worktree config outside the writable workspace. No tracked files were changed by that failed setup step.
- Explicit `git add` / commit: Git could not create `.git/worktrees/s57-flamingo/index.lock` because the linked-worktree Git metadata is outside the writable workspace. Changes remain uncommitted.

The authored L8 landing-ring code in `L8BossArenas.callFlight()` already staggers later flights by radius and bearing (r42). It still needs a runtime crowd-separation measurement under the requested close zoom and night scene; this source inspection is not proof against stacking.

## Scope notes

The scene-spec edits add the requested measurable criterion, correcting the previous gate omission. Ordinary infected classes beyond the two chase variants and animal species beyond the named lineup/dog fixtures still need actor-specific rows. No flamingo model or asset was edited.

## Unrestricted continuation: runtime evidence

The filesystem/network restrictions were removed. Worktree slimming now succeeds. The filtered L8 lineup gate ran to completion on WebGL2/WebGPU × low/high: **0/4 pass, 0 missing**. Every configuration reports zebra 15.6 cm, gorilla 4.5 cm and elephant 22.8 cm p95. Flamingo is 2.1 cm over one contact with 1.91 m travel in this short fixture; that is not sufficient for full walk/run acceptance. Monkey is 2.5 cm, lion 0 cm, lioness 0.4 cm, stationary dog 0 cm and regular 1.5 cm. These are current-source values, not a before/after comparison.

Opened `test-results/scene-gate/webgl2-low-1/night-boss-zoo-lineup@low-z1.5/sheet.jpg`: three frames (0/30/60), separated animals across the slab. Flamingo remains grounded at the lower left, but the scale and frame spacing cannot establish a detailed stepping gait. Elephant, zebra and gorilla body movement is visible; numeric contact failures remain authoritative. The goal remains active and the next work is to isolate the failing contact phases and complete the dedicated movement fixtures.

The earlier sandbox-only browser and Git blockers are historical. The filtered gate now supplies real failing motion evidence.

### Contact-phase diagnosis

`contact-diagnosis.json` records contiguous contacts from the saved rounded track. Before the heavy hit at frame 55, zebra support feet remain grounded through frame 46 while travelling 17.8/15.6 cm; elephant support feet travel 23.6/22.8 cm through frame 37. Gorilla's frame 26–41 contact travels 15.4 cm. These establish sustained support drift during locomotion, rather than only a hit transition. The diagnostic deliberately labels its unfiltered post-hit contacts as unsuitable for acceptance; production `summarizeMotion` excludes knockdown clips.

`PawContacts.placeAnkle()` currently derives the desired sole orientation from the actor's current heading on every frame, including support. A pinned sole centre therefore still rotates its heel/toe during turns. The next implementation should retain orientation during support and release/re-step when reach is exhausted; its effect on shared animal contact code must be measured without changing lion-specific motion.

### Support-orientation correction

The shared `PawContacts` solver now retains a sole's world orientation during support, follows the body heading during swing/settling steps, and carries orientation across LOD handoffs. It resets that state when contact solving is released. No lion-specific motion changed. The same four lineup rows now pass: **4/4, no known failures or missing rows**. WebGL2 low p95 before → after: flamingo 2.1 → 0 cm, zebra 15.6 → 0.4 cm, monkey 2.5 → 0.1 cm, lion 0 → 0 cm, lioness 0.4 → 0.1 cm, gorilla 4.5 → 0.3 cm, elephant 22.8 → 0 cm. This is the short existing fixture, not the requested full walk/run coverage.

Typecheck and the 14 render-contract tests pass. Reopened the current three-frame lineup sheet: the animals remain separated and grounded, with attached limbs; its distant framing still cannot prove close-view gait quality. The full scope remains incomplete.

### Dedicated flamingo rows added

Added day/night × low/high × WebGL2/WebGPU rows for a 360-frame flamingo fixture. The initial run exposed a vacuous fixture: infected `walk` consumes only the last waypoint, which was the spawn point, yielding zero travel and one static contact. Those eight apparent passes are rejected as acceptance evidence. The corrected fixture attracts the bird to a distinct walk target, then chases a distant courier, and requires at least 6 m of recorded travel. The corrected rows are committed for the next measurement; they have not yet been run. This also corrects the missing movement criterion in the scene gate.

### Corrected flamingo matrix and reinforcement orbit

The corrected 360-frame fixture passes **8/8** day/night × low/high × WebGL2/WebGPU rows. Every row records 11.673 m travel, peak 5.0 m/s, eight contacts and p95 0.1 cm. Compact current-source receipts are committed in `flamingo-current-matrix.json`. This establishes repeated movement in the fixture; before-source comparison, close stepping/flight review and complete class coverage remain required.

Found a reinforcement steering defect: `orbit()` used permanent slot IDs divided by the original count of eight, so slots 8/16/24 reused slot 0's target, and analogous pairs reused the other targets. Flamingo orbit now assigns evenly spaced targets to the currently living flock. Other arenas retain their original slot behavior. Runtime nearest-neighbor/body-overlap proof is still outstanding.

A direct production-method probe with living slots 0/8/16/24/1/9/17/25 now yields a minimum orbit-target separation of 3.8268 m. This is a target geometry check, not live-body clearance evidence. Typecheck and lint pass after the orbit change.
