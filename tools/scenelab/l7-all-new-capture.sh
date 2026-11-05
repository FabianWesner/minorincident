#!/bin/sh
# Shared headless jobs only; every child releases its context before the next.
set -eu
export SCENE_PORT=${SCENE_PORT:-3357}
export REVIEW_BASE=93d73c529 REVIEW_TIME=L7 REVIEW_RIGID_BASELINE=1
for config in ${L7_FIGURE_CONFIGS:-low-webgl2 high-webgpu high-webgl2 low-webgpu low-webgl2-tone5 high-webgpu-tone5}; do
  case "$config" in none) continue;; esac
  REVIEW_TIER=${config%%-*}; rest=${config#*-}; REVIEW_BACKEND=${rest%%-*}
  REVIEW_SKIN_TONE=0
  FIGURES=${L7_FIGURE_IDS:-$(node -e "console.log(require('./docs/reports/l7-all-new/census.json').review.join(','))")}
  case "$config" in *tone5) REVIEW_SKIN_TONE=5; FIGURES=$(FIGURES="$FIGURES" node -e "console.log(process.env.FIGURES.split(',').filter(id=>id.startsWith('npc.')).join(','))");; esac
  export REVIEW_TIER REVIEW_BACKEND REVIEW_SKIN_TONE FIGURES
  L1_REVIEW_RAW="test-results/l7-all-new/figures/$config" node --import tsx tools/scenelab/l1-all-new-review.ts
done
for mode in ${L7_REVIEW_MODES:-portraits crowd states story}; do
  case "$mode" in none) continue;; esac
  for config in low-webgl2 high-webgpu high-webgl2 low-webgpu; do
    case "$mode:$config" in portraits:high-webgl2|portraits:low-webgpu|states:high-webgl2|states:low-webgpu|story:high-webgl2|story:low-webgpu) continue;; esac
    REVIEW_TIER=${config%%-*} REVIEW_BACKEND=${config#*-}
    export REVIEW_TIER REVIEW_BACKEND
    for variant in old new; do
      case "$mode:$variant" in story:old) continue;; esac
      L7_CAPTURE=$mode REVIEW_VARIANT=$variant node --import tsx tools/scenelab/l7-all-new-scenes.ts
    done
  done
done
python3 tools/scenelab/l7-all-new-sheets.py
