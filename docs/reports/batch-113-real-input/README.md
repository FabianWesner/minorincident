# Batch 113 real-input browser QA — pending admission

Candidate `69562fd1ee5ba56140a8ce1f0a2f5e6b407e1c11` (PROD batch 113). This report is report-only. No source or playtest files were edited; no raw captures exist yet.

## Current state

The QA build passed with `MI_BUILD_CACHE=off npm run build:qa` because the normal cache lock is under the repository parent, outside this worktree's writable area. `npm run typecheck` and `npm run lint` pass.

No real-input run has started. The first HIGH L3 WebGPU request used `tools/e2e-lock.sh`, `E2E_PORT=5025`, and `SCENE_PORT=5026`, but browser-pool startup failed before admission: Node received `listen EPERM` binding `127.0.0.1:4329`. A retry after 30 seconds failed the same way. A further retry on the pool's documented alternate port 4328 also failed with `listen EPERM`. The pool was not listening at either health endpoint. These are environment admission failures, not gameplay evidence.

The exact requested remote suite, `sh tools/remote/run.sh "$PWD" -- npm test`, returned exit 69: no healthy Hetzner runner is running/provisioned, and the command rejected local Mac fallback. It was not rerun or reduced.

## Coverage and findings

All gameplay checks remain **NOT RUN**: L3 HIGH then LOW full level on WebGPU; L4 HIGH then LOW full level on WebGPU; L7 D-FAIR wreck framing at HIGH zoom 1.5; and approximately four-minute HIGH zoom 1 sweeps of L6, L9 and L10. No P1/P2/P3 gameplay finding can be supported until captures are collected and reviewed. See [qa.json](qa.json) for the attempt and validation receipts.

Driver gaps: browser-pool local service cannot bind under the current sandbox (`EPERM` on `127.0.0.1:4329` or alternate 4328); remote test runner is unavailable. No capture path, tick, or contact sheet is claimed. This report is incomplete and must be updated if admission becomes available within the job time box.

No deployment, push, main movement, source fix, playtest-tool edit, zombie stat tuning, or corpse removal occurred.

## Admission restored

After filesystem/network restrictions were removed, the guarded browser pool admitted HIGH L3 on WebGPU. This run is active; its raw captures and log are under `test-results/playtest/b113-l3-high/`. The unchanged prescribed remote suite now passes on 46.225.66.90: 27 files, 105 tests passed, one existing skip, 150-case inventory, 183.2 seconds within 240 seconds. Prior admission failures are historical and no longer block progress.

## HIGH L3 collected

The full ordinary-combat HIGH WebGPU run completed in 414 seconds with no skips, no assists and zero driver issues. It recorded seven deaths and 561 handgun attacks. Raw evidence is under `test-results/playtest/b113-l3-high/`. Bridge captures await visual review; completion alone does not establish bridge support or universal hitability. All other requested runs remain pending. No checks remain running.

## HIGH L4 first segment

Collected 480 seconds of ordinary HIGH WebGPU combat at zoom 1.5 without skips. The courier reached the cellar escape objective but did not finish. Three stationary warnings (#214/#328/#208, ticks 11864/11908/11941) await visual attribution; the opening empty-HUD warning is a known driver gap. On normal save continuation, the second segment restarted at the quartermaster rather than the cellar checkpoint; this repeat was interrupted. No full L4 completion is claimed. Raw evidence: `test-results/playtest/b113-l4-high/`.

Opened HIGH L3 bridge capture `test-results/playtest/b113-l3-high/captures/campaign-L3-t21652.jpg`: visible infected are on the deck, and one has reduced health. No obvious bridge sinking/floating in this frame. Universal point-blank hitability is not established.

## L6 HIGH sweep and reviewed sheet

Collected 240 seconds HIGH WebGPU at zoom 1, no skips (`test-results/playtest/b113-l6-high`). Opened tick 13543: the courier and shield read clearly against a dark tunnel; Survivor lost and group separation make escort babysitting conspicuous. Combat pressure is visible, though the courier remains at full health in this frame. No obvious geometry glitch is visible. This single frame does not establish every transient. The opening shelter wait warning and automatic four-minute cannot-finish label are driver gaps, not confirmed product defects.

Created and opened [contact-sheet.jpg](contact-sheet.jpg), showing the reviewed L3 tick 21652 and L4 tick 11864. Raw captures remain ignored. L4 stationary warnings remain provisional because truck/crowd occlusion prevents actor attribution.
