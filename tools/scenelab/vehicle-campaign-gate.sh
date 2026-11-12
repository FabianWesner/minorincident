#!/bin/sh
# All native windows run sequentially in one ten-minute reservation.
set -eu
cd "$(dirname "$0")/../.."
case "${VEHICLE_CAMPAIGN_CASE:-all}" in all|L9|l7-bus|l4-parked|l4-tank) ;; *) exit 2 ;; esac
E2E_SERIAL=1 E2E_UNITS=1 SCENE_PORT="${SCENE_PORT:-4983}" sh tools/e2e-lock.sh node --import tsx tools/scenelab/vehicle-campaign-batch.ts "${VEHICLE_CAMPAIGN_CASE:-all}"
