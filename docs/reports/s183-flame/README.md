# Flamethrower capture, work in progress

[Capture sheet](capture-sheet.jpg): HIGH frames 40, 46, 52, 58, 64 and 70 (0.1 s apart at 60 Hz), then LOW frame 52. Scene Lab `s183-flame-fight`, zoom 1.5, headless Metal WebGL2, seed 1. The scene has three infected and uses actual firing inputs. No console errors were recorded.

Visual review: the HIGH stream has a ragged orange outline that changes between frames, and the infected group catches fire. LOW has visible gaps near the nozzle and reads as separated blobs. The wide framing makes embers and smoke difficult to assess; closer inspection and refinement are still needed. These images do not establish release behavior, wall impacts, lighting on the courier, or WebGPU compatibility.

Reproduce: `E2E_PORT=5107 SCENE_PORT=5108 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/scenelab/s183-flame.ts`. Raw captures and runtime evidence are in `test-results/s183-flame/` after running. Performance before/after and timing: pending.
