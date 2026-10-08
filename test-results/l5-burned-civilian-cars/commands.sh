#!/bin/sh
# Run from the lane root. Preview must serve the current npm run build output.
set -eu
for id in veh.sedan-red veh.sedan-blue veh.sedan-white veh.suv-dark; do
  npm run assets:build -- "$id" --decay burned
  npm run assets:pack -- "$id"
  npm run assets:validate -- --ids "$id"
done
npm run build
# Start one preview on a free port, e.g. npm run preview -- --port 3313.
for id in veh.sedan-red veh.sedan-blue veh.sedan-white veh.suv-dark; do
  E2E_PORT=3313 sh tools/e2e-lock.sh npm run assets:turntable -- "$id" --decay burned --lod-contact --output test-results/l5-burned-civilian-cars
  E2E_PORT=3313 sh tools/e2e-lock.sh npm run assets:turntable -- "$id" --decay burned --output test-results/l5-burned-civilian-cars
done
sh tools/e2e-lock.sh npx tsx test-results/l5-burned-civilian-cars/capture-peer.ts
python3 test-results/l5-burned-civilian-cars/sheets.py
npx tsx test-results/l5-burned-civilian-cars/measure.ts
npm run assets:validate
npm run typecheck
npm run lint
sh tools/remote/run.sh "$PWD" --pull test-results/l5-burned-civilian-cars/unit.json -- npm run test:unit -- --maxWorkers=2 --reporter=default --reporter=json --outputFile=test-results/l5-burned-civilian-cars/unit.json
