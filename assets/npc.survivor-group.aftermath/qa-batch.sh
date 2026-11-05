#!/bin/sh
# Invoke through tools/e2e-lock.sh with E2E_PORT/SCENE_PORT for the preview server.
set -eu
npm run assets:turntable -- int.metro-station,util.flashlight,npc.civilian-elderly.aftermath,npc.paramedic.aftermath,npc.civilian-woman-a.aftermath,npc.survivor-group.aftermath --lod-contact --output test-results/l5-shelter-arrival-and-skins
npx tsx assets/int.metro-station/qa-capture.ts
python3 assets/int.metro-station/qa-sheets.py
npm run scene -- assets/int.metro-station/qa-scene.json assets/util.flashlight/qa-scene.json assets/npc.survivor-group.aftermath/qa-scene.json --backend webgl2 --size 1280x720 --out test-results/l5-shelter-arrival-and-skins/scene-lab
