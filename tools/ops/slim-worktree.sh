#!/bin/sh
# Slim a freshly created lane worktree with git sparse-checkout (non-cone patterns).
# Usage: tools/ops/slim-worktree.sh <worktree-path> [--no-assets] [--clean-build] [--reset]
#   default      skip QA evidence binaries (images/video/glb/gz) under docs/reports and docs/scenes,
#                initial-drafts/ and experiment/. JSON/MD/TXT/LOG evidence stays (tools read some of it).
#   --no-assets  also skip assets/**/*.{glb,png,webp,jpg} (source models, ~715 MB; json/py/md stay, tsc needs assets/audio/imports.json). Only for lanes that touch no
#                asset pipeline (tools/assets, tools/layouts/build.ts, Blender builds).
#   --clean-build  remove dist/ and test-results/ of the worktree (run at lane end).
#   --reset      undo: git sparse-checkout disable (restores the full tree).
# Files a lane writes under an excluded path are committed with:  git add --sparse <path>
# Details: docs/process/worktree-size.md
set -eu
wt="${1:?usage: slim-worktree.sh <worktree-path> [--no-assets] [--clean-build] [--reset]}"; shift
no_assets=0; clean=0; reset=0
for a in "$@"; do case "$a" in --no-assets) no_assets=1;; --clean-build) clean=1;; --reset) reset=1;; *) echo "unknown flag $a" >&2; exit 2;; esac; done
cd "$wt"
git rev-parse --is-inside-work-tree >/dev/null
[ -f .git ] || { echo "refusing: $wt is not a linked worktree (.git is not a file)" >&2; exit 1; }
if [ "$reset" = 1 ]; then git sparse-checkout disable; exit 0; fi
if [ "$clean" = 1 ]; then rm -rf dist test-results; fi
{
  echo '/*'
  echo '!/initial-drafts/'
  echo '!/experiment/'
  if [ "$no_assets" = 1 ]; then for ext in glb png webp jpg; do echo "!/assets/**/*.$ext"; done; fi
  for ext in jpg jpeg png webp gif mp4 webm glb gz; do
    echo "!/docs/reports/**/*.$ext"
    echo "!/docs/scenes/**/*.$ext"
  done
} | git sparse-checkout set --no-cone --stdin

echo "slimmed $wt (if it was created with --no-checkout, run: git -C $wt checkout -f HEAD)"
