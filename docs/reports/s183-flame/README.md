# Flamethrower capture, work in progress

[Capture sheet](capture-sheet.jpg): HIGH frames 40, 46, 52, 58, 64 and 70 (0.1 s apart at 60 Hz), then LOW frame 52. Scene Lab `s183-flame-fight`, zoom 1.5, headless Metal WebGL2, seed 1. The scene has three infected and uses actual firing inputs. No console errors were recorded.

Visual review: the HIGH stream has a ragged orange outline that changes between frames, and the infected group catches fire. LOW now shows a continuous, uneven stream from nozzle to group after increasing its reserved cards to 24 and spacing their travel phases evenly. The wide framing makes embers and smoke difficult to assess; closer inspection and refinement are still needed. These images do not establish release behavior, wall impacts, lighting on the courier, or WebGPU compatibility.

Reproduce: `E2E_PORT=5107 SCENE_PORT=5108 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/scenelab/s183-flame.ts`. Raw captures and runtime evidence are in `test-results/s183-flame/` after running. Performance before/after and timing: pending.

Validation on source commit `515db9b4`: `npm run typecheck` and `npm run lint` passed. `sh tools/remote/run.sh "$PWD" -- npm test` passed on the remote runner: 27 files, 105 tests passed, one skipped; 201.3 s of the 240 s budget. The budget collector reported 150/150 cases. This suite does not establish visual quality or backend compatibility.

WebGPU check on source `515db9b4`: run the same command with `SCENE_BACKEND=webgpu`. The runtime reported `webgpu` for all seven captures, with 32 HIGH and 24 LOW jet cards, actual attack events and no captured console errors. I inspected HIGH frame 52: the orange stream, dark smoke flecks and fires at the infected are visible. This is a headless scene check, not a manual interactive WebGPU playthrough; release and wall impacts remain unverified.

Matched frame 52 WebGL2 comparison, same current scene and seed, with `Vfx.ts` and `Blasts.ts` loaded from baseline `3d9e12b1` via `SCENE_BASELINE=1`:

| Tier | Draw calls before → after | Live shared-pool particles before → after | Jet cards before → after |
| --- | --- | --- | --- |
| HIGH | 62 → 62 | 15 → 27 | 32 → 32 |
| LOW | 56 → 56 | 5 → 11 | 16 → 24 |

Both runs report one attack at this frame and no captured console errors. Counts include other scene effects, and are a single paused frame rather than a peak or timing benchmark. Perf timing pending. Raw JSON is generated under `test-results/s183-flame-baseline/` and `test-results/s183-flame/`.

Release probe: the fight script releases after its one-second attack. On the first run the jet vanished at frame 102 because blast expiry ran before the release handler. After extending the internal expiry to allow the handler to start its tail, the jet remains at frames 102–114 and is gone by frame 120, with no console errors. I inspected frame 108: the jet is still visibly connected to the nozzle and ground fires remain. This establishes that the tail survives and clears, but the delay from discrete attack events means the visual does not yet prove an immediate sputter on trigger release.

Release follow-up: the renderer now reads the player's effective fire button and starts the tail when it is released. In the same script the tail expiry changes at frame 96 to 1.757 s and the jet has cleared by frame 108, versus frame 120 before this change. The source is render-only; NPC jets still use their attack-event timeout. No console errors were captured.

Wall probe: `SCENE_WALL=1` adds a garden wall between the courier and targets. At frame 52 the render ray is clipped from 6 m to 2.54 m on both tiers; the inspected HIGH frame shows a bright irregular splash on the near side of the wall, with the stream ending there. Three upright cards are reserved from the existing 128-card flame pool for the splash. No console errors were captured. Raw frames are generated in `test-results/s183-flame-wall/`.

Refresh on source `2d7e4c9e`: the sheet was regenerated and inspected after the release and splash changes. The HIGH sequence shows a changing uneven orange stream and bright target-end flame; LOW remains continuous. At matched frame 52, draw calls and shared-pool particle counts remain 62 / 27 HIGH and 56 / 11 LOW. Total visible flame cards including ambient fire and the new splash are 38 HIGH and 30 LOW, versus 35 and 19 in the baseline. No console errors were captured. Timing remains pending.

Night light probe on source `2d7e4c9e`: `E2E_PORT=5107 SCENE_PORT=5108 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/scenelab/r15-flamevfx-runtime.ts` passed for HIGH and LOW. It observed one light-field transient, a 0.162 range in uploaded radiance over 12 ticks, and zero maximum muzzle gap in its 65-frame movement/turn probe. I inspected the HIGH on/off frames: the enabled transient visibly warms the ground along the stream; the courier difference is subtle at this framing. This is a single light-field footprint, not separate nozzle and stream point lights, so that explicit requirement remains open. The probe's raw images are under `test-results/r15-flamevfx/`.

Nozzle light follow-up: a second flickering light-field transient now tracks the nozzle, in addition to the stream transient. A locally adapted night probe (the R15 probe's expected transient count changed from one to two) passed on both tiers: two transients, uploaded radiance range 0.105 over 12 ticks, and zero maximum muzzle gap over the moving/turning sequence. The inspected HIGH night frame shows a stronger warm ground pool around the courier. These are light-field footprints sampled by palette materials, not Three.js point-light objects; their visual contribution on the courier is still subtle at this framing.

Release refinement: during the 0.24 s tail, pooled jet cards drop out in a stable scattered order as they fade. I inspected HIGH frame 102: a few faint broken tongues remain near the nozzle, with persistent ground fire farther away; the jet is absent by frame 108. Visible reach now oscillates at 8 Hz between 80% and 100% of the clipped range (±11% around its 90% centre). The run captured no console errors.

Puff follow-up: flame cards now use fixed emission slots recording nozzle position, direction, clipped range and birth time; each travels for 0.32 s while growing and rising. The inspected HIGH frame 52 reaches the target with a broken, irregular orange body and dark flecks. A longer 0.8 s travel trial visibly lagged the already-burning targets and was shortened. The current fight run captured no console errors. Moving/turning, wall, LOW and WebGPU need rechecking against this revision; the earlier capture sheet predates it.

Pooled-puff capture refresh on `6d42a67c`: the sheet now shows the stream building from the nozzle and reaching the infected by frame 52; LOW is irregular and continuous at that frame. The first two HIGH frames show target fires before the traveling visual reaches them, a visible consequence of unchanged instantaneous gameplay damage. The wall probe at frame 52 clips to 2.54 m and the inspected flame ends on the near side. No console errors were captured. Matched fight frame 52: HIGH 62 draws / 27 shared particles / 32 total flame cards; LOW 56 / 11 / 25. Baseline was 62 / 15 / 35 and 56 / 5 / 19 respectively. Timing remains pending.

Travel adjustment: pooled puffs now traverse their clipped ray in 0.128 s, with bounded catch-up and the same fixed slot counts. In the inspected HIGH captures the flame reaches the infected by frame 46 instead of frame 52; frame 40 still shows a short visual gap after damage has started. No gameplay timing was changed. This run captured no console errors; the committed sheet predates this adjustment and needs refreshing.

Capture refresh on `d3c6cf71`: the committed sheet now reflects the 0.128 s travel. I inspected it: the first HIGH image still shows a short gap, and the remaining frames show an irregular stream at the infected; LOW also reaches the group. Matched frame 52 remains 62 draws / 27 shared particles / 38 total flame cards HIGH and 56 / 11 / 30 LOW, against baseline 62 / 15 / 35 and 56 / 5 / 19. Timing pending. A fresh WebGPU attempt was interrupted after more than three minutes without new frames while another browser-pool job was active; no result is claimed from that attempt. The process and its server have exited.
