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
