#!/bin/sh
# fix65-a: replay a fixed list of real-input actions against a running live.ts session and keep one frame per action.
# usage: sh tools/qa/fix65-walk.sh <live port> <out dir> '<json action>' ['<json action>' ...]
port=$1; out=$2; shift 2
mkdir -p "$out"
i=0
for action in "$@"; do
  i=$((i + 1))
  r=$(curl -s -X POST "127.0.0.1:$port/act" -d "$action")
  shot=$(printf '%s' "$r" | python3 -c "import json,sys; print(json.load(sys.stdin)['screenshot'])")
  hud=$(printf '%s' "$r" | python3 -c "import json,sys; print(json.load(sys.stdin)['hud'].split(chr(10))[0])")
  cp "$shot" "$out/step-$i.jpg"
  echo "$i $action -> $hud"
done
