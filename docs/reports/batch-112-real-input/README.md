# Batch 112 real-input browser QA — in progress

Candidate `cc2f7476c7e7834d5060b07a2b654a5d1cb1c873` (batch 112). **No gameplay acceptance result yet.** The QA build, typecheck and lint pass. Browser execution is pending because the worktree sandbox rejects the required local preview bind (`EPERM` on `127.0.0.1:5019`); the shared browser pool is also currently unavailable. No production or playtest source was changed.

## Scope and method

Requested method: real keyboard/mouse playtest driver, ordinary mortal combat, HIGH before LOW, WebGPU, headless, one browser through `tools/e2e-lock.sh` / browser pool, ports 5019/5020. Planned L9 matrix is HIGH road ×2, HIGH shortcut ×1, LOW road ×1 with `PLAYTEST_L9_EVAC_AUDIT=1`; planned L4 tank attack view is HIGH zoom 1.5; planned broad sweep is L1/L2/L3/L5/L7/L8 at HIGH zoom 1 for about four minutes each.

The report has no in-game capture or gameplay tick to cite. The blocker is captured in the command record below and is not a product finding. No contact sheet is attached because no game frame was produced or reviewed. Raw gameplay captures therefore do not exist for this batch.

## Browser admission attempts

1. `npm run playtest -- --levels L9 --quality high --zoom 1 --l9-route road --level-minutes 8 --out test-results/playtest/b112-l9-high-road-1` completed the QA build, then tsx could not create its temporary IPC socket under the default temp directory (`EPERM`).
2. Retried the same L9 run using `TMPDIR=/private/tmp` and Node's ESM tsx loader. The preview did not become reachable on port 5019 and the launcher exited before browser execution.
3. Confirmed with a direct Vite preview startup on the required port: `listen EPERM: operation not permitted 127.0.0.1:5019`.
4. `sh tools/browser-status.sh` reports `Browser pool unavailable (fetch failed)`.
5. Retried the guarded admission wrapper with a writable temporary pool cache: `TMPDIR=/private/tmp MI_WORKTREE_CACHE=/private/tmp/mi-b112-cache E2E_PORT=5019 SCENE_PORT=5020 E2E_RESERVATION_SECONDS=60 E2E_ADMISSION_TIMEOUT_SECONDS=30 sh tools/e2e-lock.sh true`. Pool startup failed with `listen EPERM` on `127.0.0.1:4329` (and its 4321 probe); no browser launched. The pool log is `/private/tmp/mi-browser-pool.log` and is not a report artifact.

These attempts produced no gameplay evidence and do not count as coverage. Retry the ordinary guarded browser workflow if the sandbox/runtime changes before the job time box expires.

## Results

| Check | Status | Evidence / open item |
| --- | --- | --- |
| L9 HIGH road ×2, HIGH shortcut ×1, LOW road ×1; evacuation timing and 2–4 fps visual review | Pending | No browser session or capture; all four runs required |
| L4 HIGH zoom 1.5 Alpha strike/roar/slam foot planting | Pending | No browser session or capture |
| L1/L2/L3/L5/L7/L8 broad sweep, HIGH zoom 1, ~4 min each | Pending | No browser session or capture |
| Contact sheet reviewed | Pending | No gameplay frame could be captured |
| Typecheck | Pass | `npm run typecheck` |
| Lint | Pass | `npm run lint` |
| Prescribed remote unit suite | Not run | `sh tools/remote/run.sh "$PWD" -- npm test` exited 69 before test execution: no healthy Hetzner runner; local Mac fallback disallowed by runner policy. This was not a runner timeout. |

## Findings and driver gaps

No P1/P2/P3 gameplay finding is established: there are no batch 112 gameplay captures or ticks to support one. Driver gap: local preview binding is denied by the current sandbox, preventing all requested real-input checks and the contact sheet. The L9 boarding deadline, route naturalness, bridge stall attribution, L4 foot sliding, broad level glitches/appeal, and screamer arrow judgment remain unmeasured.

The JSON ledger is [qa.json](qa.json). It records the candidate, commands, validation status, and pending coverage. No raw captures were added.

## Browser access restored

The sandbox restriction was removed on continuation. The first HIGH WebGPU road run completed L9 in 221 seconds with zero skips and zero driver issues (`test-results/playtest/b112-l9-high-road-1`). Its frequent captures and evacuation census are awaiting review; this is not yet an evacuation timing or visual pass. The prescribed remote suite now passes on 46.225.66.90: 27 files, 105 passed / one skipped, full 150-case inventory, 134.9 seconds. Earlier environment failures above are historical. Remaining matrix runs, visual review and contact sheet remain pending.
