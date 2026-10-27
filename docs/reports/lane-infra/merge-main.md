# Main integration — 2026-10-27

Merged main `976573659` into `lane/lane-infra` as `38ece0ef5`. Resolved `package.json`, `vite.config.ts` and `tools/skinpilot/browser.ts`. Main's production/QA split, public QA file stripping, QA build prerequisites and `test:gate`/`test:nightly` scripts remain. Both build modes use `tools/build-cached.sh`; the shared optimizer cache directory and pooled `launchBrowser` remain enabled.

The dist key explicitly hashes `NODE_ENV`, `VITE_QA_HOOKS`, `BRANCH` and other Vite environment inputs. The build wrapper preserves an explicitly supplied Node environment; npm build scripts select production as before.

## Build isolation

From clean committed sources, `node tools/qa/build-cache-check.mjs` passed all seven steps. Every step checks the resolved `__QA_HOOKS__` define, emitted QA hook markers and public HTML files. [Measured receipts](merge-build-cache.json).

| Step | `__QA_HOOKS__` | Cache result |
| --- | --- | --- |
| `npm run build` | false | populated PROD |
| `npm run build:qa` | true | populated separate QA |
| `npm run build` | false | restored PROD |
| `BRANCH=qa npm run build` | true | populated separate branch entry |
| `npm run build` | false | restored PROD |
| `NODE_ENV=development sh tools/build-cached.sh` | true | populated separate environment entry |
| `npm run build` | false | restored PROD |

PROD contains only `index.html` and no tested QA hook markers; QA contains `index.html`, `perf-device.html`, `preview/index.html` and all tested hooks. The check leaves PROD in `dist`; a subsequent `npm run build:qa` prepared browser validation.

## Validation

At revision `38ece0ef5`: `npm run typecheck` and `npm run lint` passed; CPU smoke passed **6 tests** (4091 unrelated tests skipped, two workers); full pooled browser smoke passed **34 tests**, zero failures/skips, across all five desktop/phone projects with one worker. Browser execution took **7.1 minutes**, within the ten-minute command cap. The pool snapshot identifies `infra-merge` on the GPU backend with one GPU Chrome root. Private preview port: **4371**, no use of 3300.

[Commands, counts and pool receipt](merge-verification.json). Detailed logs are retained in ignored `test-results/build-cache-check/`. All checks finished before this report was committed. No deployment and no new worktree copies.
