#!/bin/sh
# Opt-in software-rendered catalogs on Hetzner; WebGPU stays on the reference Mac.
set -eu
export SCENE_PORT=${SCENE_PORT:-$((44000 + $$ % 10000))} SCENE_SERVER=${SCENE_SERVER:-preview}
backend=webgl2
out=test-results/scene-catalog
next=''
for arg in "$@"; do
  case "$next" in backend) backend=$arg;; out) out=$arg;; esac
  next=''
  case "$arg" in --backend) next=backend;; --out) next=out;; esac
done
# --list is read-only and needs no GPU reservation.
for arg in "$@"; do [ "$arg" != --list ] || exec npx tsx tools/scenelab/catalog.ts "$@"; done
if [ "${MI_REMOTE:-}" != 1 ] && [ "$backend" = webgl2 ]; then
  case "$out" in /*|*..*) echo 'Scene output must be a worktree-relative path without ..' >&2; exit 2;; esac
  exec sh tools/remote/run.sh "$PWD" --pull "$out" --env SCENE_SERVER=preview --env "SCENE_PORT=${SCENE_PORT:-$((44000 + $$ % 10000))}" -- sh -c 'npm run build && exec npx tsx tools/scenelab/catalog.ts "$@"' sh "$@"
fi
E2E_UNITS=2 exec sh tools/e2e-lock.sh npx tsx tools/scenelab/catalog.ts "$@"
