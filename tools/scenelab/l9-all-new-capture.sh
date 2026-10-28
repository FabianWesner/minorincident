#!/bin/sh
# Each child uses one shared pool lease, releases it, and then starts the next.
set -eu
export SCENE_PORT=${SCENE_PORT:-3861}
export REVIEW_BASE=f36334ddd REVIEW_TIME=L9 REVIEW_RIGID_BASELINE=1
export FIGURES=${FIGURES:-inf.jogger,inf.cashier,inf.delivery-driver,inf.suburban-mom,inf.bbq-dad,inf.bathrobe-neighbor}
for config in ${L9_FIGURE_CONFIGS:-low-webgl2 high-webgpu high-webgl2 low-webgpu}; do
  case "$config" in none) continue;; esac
  REVIEW_TIER=${config%%-*} REVIEW_BACKEND=${config#*-}
  export REVIEW_TIER REVIEW_BACKEND
  L1_REVIEW_RAW="test-results/l9-all-new/figures/$config" node --import tsx tools/scenelab/l1-all-new-review.ts
done
for mode in ${L9_REVIEW_MODES:-crowd states story}; do
  case "$mode" in none) continue;; esac
  for config in low-webgl2 high-webgpu high-webgl2 low-webgpu; do
    case "$mode:$config" in story:high-webgl2|story:low-webgpu) continue;; esac
    REVIEW_TIER=${config%%-*} REVIEW_BACKEND=${config#*-}
    export REVIEW_TIER REVIEW_BACKEND
    for variant in old new; do
      case "$mode:$variant" in states:old|story:old) continue;; esac
      L9_CAPTURE=$mode REVIEW_VARIANT=$variant node --import tsx tools/scenelab/l9-all-new-scenes.ts
    done
  done
done
python3 tools/scenelab/l9-all-new-sheets.py
