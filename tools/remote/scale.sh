#!/bin/sh
# Pool housekeeping. `scale.sh reap` deletes runners (except mi-runner-1) that had no job for MI_IDLE_HOURS (default 4);
# `scale.sh watch` does that every 10 min (run it in the background); `scale.sh add` forces a new runner (cap 4).
D=$(cd "$(dirname "$0")" && pwd)
case "${1:-reap}" in
  reap) exec python3 -I "$D/pool.py" reap ;;
  add) exec python3 -I "$D/pool.py" create ;;
  watch) while :; do python3 -I "$D/pool.py" reap; sleep 600; done ;;
  *) echo "usage: scale.sh reap|watch|add" >&2; exit 64 ;;
esac
