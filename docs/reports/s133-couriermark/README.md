# s133 · Courier crowd readability

**Implementation and automated checks are delivered; ~0.3-second human recognition acceptance remains pending.** No completion claim is made until that review arrives.

## Change

A small muted teal ground ring follows the interpolated on-foot courier at rendered paving height. It hides while riding/driving. It draws before retained corpses using the existing living stencil bit, so corpses yield to its footprint while living bodies and props depth-test normally. Corpses persist; simulation stats and behavior are unchanged.

The courier’s existing foreground contour is teal rather than gold, with slightly wider grazing falloff. The crowd-count trigger is replaced by conservative camera-to-head/torso body-volume overlap. Large corpses use a camera-to-lower-body segment check; existing hull/Mega handling remains. These are conservative overlap approximations, not pixel-exact occlusion queries. Corgi fallback contour retains gold; zombie materials are unchanged. No pass is added.

## Reviewed evidence

[contact.jpg](contact.jpg) is the sole small sheet: original 49f3252a render sources versus current source, identical L4/L6 HIGH zoom-1 moving fixture frame 60. Original GameView, PaletteMaterial, courierDepth and courierForeground are served by a private Vite source override; current source uses the other private server. One pooled headless browser, ports 5003/5004. Zero browser errors.

Opened the original batch-108 L4 tick-8139 complaint capture and matched sheet. L4’s original warm edge competes with clothes; the teal edge separates courier head, torso and limbs. L6 already lights her strongly and gains a smaller identity-colour improvement. The ring is largely hidden by living bodies in the tightest fixtures; the contour carries identification there. Additional corpse-heavy L4/L6 captures show surviving teal arcs, clearest around L6 feet. Raw captures are under ignored `test-results/s133-couriermark/`.

Current-source real-play: QA build passed; a 180-second standard-combat HIGH zoom-1 spot ran via `tools/playtest`, no skips. It reached breach combat and stopped at its requested sample limit (exit 1: unfinished level). One early empty-HUD navigation warning. Opened `l4-final/captures/campaign-L4-t8141.jpg`: 10/100 HP, multiple large white-bodied Alphas overlapping the courier, health bars and red warnings. Her teal silhouette is clear; the ring is covered. This supports practical utility but does not measure human reaction time. Independent recognition review was requested and remains unanswered.

## Validation

- Typecheck and lint passed. Existing render-contract suite was extended with front/rear/off-axis/hidden/dead body-overlap controls; all 14 cases passed.
- Required unchanged remote `sh tools/remote/run.sh "$PWD" -- npm test`: 105 passed, one skipped, 27 files, 132.7 s within 240 s, runner 46.225.66.90, implementation e4a7bba5.
- Current moving fixtures: L4/L6 × WebGL2/WebGPU × HIGH/LOW × zoom 1/1.5, frames 1/30/60: 48 samples pass. Minimum courier body-mask share 1.0 WebGL2 / 0.99894 WebGPU. Masks prove visibility, not recognition speed.
- Earlier full scene gate: 91/91 plus HIGH/LOW vehicle-contact and native L9/L7/L4 motion passed. Current corpse-specific rows passed 3/3. Final full-source rerun passed 91/91 with zero known/not-run rows, plus vehicle-contact HIGH/LOW and native L9/L7/L4 motion follow-ups (exit 0), output `test-results/s133-couriermark/gate-final/`. Source remained unchanged throughout its 20.6-minute run.

## Cost

Actual source-before/current comparison: L4 126→127 draws, 340876→340972 triangles; L6 76→77 draws, 277080→277176 triangles. **+1 draw, +96 triangles, no added pass.**

Quiet native uncapped Chrome WebGL2 HIGH timing completed with exclusive admission, preflight load <3 and no foreign headless browser/build/test process. Stationary fixture frame 60, 180 warm +600 measured render updates per marker-off/on side, zero errors:

| Scene | CPU median off/on | CPU p95 off/on | Frame median off/on | Frame p95 off/on |
| --- | --- | --- | --- | --- |
| L4 | 5.8 / 5.7 ms | 6.2 / 6.1 ms | 6.1 / 6.0 ms | 6.7 / 6.5 ms |
| L6 | 5.7 / 5.8 ms | 6.1 / 6.4 ms | 6.0 / 6.1 ms | 6.5 / 6.8 ms |

Median delta ±0.1 ms, p95 −0.2/+0.3 ms supports small marker cost in these samples. Geometry-off still submits an empty draw, excluding incremental dispatch cost. A separate warmed Node 160-body no-hit overlap scan measured 0.00362 ms median / 0.00491 ms p95. These are bounded measurements, not universal frame-time guarantees.

## Reproduction

```sh
E2E_PORT=5003 SCENE_PORT=5004 MI_BROWSER_POOL=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/courier-readability.ts webgl2 --motion
# repeat with webgpu
E2E_PORT=5003 SCENE_PORT=5004 MI_BROWSER_POOL=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/courier-mark-review.ts --baseline
# --corpses for retained-body variants; --webgpu selects that backend
E2E_ADMISSION_TIMEOUT_SECONDS=120 E2E_PORT=5003 SCENE_PORT=5004 MI_BROWSER_POOL=1 sh tools/perf/quiet-run.sh npx tsx tools/scenelab/courier-mark-review.ts --perf
```

The JSON contains the current matrices, comparison counters, timing receipts and bounded real-play review. One small sheet; JSON <200 KB. No deploy, push or main movement.

## Acceptance handoff

All requested implementation, matrix, real-play spot, matched visual review, draw counters, bounded native timing, typecheck/lint/unit checks and final scene gates are recorded and committed. Worktree source is stable. The one remaining unproven requirement is ~0.3-second human recognition in L4/L6: the direct review question and scheduling-session note have no answer. Goal is blocked on that assessment; no more unchanged test reruns can supply a human reaction-time judgment. If either after view remains hard to find, identify L4/L6 and the frame so the cue can be tuned against that evidence.
