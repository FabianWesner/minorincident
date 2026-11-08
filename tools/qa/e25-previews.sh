#!/bin/sh
# Heavy Cycles previews run only in an admitted remote job. The tool lives in this job's scratch directory.
set -eu
[ "${MI_REMOTE:-}" = 1 ] || { echo 'Run through tools/remote/run.sh.' >&2; exit 64; }
preview_tool=$(mktemp -d /tmp/mi-e25-blender.XXXXXX)
trap 'rm -rf "$preview_tool"' EXIT
url=https://download.blender.org/release/Blender5.2/blender-5.2.2-linux-x64.tar.xz
curl --fail --location --retry 2 --max-time 240 "$url" --output "$preview_tool/blender.tar.xz"
tar -xJf "$preview_tool/blender.tar.xz" -C "$preview_tool"
export BLENDER_BIN="$preview_tool/blender-5.2.2-linux-x64/blender"
"$BLENDER_BIN" --version | head -1
python3 tools/blender/render_preview.py --all-light-assets --output test-results/epics/E25/previews
