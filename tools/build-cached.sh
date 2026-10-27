#!/bin/sh
# Reuse a production dist only for a byte-identical clean Git tree.
set -eu
export NODE_ENV=production
root=$(cd "$(dirname "$0")/.." && pwd -P)
common=$(git -C "$root" rev-parse --path-format=absolute --git-common-dir)
repo=$(cd "$(dirname "$common")" && pwd -P)
store="${MI_WORKTREE_CACHE:-$repo/.mi-worktree-cache}"
if [ "${MI_BUILD_CACHE:-on}" = off ] || [ -n "$(git -C "$root" status --porcelain --untracked-files=all)" ] || [ -n "$(git -C "$root" ls-files --others --ignored --exclude-standard -- public src)" ]; then
  exec "$root/node_modules/.bin/vite" build --configLoader runner "$@"
fi
tree=$(git -C "$root" rev-parse 'HEAD^{tree}')
lock_hash=$(shasum -a 256 "$root/package-lock.json" | awk '{print $1}')
spikes="${BUILD_SPIKES:-0}"
env_key=$(node --input-type=module - "$root" <<'NODE'
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const hash = createHash('sha256'), root = process.argv[2];
for (const file of readdirSync(root).filter(f => /^\.env(?:\.|$)/.test(f)).sort()) {
  const path = resolve(root, file);
  if (existsSync(path)) hash.update(file).update(readFileSync(path));
}
for (const [key, value] of Object.entries(process.env).filter(([key]) => key.startsWith('VITE_')).sort()) hash.update(key).update(value ?? '');
console.log(hash.digest('hex'));
NODE
)
key=$(printf '%s\0' "$tree" "$(git -C "$root" rev-parse HEAD)" "$lock_hash" "$spikes" "$env_key" "$@" | shasum -a 256 | awk '{print $1}')
cache="$store/dist/$key"
mkdir -p "$store/dist" "$store/locks"
lock="$store/locks/dist-$key"
if [ "${MI_CACHE_LOCK_HELD:-}" != "$lock" ]; then
  exec python3 "$root/tools/qa/cache-lock.py" "$lock" -- sh "$0" "$@"
fi
if [ -d "$cache" ]; then
  rm -rf "$root/dist"
  if ! cp -cR "$cache" "$root/dist" 2>/dev/null; then rm -rf "$root/dist"; cp -R "$cache" "$root/dist"; fi
  echo "Reused production dist for tree $tree"
else
  NODE_ENV=production "$root/node_modules/.bin/vite" build --configLoader runner "$@"
  if ! cp -cR "$root/dist" "$cache" 2>/dev/null; then rm -rf "$cache"; cp -R "$root/dist" "$cache"; fi
  echo "Cached production dist for tree $tree"
fi
