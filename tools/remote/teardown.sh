#!/bin/sh
# Delete runners: `teardown.sh mi-runner-3` or `teardown.sh --all` (all servers labelled project=minor-incident named mi-runner-*).
# Add --snapshots to also delete the base snapshot (then the next runner cold-starts from ubuntu-24.04, ~4 min).
D=$(cd "$(dirname "$0")" && pwd)
[ $# -ge 1 ] || { echo "usage: teardown.sh <name>|--all [--snapshots]" >&2; exit 64; }
exec python3 -I "$D/pool.py" delete "$@"
