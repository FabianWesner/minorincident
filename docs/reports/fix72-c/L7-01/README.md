# L7-01 — pickup and first physical rocket PASS

The unchanged50ms quiet event gate passes after restoring the carried quality before asset loading and pipeline warm-up.

| Tier | Auto-pickup max frame | First-shot max frame | Result |
|---|---:|---:|---|
| low |49.9ms|16.8ms|PASS|
| high |50.0ms|16.8ms|PASS|

`Game.loadLevel` read the carried save quality to prepare NPCs, but did not restore it to the Quality controller. `GameUI.loaded()` applied that setting after warming assets. A carried low save could therefore warm the high-tier moon/light graph and replace it at the first playable frames. The final four-line fix restores the carried tier before that work. No authored populations, caps, damage, clocks, effects or frame thresholds change.

`quality-order-cause.json` pairs the same material ID/version, material/geometry cache keys and HDR context during loading and gameplay. The loading sun is visible; gameplay hides it and changes the dynamic key. Held-weapon swatches, height-step faces and blast materials then build again. The retained `loading-diagnostic/` is read-only node-builder logging plus short view-update timings around the same two actions. This gives a specific ordering cause, without a broad performance run.

## Physical receipt

The exclusive quiet runner admits the slot at load<3 with no foreign browser/build/Blender/Vitest work. Both contexts run sequentially through the shared headless browser pool with WebGL2/Metal. Each restores its authentic carried campaign, uses ordinary unpaused production timing and real WASD auto-pickup without E, then Digit7/ShiftLMB. The launcher starts3m from the carried exit; collection is within2.2m. No god mode, bot driver, actor/HP/mission writes, manual simulation stepping, screenshot or forced render occurs before measurement.

Every RAF interval and sampled physical input is retained in `low.json`/`high.json`, with seed/source/producer/frame-probe SHA-256. The identical event windows intersect100ms before through250ms after each actual event. There is no50.1ms tolerance. `l7-pickup-receipts.ts` recomputes both event maxima and requires current provenance, actual moving collection, no E, original pickup removed, launcher in rack and a later physical rocket event.

I personally inspected all4 final captures. Tight views show the courier holding the green launcher next to the wrecked truck, Corgi and armed followers. Wide views also show the first orange blast/shockwave among infected. HUD says Rocket Launcher with100/100HP; the briefing caption overlays the lower center. Each exact image digest and observation is in `review.json`. Every raw JPEG was deleted after inspection and hash verification. Images establish presentation; intervals establish timing.

The22 synthetic timing/mechanics/provenance fault controls pass, including50ms PASS /50.01ms FAIL. Synthetic intervals never replace measurements.

## Retained failures and rejected experiments

`initial-fail/` preserves the original uninstrumented FAIL: low749.9/233.3ms, high33.4/100ms. `diagnostic/` and `diagnostic-mask/` retain subsequent narrow shader diagnoses. `warm-attempt/` records the unsuccessful tentative renderer change (low66.7/33.4ms, high50/16.8ms), with all4 captures personally reviewed and raw images deleted. `warm-diagnostic/` confirms that trial left the same late builds. Separating loading weapon clones, adding projectile clones, and staging nearby corpse LODs were removed completely. Only the loading quality ordering fix remains in the game.

The final measurement is the first uninstrumented pair after the proved ordering fix, using the unchanged producer. The earlier failures are not discarded or selected out as a best-of sample. This is the requested narrow first-action qualification; no broad performance matrix or worst-of-N claim is made.
