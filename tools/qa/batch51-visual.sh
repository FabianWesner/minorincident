#!/bin/sh
export E2E_PORT=4901 PLAYTEST_BACKEND=webgpu PLAYTEST_ACCEPTANCE_CAPTURES=1 PLAYTEST_ACCEPTANCE_CAPTURE_TIERS=single PLAYTEST_THREAT_AUDIT=1 PLAYTEST_COMBAT_AUDIT=1 PLAYTEST_METRO_AUDIT=1 PLAYTEST_L5_TOUR=1
BATCH51_VISUAL_LEVELS=L6 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/batch51-visual-opening.mjs > docs/reports/batch51-qa/gates/visual-opening-L6-high.log 2>&1
E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/batch51-quality-repro.mjs > docs/reports/batch51-qa/gates/quality-repro-ui.log 2>&1
for level in L3 L6 L1 L2 L5 L7 L8 L9 L4 L10; do
  quality=high; god=1; minutes=6; segment=''
  case "$level" in L4) quality=low; god=0; minutes=8;; L3) quality=low; god=0;; L6) quality=low; god=0; export PLAYTEST_L6_DIE_ONCE=1;; L10) minutes=28; segment='--session-seconds 480';; esac
  export PLAYTEST_GOD=$god
  date -u
  node --import tsx tools/playtest/play.ts --levels "$level" --mode campaign --entry debug --quality "$quality" --zoom 1.5 --no-skip --level-minutes "$minutes" $segment --out "test-results/batch51/visual/$level-$quality" > "docs/reports/batch51-qa/gates/visual-$level-$quality.log" 2>&1
  result=$?
  unset PLAYTEST_L6_DIE_ONCE
  echo "$level exit=$result"
done
