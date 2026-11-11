# s43-l10fence

Implementation is committed. Final gameplay acceptance is still in progress.

## Result and evidence

| Requirement | Current evidence | Status |
| --- | --- | --- |
| World-consistent console edge | Concrete bases, patched steel frames/braces, hazard marks; all 8 before and 8 after rows opened, no page errors. `capture-matrix.json`, `perimeter-after.jpg` | Verified appearance |
| Same collision footprint and timing | No changes to `LevelTenFinale.ts` or `l10Finale.ts` versus lane base `3961b90f^`; renderer follows the same boxes and state flag | Verified source invariant |
| Draw increase ≤2 | Paused visibility toggles: original 2 submissions, current 2; increase 0. `draw-calls.json` | Verified high WebGPU z1.5 |
| Courier has an escape path | Native minimum north-building clearance 3.65 m (other sides ≥7.47 m); real-input route crosses it with close Mega/armored pursuit and continues into arena. God mode was used | Mortal repeat pending |
| Nadia readable at night, daytime identity retained | Final fill2 + healthy neutral tint: opened L8 night and L10-night captures. Scene Lab daylight fill1/fill2 toggle leaves Nadia region pixel-identical. `day-parity.json` | Verified sampled presets |
| No false gold x-ray at tank | Isolated same-pose high WebGPU z1.5 probe: foreground true before, false after removing redundant tucked trigger; tank lens remains active; captures opened | Verified reproduced case |
| Corgi respects railing sides | Ordinary real-input east-rail follow stays inside; forced blocked catch-up rejects unsafe destinations; clear candidate probe relocates inside with rejoining=true. `corgi-rail.json`, `corgi-rejoin.json` | Verified probes + regression assertions |
| Zombies identical, corpses retained | Lane source diff changes only rendering and Companion; no zombie stats, combat or corpse-removal changes | Verified diff |

## Checks

- Current-source typecheck passed.
- Required remote `sh tools/remote/run.sh "$PWD" -- npm test`: exit 0, 27 files, 106 passed + 1 skipped, 150/150 case budget, 161.9 s / 240 s.
- QA build and touched-file lint passed after implementation changes.
- Refreshed L10 threat audit: skilled complete, passive tick-budget, zero passive gameplay flags, 40.1 s. Its sole raw fail flag is `PARTIAL_LEVEL_SELECTION` because this diagnostic command selects L10 alone.
- No layout rebuild, no ID reshuffle; conditional layout smoke gate does not apply.
- One small committed contact sheet; raw captures remain in `/private/tmp`.

## Remaining acceptance

Run the same close-pursuer escape without god mode, audit the checklist before declaring the goal complete. The 3.65 m gap is below the brief’s example 4 m target; acceptance must rest on demonstrated escape rather than claiming that numeric target was met.

Detailed capture paths, setup limitations, failed probes and historical environment restrictions are preserved in [history.md](history.md). Browser QA may broaden angles and crowd conditions; the sampled results do not claim every possible combat configuration.
