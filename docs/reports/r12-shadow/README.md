# R12 · Character shadows follow nearby light

Base: `c92a03b2`. Implementation is complete; browser acceptance is pending in the QA lane under the post-crash instruction **NO browsers**. No new build, worktree, dependency, specification change, push or deployment was made.

## Changes and cause

The old selector retained a lamp until the player left its pool, even when a brighter overlapping lamp became dominant. It omitted dynamic headlights and transient fires, and used circular distance for elongated light pools. Source handoffs immediately toggled shadow weights, while moon fitting could inherit the local source direction.

- Select the strongest eligible visible pool using its elliptical falloff and luminance, with hysteresis. Static lamps, work lights, vehicle headlights and sustained fires participate. Stable source IDs let moving headlights update without repeated promotions; driving uses camera focus when the courier is hidden.
- Place the local shadow camera at the physical source. Point lamps aim through the character focus; authored spotlights retain their forward aim. Fit the cone and range to the pool.
- Fade the outgoing shadow to zero, switch direction at the midpoint, then fade the incoming shadow up over **0.3 seconds total**. Only one source refreshes a shadow map. This is a sequential fade through zero, not simultaneous rendering of two maps. Existing reserved maps remain allocated where required by material graph stability.
- Restore the moon in unlit areas, including low-tier L7. Outdoor L6 permits local shadows on low; the existing underground low-tier headlamp shadow restriction remains.
- Apply the **two promotions per second** cooldown to local/local, moon/local and power-loss handoffs. An extinguished source has zero shadow weight while waiting for the next permitted handoff.

The existing render-contract test now covers overlapping dominance, source position/aim, moving IDs, fade weights, one refreshed map, moon fallback, power-loss cooldown, underground/outdoor quality behavior, visibility occlusion, elongated beams and fire removal. No test cases or budget limits were added. The small [Scene Lab fixture](../../../tests/scenes/catalog/shadow-local-light.json) stages the original lamp/courier/corgi arrangement.

## CPU validation

[Earlier passing gate and selection probe](checks.json): `npm run verify -- E25` passed typecheck, lint and **107 collected tests / 27 files**, with **150 inventory cases**. That gate preceded the final cooldown correction. Its forty-light, 3,600-tick CPU probe recorded 40 source changes, at most two changes per second, one refreshed map and 39 fades lasting 300–316.7 ms. Those are logic measurements, not rendered pixel or GPU timing evidence.

The [post-crash CPU rerun](cpu-checks.json) **passed** on `f3f7ea4f`: typecheck, lint and `npm test -- --maxWorkers=1`, sequentially through the remote runner. **106 passed, one existing skip, 27 files; 150 inventory cases / 43 files.** The test wrapper took **187.8 s / 240 s**. Reproduce with:

```sh
sh tools/remote/run.sh "$PWD" --pull test-results/r12-shadow/cpu-checks.json \
  -- sh tools/qa/r12-shadow-checks.sh
```

These are the three CPU components of `npm run verify -- E25`, with an explicit one-worker test argument. The wrapper creates an honest source snapshot only inside the disposable remote workspace for the existing review-freshness test. It opens no browser and creates no build.

## Visual evidence status

Both supplied PO screenshots were opened during the initial investigation: the courier and corgi stand above-left of a glowing lamp below-right, with long diagonal shadow streaks. The screenshots establish the reported scene; they alone do not prove which source cast those shadows.

There is **no accepted final before/after sheet**. Earlier capture attempts were interrupted by the Mac crashes or browser startup failures. The retained [failed browser receipt](measurements.json) has zero completed combinations and zero measurement rows, with a WebSocket hangup; it is not a pass. Earlier pool logs reported Chromium's macOS Mach rendezvous failure (code 141). Obsolete local thumbnail scratch was removed. No new browser attempt was made after the latest instruction.

## Browser QA needed

The QA lane owns these remaining acceptance checks:

- Open before/after captures and describe the courier, corgi and nearby infected shadows pointing away from the dominant street lamp, fire, work light and vehicle headlights. Walk through overlapping pools and drive the vehicle; verify movement does not create promotion churn.
- Verify the 0.3 s handoff visually and with rendered frames: at most two promotions/s, one refreshed shadow map, no pool-center frame luminance jump above 15%, and shadow hue 230–290°. Check powered-off and expired sources too.
- Verify moon shadows in open dark areas, particularly native L7 low; check high/low underground headlamps and outdoor L6 practical shadows.
- Cover L6–L10 and other night segments (including L5), zoom **1 / 1.5**, **high / low**, and native **WebGL2 / WebGPU** with backend fallback rejected. The authored scene fixtures are coverage aids; complete native level traversal wherever a fixture does not represent gameplay.
- Run `npm run scene:gate -- --jobs 1` using the shared build cache. Measure E18/E25 draw, geometry and GPU timing budgets in the QA lane. The CPU probe does not satisfy these checks.
- Keep only one small labelled before/after sheet, open it, record the visual findings here, and link the final compact measurement receipt. Delete raw captures and scratch afterward.

### QA producer

[Audit producer](../../../tools/qa/r12-shadow-audit.ts) and [single-pool-browser admission helper](../../../tools/qa/r12-shadow-capture.ts) are prepared but have not completed their own native validation. Run only when the QA lane authorizes browser use, one backend/tier batch at a time. Reuse its existing Scene Lab preview server/shared artifact; do not run another build or a server on 3300.

```sh
SCENE_SERVER=preview R12_BACKENDS=webgl2 R12_TIERS=high \
  node --import tsx/esm tools/qa/r12-shadow-capture.ts
# Repeat for webgl2/low, webgpu/high and webgpu/low; append with R12_RESUME=1.
```

Start without `R12_RESUME` to replace the failed receipt, then use it for subsequent batches. The producer retains compact receipts and at most one `shadow-sheet.jpg`; temporary thumbnail cells live in `test-results/r12-shadow-cells.json`. Its isolated “before” replays the original Lighting selection/source methods from `a0d4f7ba^`; it is not a full original-build capture. Obtain a full baseline through the shared cache if the QA comparison requires it. Review failures and completed combinations before accepting results. The sixty-second forty-light rendered probe currently runs on WebGL2; native WebGPU timing remains a separate QA check.
