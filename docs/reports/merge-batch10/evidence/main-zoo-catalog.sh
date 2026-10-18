#!/bin/sh
node node_modules/vite/bin/vite.js preview --outDir /tmp/merge-batch10-main-control/dist --host 127.0.0.1 --port 3439 --strictPort --configLoader runner > /tmp/merge-batch10-main-zoo-server.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null' EXIT
SCENE_PORT=3439 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/catalog.ts --matrix --jobs 1 --backend webgl2 --filter 'wave3-zoo-routines' --out test-results/merge-batch10/main-zoo-catalog
