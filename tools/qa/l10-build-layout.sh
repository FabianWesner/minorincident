#!/bin/sh
# The runner has no macOS Blender path. Reuse the headless Linux tool recipe.
set -eu
[ "${MI_REMOTE:-}" = 1 ] || { echo 'Run through tools/remote/run.sh.' >&2; exit 64; }
l10_tool=$(mktemp -d /tmp/mi-l10-blender.XXXXXX)
trap 'rm -rf "$l10_tool"' EXIT
curl --fail --location --retry 2 --max-time 240 \
  https://download.blender.org/release/Blender5.2/blender-5.2.2-linux-x64.tar.xz \
  --output "$l10_tool/blender.tar.xz"
tar -xJf "$l10_tool/blender.tar.xz" -C "$l10_tool"
export BLENDER_BIN="$l10_tool/blender-5.2.2-linux-x64/blender"
"$BLENDER_BIN" --version | head -1
npm run layouts:build -- D-CURE
