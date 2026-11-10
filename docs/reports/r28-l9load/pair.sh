#!/bin/sh
# usage: pair.sh <backend> <low|high> <pairs> <outdir> <A-port> <B-port>   (A = candidate-under-test label "a", B = label "b")
# Run inside quiet-run.sh from the worktree root.
backend=$1; quality=$2; pairs=$3; out=$4; pa=$5; pb=$6
i=0
while [ "$i" -lt "$pairs" ]; do
  if [ $((i % 2)) -eq 0 ]; then order="a b b a"; else order="b a a b"; fi
  for s in $order; do
    if [ "$s" = a ]; then port=$pa; else port=$pb; fi
    n=$(ls "$out" 2>/dev/null | wc -l | tr -d ' ')
    d="$out/$(printf '%03d' "$n")-$s"
    LOAD_OUT="$d" node --import tsx tools/perf/cold-load-time.ts "http://127.0.0.1:$port" "$backend" "$quality" 1 L9 >/dev/null 2>&1 || echo "fail $d"
  done
  i=$((i + 2))
done
