# Q-124 / Q-125 / Q-126 / Q-127 / Q-129 — final

Q-124: Alpha boots lie flat; the side-fallen Mega retains distinct head, shoulders, arms and feet. Q-125: Alpha bars disappear at the first zero-HP frame (53). Q-127: continuous warm fog covers the departure skyline. Q-129: raised filler caps close the deck seam. All requested zooms/tiers/backends reviewed: [WebGL2 matrix](captures/matrix/webgl2/index.md), [WebGPU matrix](captures/matrix/webgpu/index.md), [48 L7 frames](captures/l7-final/evidence.json), [four runtime cases](captures/corpse-runtime/evidence.json).
Near-band corpses are **high only**, entering inside 8 m and leaving at 10 m; low retains PROD geometry. All 282 low / 363 high bodies remain. [Timing](performance/) uses three six-second samples; the table reports median p95. The reserved repeat recorded 255 host samples with no Blender; the contaminated attempt is retained as rejected. Q-126 warms the actual L2 truck occupants: [real-input profiles](profiles/after-summary.json) have L1 maxima 16.8/16.8/16.8 ms and L2 33.3/33.4/33.3 ms, zero >200 ms frames and zero new vehicle programs while boarding. The original stalls did not reproduce in the unchanged baseline.
Green: typecheck, lint, build; invariants **27 simulation + 11 browser**; remote **2,487 passed / 9 skipped**; smoke **6 simulation + 31 browser**, one browser worker. PROD A/B completed **32 stops**; [three expected Q-129 flags reviewed](ab/review.md), none unexplained. [Source hashes, red-first evidence and receipts](validation.json).

| L10 quality / retained bodies | Near band | WebGL2 p95 ms, PROD → final | WebGPU p95 ms, PROD → final |
|---|---|---:|---:|
| Low / 282 | Off | 3.3 → 3.3 | 2.4 → 2.5 |
| High / 363 | 8 m / 10 m | 3.6 → 4.1 | 3.0 → 3.4 |
