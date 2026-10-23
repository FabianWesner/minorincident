#!/bin/sh
set -eu
started=$(date +%s) previous=0
for key in "$@"; do
  level=${key%%:*} rest=${key#*:}
  backend=${rest%%:*} quality=${rest#*:}
  summary="docs/reports/load-stalls/evidence/after/$level-$backend-$quality-summary.json"
  if [ -f "$summary" ] && python3 -c 'import json,sys;sys.exit(json.load(open(sys.argv[1])).get("gate") != "PASS")' "$summary"; then continue; fi
  elapsed=$(($(date +%s) - started))
  # Release before another similarly sized configuration could exceed 20 min.
  if [ "$previous" -gt 0 ] && [ "$((elapsed + previous + 30))" -gt 1100 ]; then exit 85; fi
  config_started=$(date +%s)
  had_proof=0
  if [ ! -f test-results/load-stalls/quick-candidate-passed ]; then had_proof=1; fi
  sh docs/reports/load-stalls/evidence/measure-config.sh "$level" "$backend" "$quality"
  if [ "$had_proof" = 1 ]; then config_started=$(cat test-results/load-stalls/candidate-proof-finished); fi
  previous=$(($(date +%s) - config_started))
  python3 docs/reports/load-stalls/evidence/summarize.py
done
