# s134 · Courier occlusion pin

## Result

A small teal chevron with a dark edge replaces s133’s always-on ground ring. It faces the camera, holds a steady apparent size across zoom, and draws without depth testing so bodies cannot hide it. It appears during visible on-foot gameplay when the existing body/Mega overlap or nearby large-corpse trigger is active. Riding, hidden courier states and story shots suppress it. Scene Lab’s named debug camera preset is exempt from story suppression because its gameplay fixtures use that preset.

The shape is a narrow downward chevron, distinct from red warnings, yellow objectives, violet screamer rings and the gold corgi. No simulation stats or corpse lifetime changed.

## Visual verdict

Opened the full-size matched L4/L6 moving fixture frame-60 captures and calm L1 frame, then [contact.jpg](contact.jpg). Baseline is s133 `4dca98d8`, with identical fixture setup. **My verdict: pass.** In L4, the teal chevron at the courier’s hair draws the eye to her, then her outlined body. Earlier higher placements falsely associated with rear zombies and were lowered. In L6 the lit courier body is still the first eye landing; the pin adds identity. Calm L1 shows no pin and loses the old always-on ring. This is my visual recognition assessment, not a measured human reaction-time experiment.

Both backend moving matrices passed: L4/L6 × HIGH/LOW × zoom 1/1.5 × frames 1/30/60, 48 samples. Minimum courier body-mask share 1.0 WebGL2 / 0.99894 WebGPU. Masks establish visibility, not recognition speed. Also opened full-size L4 LOW z1.5 on both backends and a backend comparison of L4 HIGH z1/z1.5 and L6 LOW z1/z1.5. The pin remains readable and backend appearance is consistent.

Post-merge real-input L4 HIGH z1 spot ran 182 seconds with no skips. Opened `test-results/s134-courierpin/real-l4/captures/campaign-L4-t8129.jpg`: 90 HP, multiple large Alphas, corpses and red bars; eye lands on the teal pin at the courier’s hair, clearly identifying her. The run reached breach combat and stopped at its requested three-minute cap (exit 1, unfinished level). It logged one early empty-HUD navigation warning. This is a bounded visual spot, not level-completion proof.

## Validation and integration

- Typecheck and lint passed on merged source; existing shared render-contract suite has 14 passing cases, including calm/hidden/riding/story pin suppression.
- Required unchanged remote unit suite passed before merge: 105 passed, one skipped, 27 files, 130.5 seconds on 46.225.66.90. Final merged-source rerun also passed: 105 passed, one skipped, 27 files, 130.2 seconds on the same runner.
- Full scene gate passed 91/91 rows, plus HIGH/LOW vehicle-contact and native L9/L7/L4 motion follow-ups, exit 0. Captures and log: `test-results/s134-courierpin/gate/` and `gate.log`. This run preceded the requested main merge; the only runtime merge change is the restored corpse-distance trigger.
- Merged main at `839b4799`, including `49f06681`. `nearLargeCorpse` retains the **<4 m** large-corpse distance trigger. Requested post-merge `E2E_PORT=5005 SCENE_PORT=5006 npm run test:smoke` passed all six QA checks (including Q-208 beside a dead Alpha), public smoke, and builds in 128.2 seconds.

## Cost

Matched HIGH z1 frame-60 source-before/current counters:

| Scene | Draws before/after | Triangles before/after |
| --- | --- | --- |
| L4 dense | 127 / 128 | 340972 / 340884 |
| L6 dense | 77 / 78 | 277176 / 277088 |
| L1 calm | 68 / 67 | 47877 / 47781 |

Dense delta **+1 draw, −88 triangles**; calm delta **−1 draw, −96 triangles**. Two four-triangle chevrons replace a 96-triangle ring only while active. No new render pass. These counters establish bounded submission cost, not a universal frame-time guarantee.

## Reproduction

```sh
E2E_PORT=5005 SCENE_PORT=5006 MI_BROWSER_POOL=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/courier-mark-review.ts --baseline
E2E_PORT=5005 SCENE_PORT=5006 MI_BROWSER_POOL=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/courier-readability.ts webgl2 --motion
# Repeat with webgpu.
```

One small committed sheet and JSON below 200 KB. No deployment, push or main movement.
