#!/bin/sh
# Install an additive post-checkout hook in this repository's common Git directory.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd -P)
common=$(git -C "$root" rev-parse --path-format=absolute --git-common-dir)
custom=$(git -C "$root" config --get core.hooksPath || true)
if [ -n "$custom" ]; then
  echo "core.hooksPath=$custom is already configured; add tools/hooks/post-checkout there." >&2
  exit 1
fi
mkdir -p "$common/hooks" "$common/mi-tools/tools/qa"
cp "$root/tools/qa/cache-lock.py" "$common/mi-tools/tools/qa/cache-lock.py"
cp "$root/tools/worktree-setup.sh" "$common/mi-tools/tools/worktree-setup.sh"
cp "$root/tools/hooks/post-checkout" "$common/mi-tools/post-checkout"
hook="$common/hooks/post-checkout"
if [ ! -f "$hook" ]; then printf '#!/bin/sh\n' > "$hook"; fi
if ! rg -q 'mi-tools/post-checkout' "$hook"; then
  cat >> "$hook" <<'HOOK'
# Minor Incident: all linked-worktree creation paths share the same dependency setup.
mi_common=$(git rev-parse --path-format=absolute --git-common-dir) || exit 1
sh "$mi_common/mi-tools/post-checkout" "$@"
HOOK
fi
chmod +x "$hook"
echo "Installed shared worktree setup hook: $hook"
