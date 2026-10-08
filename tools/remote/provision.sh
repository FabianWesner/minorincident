#!/bin/sh
# Create a runner. `provision.sh [name]` adds one (from the base snapshot if present; cap 4);
# `provision.sh --snapshot [name]` snapshots a runner (default mi-runner-1) so new ones boot ready in ~1 min.
D=$(cd "$(dirname "$0")" && pwd)
case "${1:-}" in
  --snapshot) shift; exec python3 -I "$D/pool.py" snapshot "$@" ;;
  *) exec python3 -I "$D/pool.py" create "$@" ;;
esac
