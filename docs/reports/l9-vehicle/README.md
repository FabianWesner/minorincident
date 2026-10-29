# L9 vehicle: Q-238 / Q-239

## Q-238: streaming fixture drives off its road

The original `qa-l9-q3-stream-retire` trace is straight and stable until frame 1575 at (357.84, -330.14), where the APC hits `prop.garden-bush-small:3319/geometry-0` (bounds x=360.69..361.96, z=-329.08..-327.72). The road turns at (350, -330), but the fixture kept driving straight to (450, -330). This is a real collision with verge dressing, not a streaming physics step or lost ground. `SimWorld.loadComposition` already installs a full-district permanent ground plane.

The fixture now drives the same 520 m on the straight road segment from (-270, -330) to (250, -330), with the same 4,200 frames and three infected at the same positions relative to its start. Streaming retirement, LOD swaps, nearby crowd, and every inherited limit are retained. No runtime handling or threshold changes. Headless pooled WebGL2 high: slip **80.1° → 0.4°**, limit **20°**, no console errors. See `stream-checks.json`; full traces/sheets are in `test-results/l9-vehicle/{baseline,stream-fixed}`.

## Q-239 and release checks

The reported lamp is `prop.street-lamp:3780` at (185.152, -21.812). The headless keyboard probe starts at (186, -10), yaw 90°, then holds W for 300 ticks, W+D for 180, and S+A for 180. Before the fix, it catches the APC against this lamp and the adjacent bush: ticks 120–240 stay near (186.4, -18.8) at 0.13–0.17 m/s. The contact probe identifies the lamp by its collider centre. Reverse can recover it, but the pole obstructs the intended bypass. Before/after images were opened and reviewed (`captures/`); no console errors.

The existing tree/pallet clearance pass now also excludes street lamps from the driveable strips between each authored route and its detour. The deterministic layout rebuild removes 21 lamp placements, including :3780. Every remaining placement, route, anchor, surface, collider metadata entry, and terrain geometry hash is identical; the base GLB is rebuilt to match. No vehicle handling, collision thresholds, or playtest driver changes. In the matched post-fix probe the lamp contact is absent; deliberately driving farther into the hedge still stops the APC and reverse remains functional. `lamp-checks.json` retains the contact samples and exact layout diff.

## Verification

- `qa-l9-q3-stream-retire`: **6/6** WebGL2 high/low × zoom 0.5/1/1.5, every case slip **0.4° ≤ 20°**, 520.921 m achieved, 4,200 frames, zero console errors. `stream-matrix.json` holds the measurements. The contact sheet was opened: road, wheels, APC body and headlight pools remain visible across the drive and final braking pose (`captures/stream-retire.jpg`).
- Three full headless real-input L9 playtests using the unchanged driver and route: **136 / 184 / 162 s**, all finished, **0 issues, deaths, skips, or assists**. Female/low/zoom 1.5; male/high/zoom 1; female/low/zoom 0.5. Ordinary collision/reverse recovery remains enabled. Summaries: `real-input.json`; full observation logs: `checks/run-*.jsonl.gz`.
- `npm test`: **107/107**, 25 files. No new test cases. `npm run lint` and `npm run typecheck`: pass. Receipts in `checks/`.
- Route warm-accent coverage is identical before/after: road 317/318, countryside 265/274, dry shortcut 219/222 samples (`light-coverage.json`). This is the existing 16 m / 5 m sampling diagnostic, not a new acceptance threshold.
- `npm run scene:gate`: **48/48**, zero known failures or unrun rows, 5.8 min; `checks/scene-gate-{summary.md,state.json}` and `scene-gate.txt`.
- `npm run test:smoke`: **6 QA + 1 public-build checks pass**, **128.9 s / 240 s**; `checks/smoke.txt`. Public build exposes no QA hooks.
- All owned checks are terminal. `completion-audit.json` verifies every requested result on `lane/l9-vehicle`.

Reproduction (shared browser pool, headless, ports never 3300):

```sh
npm run layouts:build -- D-CROSSING
npm run build:qa
SCENE_SERVER=preview SCENE_PORT=33946 npm run scene:catalog -- --filter qa-l9-q3-stream-retire --matrix --jobs 1 --backend webgl2
E2E_PORT=33951 npx tsx tools/playtest/play.ts --levels L9 --quality low --level-minutes 6 --no-skip --out test-results/l9-vehicle/run-1
E2E_PORT=33952 npx tsx tools/playtest/play.ts --levels L9 --quality high --zoom 1 --heroine male --level-minutes 6 --no-skip --out test-results/l9-vehicle/run-2
E2E_PORT=33953 npx tsx tools/playtest/play.ts --levels L9 --quality low --zoom 0.5 --level-minutes 6 --no-skip --out test-results/l9-vehicle/run-3
npm test
npm run typecheck
npm run lint
SCENE_PORT=33948 npm run scene:gate -- --out test-results/l9-vehicle/scene-gate
E2E_PORT=33960 npm run test:smoke
```

Implementation commits: `25df02671` (Q-238), `ca1a45376` (Q-239). No changes to `specs/`, vehicle physics/handling, the playtest driver, or the authored routes.
