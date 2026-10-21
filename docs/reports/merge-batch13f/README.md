# Batch 13f integration

Baseline: `56d7e7d16` (`lane/fix-13e-l6`). Local integration only; no push, deployment or main merge.

## Group A

Merged `lane/edges-all` (`79c360e26`) and `lane/l8-continuity` (`3e1a11b5c`).

Conflicts: `GameView` keeps survivor ring updates and passes story-shot state to both objective presentations. `ObjectiveMarker` keeps terrain-aware placement, depth-tested ring material and metro completion hiding, adding the cinematic/story suppression. `View.reset` keeps the rocket zoom-limit reset while optionally retaining the handover zoom. `Hud` retains the shared objective wording formatter and clears empty objective text. Both camera test additions are retained.

Typecheck and lint pass. Remote unit/level sweep pending.

## Evidence procedure

The sole baseline worktree is `/tmp/mi-merge-batch13f-base`, detached at `56d7e7d16`, with its own production build. Browser checks are headless, use private ports and the shared browser lock, and are serialized within this job. Vitest remote sweeps use at most four workers. Native timing uses `quiet-run.sh` with its existing reservation deadline.

E29 baseline and final selections use the same non-performance E29/smoke pattern and visual exclusion as the original l7-perf functional run. Native WebGPU checks remain headless and separate from remote software rendering.
