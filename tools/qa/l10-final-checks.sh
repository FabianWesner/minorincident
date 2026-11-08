#!/bin/sh
# Run through tools/remote/run.sh. Sequential heavy checks, one Vitest worker, no browser.
set -u
[ "${MI_REMOTE:-}" = 1 ] || { echo 'Run remotely: sh tools/remote/run.sh "$PWD" -- sh tools/qa/l10-final-checks.sh' >&2; exit 64; }
root=docs/reports/eg-l10-story/evidence
mkdir -p "$root"
: > "$root/checks.jsonl"
run_check() {
  name=$1
  shift
  started=$(date +%s)
  "$@" > "$root/$name.log" 2>&1
  result=$?
  elapsed=$(( $(date +%s) - started ))
  printf '{"check":"%s","exit":%s,"seconds":%s,"log":"%s/%s.log"}\n' "$name" "$result" "$elapsed" "$root" "$name" >> "$root/checks.jsonl"
  echo "[l10-check] $name exit=$result seconds=$elapsed"
  [ "$result" = 0 ] || tail -n 12 "$root/$name.log"
}
run_check unit node tools/qa/test-budget.mjs --name test-l10-story --max-seconds 150 -- node node_modules/vitest/vitest.mjs run --project default --configLoader runner --maxWorkers=1
run_check acceptance env QA_ACCEPT_ROOT="$root/acceptance" npm run qa:accept -- --level L10 --skip-browser
run_check threat npm run qa:threat -- --levels L10 --maxWorkers=1 --out "$root/threat" --report "$root/threat.md"
echo '[l10-check] receipts written; inspect checks.jsonl and acceptance native clauses separately from browser clauses.'
