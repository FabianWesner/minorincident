#!/bin/sh
# Shared pool only; each child releases its context before the next starts.
set -eu
export SCENE_PORT=${SCENE_PORT:-3349}
export REVIEW_BASE=fe434da85
export FIGURES=npc.civilian-man-a.aftermath,npc.shelter-survivor.bandaged,npc.shelter-survivor.lying,npc.shelter-survivor.sitting
for config in low-webgl2 high-webgl2 low-webgpu high-webgpu low-webgl2-tone5 high-webgl2-tone5 low-webgpu-tone5 high-webgpu-tone5 neutral-high-webgpu; do
  REVIEW_TIME=L6 REVIEW_REST_POSES=1 REVIEW_STANDING=0 REVIEW_SKIN_TONE=0
  case "$config" in
    neutral-*) REVIEW_TIER=high REVIEW_BACKEND=webgpu REVIEW_TIME=L1 REVIEW_REST_POSES=0 REVIEW_STANDING=1;;
    *) REVIEW_TIER=${config%%-*}; rest=${config#*-}; REVIEW_BACKEND=${rest%%-*};;
  esac
  case "$config" in *tone5) REVIEW_SKIN_TONE=5;; esac
  export REVIEW_TIME REVIEW_REST_POSES REVIEW_STANDING REVIEW_SKIN_TONE REVIEW_TIER REVIEW_BACKEND
  L1_REVIEW_RAW="test-results/l6-all-new/figures/$config" node --import tsx tools/scenelab/l1-all-new-review.ts
done
for mode in crowd states story beats; do
  for config in low-webgl2 high-webgpu high-webgl2 low-webgpu; do
    case "$mode:$config" in states:high-webgl2|states:low-webgpu|story:high-webgl2|story:low-webgpu|beats:high-webgl2|beats:low-webgpu) continue;; esac
    REVIEW_TIER=${config%%-*} REVIEW_BACKEND=${config#*-}
    export REVIEW_TIER REVIEW_BACKEND
    for variant in old new; do
      case "$mode:$variant" in story:old|beats:old) continue;; esac
      L6_CAPTURE=$mode REVIEW_VARIANT=$variant node --import tsx tools/scenelab/l6-all-new-scenes.ts
    done
  done
done
python3 tools/scenelab/l6-all-new-sheets.py --runtime
