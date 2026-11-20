# Flamethrower capture, work in progress

[Capture sheet](capture-sheet.jpg): HIGH frames 40, 46, 52, 58, 64 and 70 (0.1 s apart at 60 Hz), then LOW frame 52. Scene Lab `s183-flame-fight`, zoom 1.5, headless Metal WebGL2, seed 1. The scene has three infected and uses actual firing inputs. No console errors were recorded.

Visual review: the HIGH stream has a ragged orange outline that changes between frames, and the infected group catches fire. LOW now shows a continuous, uneven stream from nozzle to group after increasing its reserved cards to 24 and spacing their travel phases evenly. The wide framing makes embers and smoke difficult to assess; closer inspection and refinement are still needed. These images do not establish release behavior, wall impacts, lighting on the courier, or WebGPU compatibility.

Reproduce: `E2E_PORT=5107 SCENE_PORT=5108 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/scenelab/s183-flame.ts`. Raw captures and runtime evidence are in `test-results/s183-flame/` after running. Performance before/after and timing: pending.

Validation on source commit `515db9b4`: `npm run typecheck` and `npm run lint` passed. `sh tools/remote/run.sh "$PWD" -- npm test` passed on the remote runner: 27 files, 105 tests passed, one skipped; 201.3 s of the 240 s budget. The budget collector reported 150/150 cases. This suite does not establish visual quality or backend compatibility.
