#!/bin/sh
# Prepare a newly-created worktree with dependencies shared by lockfile hash.
set -eu
script_root=$(cd "$(dirname "$0")/.." && pwd -P)
smoke=0
target=$script_root
for arg in "$@"; do case "$arg" in --smoke) smoke=1;; *) target=$arg;; esac; done
wt=$(cd "$target" && pwd -P)
common=$(git -C "$wt" rev-parse --path-format=absolute --git-common-dir)
repo=$(cd "$(dirname "$common")" && pwd -P)
store="${MI_WORKTREE_CACHE:-$repo/.mi-worktree-cache}"
lock_hash=$(shasum -a 256 "$wt/package-lock.json" | awk '{print $1}')
cache="$store/node_modules-$lock_hash"
mkdir -p "$store"
start=$(node -p 'Date.now()')
size_before=$(du -sk "$wt" 2>/dev/null | awk '{print $1}')
lock="$store/.setup-$lock_hash.lock"
if [ "${MI_CACHE_LOCK_HELD:-}" != "$lock" ]; then
  python3 "$script_root/tools/qa/cache-lock.py" "$lock" -- sh "$0" "$wt"
  if [ "$smoke" -eq 1 ]; then
    export MI_WORKTREE_CACHE="$store"
    smoke_start=$(node -p 'Date.now()')
    (cd "$wt" && npm run test:smoke)
    smoke_elapsed=$(( $(node -p 'Date.now()') - smoke_start ))
    printf 'first_green_smoke_ms=%s\n' "$smoke_elapsed"
  fi
  exit 0
fi
if [ ! -d "$cache/node_modules" ]; then
  # Local file dependencies keep resolving against the checkout tree.
  [ ! -L "$wt/node_modules" ] || rm "$wt/node_modules"
  npm ci --prefix "$wt" --no-audit --no-fund --loglevel=error
  rm -rf "$cache"
  mkdir -p "$cache"
  mv "$wt/node_modules" "$cache/node_modules"
  printf '%s\n' "$lock_hash" > "$cache/.lock-hash"
fi
if [ -L "$wt/node_modules" ]; then rm "$wt/node_modules"; elif [ -e "$wt/node_modules" ]; then rm -rf "$wt/node_modules"; fi
if ! cp -cR "$cache/node_modules" "$wt/node_modules" 2>/dev/null; then rm -rf "$wt/node_modules"; cp -R "$cache/node_modules" "$wt/node_modules"; fi
printf '%s\n' "$lock_hash" > "$wt/node_modules/.mi-lock-hash"
size_after=$(du -sk "$wt" 2>/dev/null | awk '{print $1}')
elapsed=$(( $(node -p 'Date.now()') - start ))
printf 'worktree=%s lock=%s cache=%s disk_before_kb=%s disk_after_kb=%s setup_ms=%s\n' "$wt" "$lock_hash" "$cache" "$size_before" "$size_after" "$elapsed"
