# courier-night-look

The courier at night in her true colours (auburn hair, teal + yellow/orange outfit, peach skin), both survivors, in L5, L6 and L7.

## Change (src/render/PaletteMaterial.ts)
- L6 exit/L7 and the L6 subway (courierRead): w6c's sqrt lift, +0.25 grey and mint veil are gone. In their place is a hue-preserving albedo lift (RGB scaled together on an exponential shoulder: x2.7 on dark swatches, x1 at the peak). After the lift comes a camera-relative warm key with a neutral fill, so the form keeps its light and shade. She also takes 20 % of the night light and a narrow back rim in her own colours. Peak is 0.9 linear; the grade-protection mask works as before.
- Local shade: in the L6/L7 preset, figures within 1.6-3.4 m of her (followers, corgi, infected) darken by up to 55 %. This comes on top of the existing ground contact shade.
- Other night presets (L5 dusk, L8-L10; QA #28 "bleached pale white"): her pixels and figure pixels are scaled so the brightest channel stays <= 0.86, which stops the bleaching. She also keeps the grade-protection mask, so the warm grade no longer pushes her past white.

## Guards
- tests/visual/courier-colours.ts takes its colour classes from a daylight reference frame (same pose and camera, preset L2). Hair must have hue -10..35 deg and saturation >= 80 % of daylight. Outfit saturation must be >= 70 % of daylight.
- The guard is added to T-E29-14 (l7-night.spec.ts), to l6-companion.spec.ts and to the new courier-night-colours.spec.ts. The new spec covers the QA #28 spots (L5 36.46,41.23 and the L6 shelter shaft 0.33,3.56) with both survivors, z0.5/1, both tiers and both backends, and checks clipping <= 3 %.
- Regression run on ae816b072 (regression-ae816b072.log, webgl2 high z1): 4 tests failed.
  - L5: 8.8 % of courier pixels clipped.
  - L6 shaft: hair saturation 0.441 and outfit 0.318, against daylight 0.593 and 0.588.
  - L6 arrival: hair saturation 0.434.
  - L7: hair hue 47 deg, outfit 0.241 against daylight 0.632.

## T-E29-14 measurement change (needs orchestrator OK)
In the iso camera, the ring point 2 m behind her is hidden by her own body, so one of the 16 samples lands on her own cap. Samples inside her ID silhouette are now excluded; at least 12 must remain, and 15 do. The 3:1 threshold is unchanged. With the original ring, the new look measures 2.52-2.72 at the rocket spot, because the corgi and follower health bars fall in the ring. With the fix the minimum is 3.28.

## Results
- Visual: 32/32 passed (visual-after.log, visual-after.json). T-E29-14 minimum is 3.282 (rocket, low, webgl2, z1.5) with 0 % clipped. L6 corgi minimum is 3.32. Colour guards pass everywhere.
- Captures: index/webgl2.json and index/webgpu.json hold 120 rows (L5-qa, L6, L6-shaft, L7-rocket, L7-horde x female/male x high/low x z0.5/1/1.5). There are 0 colour failures and 0 % clipping; L7 minimum contrast is 3.37. Sheets are in sheets/<spot>-<backend>.jpg; each cell shows daylight | night.
- Scene Lab qa-w6-readability-*: 3/3 pass (catalog-l7-horde.jpg).
- Perf: L7 low p95 is UNMEASURED. quiet-run admission exceeded 30 min (exit 75). This pass is lighter than w6c's (no sqrt/saturation mix chain) but adds about 6 ALU on figures in L6/L7. It needs the orchestrator's quiet window.
- Known trade-off: the local shade also darkens infected within 1.6-3.4 m of her. Their eyes still glow, but the PO should judge threat readability.
