#!/bin/sh
# The pool admits this opaque gate as one bounded compatibility reservation.
set -eu
export E2E_PORT=4871 SCENE_PORT=4872 MI_BUILD_CACHE=off
npx tsc --noEmit
npm run lint
npm test
npm run test:smoke
npm run scene:gate
