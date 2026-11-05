# Why lane worktrees are big, and what we did (PO 11-01)

## Numbers (2026-11-01, HEAD 6058b240c, 28.6k tracked files)

Checked-out size of a lane worktree: **3.7–4.2 GB** (l5-density 4.2, l6-hold-2 4.2, luna-fixes-1101 3.7). Shared `.git`: 6.8 GB (pack 6.0 GB).

| Path (tracked) | Checkout | Share | Needed by build / lint / unit tests? |
|---|---|---|---|
| docs/reports | 1882 MB (12.4k jpg = 1126, 1.2k png = 698, 4.2k json = 180, md/txt/log small) | 45% | No. Tools read a few `census.json` / `ratios.json` receipts; no test reads it. Only `tests/fixtures/reports` is read by tests (separate path). |
| public/assets | 501 MB | 12% | Yes (runtime, build, e2e). |
| docs/scenes | 167 MB (long-guns captures 96) | 4% | No. Scene Lab tools read the small `*.json` specs, the images are captures. |
| tests/fixtures | 38 MB | 1% | Yes. |
| assets/ (source GLB, png, py) | 725 MB (667 MB glb, 47 MB png) | 17% | tsc/lint need `assets/audio/imports.json`; asset-pipeline tools need the GLBs; unit tests and `vite build` do not. |
| initial-drafts, experiment | 74 + 21 MB | 2% | No (eslint ignores them; only two QA scripts read one reference png). |
| node_modules | 210 MB by `du` | | Yes. |
| dist (after build) | ~518 MB by `du` | | Build output. |
| test-results | 1 MB to ~0.5 GB during runs | | Output. |

`node_modules` is NOT a symlink: `tools/worktree-setup.sh` makes an APFS clone (`cp -cR`) from `.mi-worktree-cache/node_modules-<lockhash>`, and `tools/build-cached.sh` clones `dist` from `.mi-worktree-cache/dist/<tree-hash>` the same way. `du` counts them in full, but the blocks are shared copy-on-write, so the real extra disk is near zero until files change. The cache itself is real: `.mi-worktree-cache/dist` keeps ~500 MB per distinct tree (3 entries = 1.5 GB at the time of writing; I deleted the one my test created). Nothing prunes it automatically.

dist/ and test-results/ are not cleaned at lane end. `tools/ops/safe-wt-remove.sh` removes the whole worktree, so they only matter while a lane lives (and for lanes that sit idle for days).

The .git history is the bigger part of the problem: docs/reports alone is **3.7 GB of the 6.0 GB pack** (62%), public 1.07 GB, assets 0.55 GB, docs/scenes 0.15 GB, initial-drafts 0.07 GB. That is shared by all worktrees but is paid once per clone and on every push to GitHub.

## What was done

`tools/ops/slim-worktree.sh <worktree-path> [--no-assets] [--clean-build] [--reset]` applies a non-cone sparse-checkout to a worktree:

- always excluded: `initial-drafts/`, `experiment/`, and `*.{jpg,jpeg,png,webp,gif,mp4,webm,glb,gz}` under `docs/reports/` and `docs/scenes/`. JSON, md, txt, log evidence stays because tools read some of it.
- `--no-assets`: additionally `assets/**/*.{glb,png,webp,jpg}` (json/py/md stay because tsc needs `assets/audio/imports.json`). Only for lanes that do not touch the asset pipeline or Blender builds.
- `--clean-build`: deletes `dist/` and `test-results/` in the worktree.
- `--reset`: `git sparse-checkout disable`.
- Refuses to run in the main checkout (`.git` must be a file).

Tested end to end on a throwaway worktree (then removed), with node_modules linked:

| Variant | Checkout size | tsc | lint | `npm test` | build |
|---|---|---|---|---|---|
| full (reference) | ~3.2 GB tracked + 0.2 node_modules | | | | |
| default slim | 1504 MB (docs/reports 1882 to 193 MB, docs/scenes 167 to 12 MB) | pass | pass | 27 files / 107 tests pass | |
| `--no-assets --clean-build` | 790 MB | pass | pass | 27 files / 107 tests pass | pass (dist 517 MB, produced on top) |

So a lane goes from about 3.7–4.2 GB to about 1.5 GB (default) or 0.8 GB (`--no-assets`), before dist.

### Using it

Fresh worktree (before any checkout, cheapest, never writes the big files):

    git worktree add --no-checkout -b lane/<slug> <path> HEAD
    tools/ops/slim-worktree.sh <path> [--no-assets]
    git -C <path> checkout -f HEAD

For an already checked-out worktree just run the script; it removes the excluded files from disk. Do not run it on a worktree with uncommitted changes under excluded paths (they are kept as modified, but check `git status` first).

Writing under an excluded path: files you create there are plain untracked files and stay on disk, but `git add` refuses paths outside the sparse set. Use

    git add --sparse docs/reports/<x>/sheet.png docs/reports/<x>/README.md
    git commit

(tested: both commit fine). Plain `git add docs/reports/<x>/` prints "paths exist outside your sparse-checkout" and stages nothing, so lane briefs must say `--sparse`. `git commit -a` does not pick up excluded paths. Reading an excluded image of an older report (for A/B against an old capture) fails with "No such file": use `git show HEAD:<path> > /tmp/x.png`, or `--reset`.

Not wired in: the scheduler skill (`~/.claude/skills/codex-scheduler`, global) and the Agent tool create the worktrees. Until the orchestrator calls the script after worktree creation (or a lane brief says to run it first), nothing changes by itself.

## Recommendations (not done)

1. **Now, free:** put `tools/ops/slim-worktree.sh <wt>` (default) in every lane brief's first step, `--no-assets` for non-asset lanes, `--clean-build` when a lane ends or idles. Saves ~2.2–3 GB per worktree, ~11 GB with five lanes (the 10-11 incident was 13 submits at 1.9 GB each).
2. **Prune `.mi-worktree-cache/dist`** to the newest 1–2 entries (saves ~0.5–1 GB), e.g. in the post-merge gate.
3. **Per-report evidence cap + pre-commit guard:** a hook that rejects a commit adding more than ~5 MB of images under one `docs/reports/<x>/` (and any single file over 1 MB there); evidence beyond that is kept as a contact sheet at reduced resolution (jpg q70, max 1600 px). The 12.4k jpgs average ~90 KB, the 1.2k pngs ~600 KB: converting pngs to jpg/webp would cut ~500 MB of checkout. Prevents regrowth (docs/reports grew to 1.9 GB in about 3 weeks).
4. **Move evidence out of git:** write captures to a git-ignored `docs/reports-archive/` (or an R2 bucket) and commit only the md/json receipts and the 1–2 sheets that justify a decision. Saves 1.8 GB checkout in every worktree and stops history growth (about 3.7 GB per 3 weeks). Needs a brief change and a path convention; old reports stay as is. Medium effort, no history rewrite.
5. **History rewrite** (`git filter-repo` dropping image blobs under docs/reports, docs/scenes, initial-drafts): shrinks `.git` from 6.0 GB to roughly 2.2 GB pack (minus about 3.8 GB). Cost: rewrites all hashes, force-push to the public GitHub repo (`FabianWesner/minorincident`), every lane branch and worktree must be rebased or recreated, deploy log commit references and the Pages deploy hashes in `epics-pipeline/deploylog.json` break, and existing clones or forks keep the old objects anyway (so no privacy gain). Do it only in a quiet window with no lanes and a backup tag/bundle; not worth it before recommendation 4 is in place, otherwise the repo regrows.
