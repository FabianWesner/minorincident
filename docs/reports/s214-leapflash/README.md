# s214 — Mega leap landing flash

## Change

The Mega leap landing no longer emits the generic `explosion` VFX event. That event triggered a camera-wide white pulse and a large fireball treatment. The existing `mega.move-impact` event now drives the leap presentation: a 4 m ground shockwave ring, local dust and debris, and a short camera shake. It is restricted to `alpha.pounce`; other Mega move impacts do not receive this cue. The 0.9 s shadow telegraph, landing hit and knockback resolution are unchanged.

Regression coverage in `tests/engine/infected-ai.test.ts` checks that a leap still deals its expected damage and emits one move-impact event, and that it emits no generic explosion VFX event.

## Checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npx vitest run tests/engine/infected-ai.test.ts --configLoader runner`: passed (5 tests).
- `npm test` (local fallback): passed (27 files, 106 tests, 119.3 s; budget 240 s).
- Remote `sh tools/remote/run.sh "$PWD" -- npm test`: unavailable; no healthy Hetzner runner. The prescribed local `npm test` fallback passed.
- Scene Lab: all eight HIGH/LOW rows passed their configured gates, using the original L4 day lighting and L10-night lighting at zoom 1 and 1.5, WebGL2, 144 frames. Captures are under `test-results/s214-{before,after}-{high,low}`.

## Visual review and measurement

[Comparison sheet](comparison.jpg) shows the HIGH and LOW day sequences before and after. Before, frame 96 has a pale veil over nearly the whole screen; after, the ground and Mega remain visible, with a subtle expanding ground ring in the later frames. The night LOW sheet likewise retains the ground at landing. The landing sits near the lower edge of this authored camera, limiting the view of the impact. Scene Lab disables camera shake, so these captures cannot assess shake. The original s187 contact sheet is absent from this checkout.

At frame 96, the maximum fraction of pixels with Rec. 709 luma >= 230/255 across the eight fixed screenshots was **0.033%** (full 1280 × 720 image). This brightness threshold does not capture the grey veil: the baseline maximum was only 0.037% despite the visible wash, so this metric alone does not prove the 15% visual coverage limit. The before/after comparison shows the global veil removed in the sampled frame; intermediate frames and other camera positions remain unmeasured.

## Commit

`597ffa4d` — `fix: keep mega leap landing flash localized`

## Centered landing follow-up

A second capture matrix centers the camera on the landing point, at the same game-camera zooms 1 and 1.5, both tiers and L4 day / L10-night. All eight Scene Lab rows passed. The HIGH day sheet shows the warning ring through frame 52, the Mega arriving, and a ground ring expanding from frame 100 through 120. The ground remains visible throughout; dust and debris are subtle at this scale. Scene Lab disables camera shake, so shake remains unreviewed visually.

For the full 1280 × 720 screenshots at frames 88, 92, 96, 100, 104 and 108, the largest fraction with Pillow grayscale brightness >= 180/255 was **0.0631%** (night, zoom 1, LOW, frame 96; HIGH also rounds to 0.063%). This is a brightness measurement, not a direct segmentation of the grey veil; it includes naturally bright scene pixels. The sampled centered images show no screen-wide veil. Captures and sheets: `test-results/s214-center-{high,low}`. Intermediate frames and shake remain unreviewed.
