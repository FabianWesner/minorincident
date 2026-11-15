# s133 · Courier crowd marker — work in progress

Acceptance remains open. The current ring is a depth-tested teal annulus (0.57–0.69 m), interpolated with the courier and placed 35 mm above rendered paving. It adds one mesh draw and 96 triangles while on foot, no render pass; these are structural counts, not measured frame-time results. Existing corpse persistence, zombie stats and companion appearance are unchanged.

The existing foreground treatment still uses proximity/crowd/hull triggers. This lane has not yet delivered a new occlusion-only outline. A depth-tested ground ring can still disappear behind corpses; above-corpse ordering is unproven.

## Reviewed evidence

Opened the original batch-108 L4 tick-8139 capture: the teal pack is difficult to locate among large bodies. Opened current WebGL2 L4 HIGH zoom-1 frame 60 and WebGPU L6 HIGH zoom-1 frame 60. L4 retains a visible warm courier edge but the ring is not independently conspicuous. L6 lights the courier strongly; the ring is difficult to distinguish amid feet and red warnings. These observations do not prove a 0.3-second recognition time. No matched before/after sheet is claimed yet.

Raw fixture screenshots and clipping receipts remain in ignored `test-results/s121-courierread/repro-{webgl2,webgpu}-motion/`. The JSON records available fixture results; earlier rows may precede the rendered-paving-height correction. Re-run the complete final matrix after design acceptance.

## Checks and remaining work

Typecheck passed after snapshot instrumentation. Lint passed after that instrumentation. The unchanged required remote unit command passed 105 tests, one skipped, 27 files in 127 seconds on 46.225.66.90. Browser checks use the pool, headless, one browser, ports 5003/5004.

Still required: finish marker/occlusion treatment, final complete backend/tier/zoom matrix, above-corpse/below-body review, measured draw/performance comparison, scene gate rows, real-play L4 HIGH spot via tools/playtest, matched before/after review and one small sheet. This report is a progress receipt, not acceptance signoff.

## Rejected occlusion experiment

A camera-to-torso sphere test replaced the five-nearby-body trigger. Its focused front/rear/off-axis tests passed, but the WebGL2 HIGH L4 fixture failed the existing 90% body-visibility gate. The experiment was reverted; no regression is retained. Conservative pose-aware occlusion remains open.
