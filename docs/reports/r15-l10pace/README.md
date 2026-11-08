# R15 L10 pacing

## Done

- Fixed the 36 s navigation stall: long targets now receive reachable intermediate navigation targets.
- Put all six retained weapon finds on the walking route, with world/minimap guidance, visible rings and physical pickup triggers. The first rifle is collected at 37.40 s.
- Added walking-distance checkpoints: first at 26.78 s; maximum route spacing 200.0 m low / 200.2 m high.
- Rebuilt the shipped farm ground and restored generated corn/vignettes. The PO's exact `(858.66,-93.68)` now samples dry khaki ground; assembled production scenery includes 236 corn blocks.
- Added small encounters, warned ambushes and usable courier-width escapes. The persistent Mega follows around those gaps; native crossings demonstrate regained separation.
- Completed both native production-input routes, seed 42, zero deaths, six finds each. Longest content gaps: **25.75 s low / 24.25 s high**. Installation: **879 / 883 s**; credits complete: **1110.58 / 1114.67 s**.
- Reviewed every L10 acceptance row, story beat and Mega rule before fixes, after finds, and after pacing fixes: [acceptance review](ac-review.md). Final successful route receipt: [native low/high](evidence/final-native.json), gameplay source `59587da4`; historical steps are preserved.
- Added Mega phases, machinery stun/back weak point, flame armour counter, real corpse throws, console pressure and phase retry/charge retention. Latest targeted production-mechanics run passes **20/20 checks**: [receipt](evidence/mega-mechanics.json).
- Verified 14 deliberate native checkpoint deaths across all seven regions and both tiers, retaining inventory/cure/Mega continuity: [recovery receipt](evidence/recovery-native.json).

- Latest full native low/high runs pass with **zero deaths**, 9/8 actual scares and content gaps 25.75/24.25 s. The platform exit uses the shipped stair anchors; a raised dead Mega cannot seal the stair.
- Final E32 verification on the current gameplay source passed with two Vitest workers: typecheck, lint, **106 unit tests passed, one skipped**. [Receipt](evidence/e32-checks.json).
- Exact dog/minigun contracts and stationary-ground pressure checks pass; all **20 Mega mechanics checks** pass.

- Optional porch-toy routes now also complete on **both tiers with zero deaths** (1136.27 /1140.57 s), actual toy pickup at 130.48 /130.72 s, and the same healthy corgi present through thanks/completion. [Receipt](evidence/optional-final-native.json).

## Open

- The literal animated Mega climb from the river wreck remains unverified/unimplemented as a presentation beat. Persistent pursuit and the later real platform climb are verified separately.
- The older scare-only 60–120 s interval is not uniformly met (including safe-hangar time); the required overall content cadence passes. L10-04 remains a strict whole-row FAIL in the review.
- Existing global fixture G-24 fails because healthy distant Alphas receive a mandatory bar. All L10-specific contract checks pass; this broader bar policy remains open.

## Browser QA needed

No browser was launched, as required by the brief. Full visual acceptance remains open:

- Walk the dry farm approach, including the PO's exact location; inspect corn density, night readability and route framing.
- Confirm all six finds and world markers are conspicuous while following story objectives; inspect their farmhouse/barn/shed/workshop/tower contexts.
- Read the barn roof text and three graves; inspect restricted-zone warning/searchlight composition.
- Inspect hangar cast, dialogue staging, arsenal/flamethrower handover, Mega ground slam, machinery weak-point glow, flame counter and platform combat.
- Review cure-wave continuity, survivor identities, sunrise/phone/panorama framing and full-map rendering performance.
- Review hymn, credits/licences, skip/menu behaviour and the conditional corgi-toy shot.

## Reproduce

Heavy checks use the remote pool; there is exactly one command separator before the executable:

```sh
sh tools/remote/run.sh "$PWD" --pull test-results/l10-pacing/final.json \
  --env L10_PACING_MAX_SECONDS=1800 --env L10_PACING_ACCEPTANCE=1 \
  --env L10_PACING_ENFORCE=1 -- node --import tsx/esm tools/qa/l10-pacing.ts \
  --out test-results/l10-pacing/final.json
```

Additional native tools: `tools/qa/l10-ground.ts`, `l10-recovery.ts`, `l10-mega.ts`, and `l10-contracts.ts`. Controlled setups in mechanics receipts are labelled and are not substituted for full-route delivery evidence. Nothing was deployed or pushed.
