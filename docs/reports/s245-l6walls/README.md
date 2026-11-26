# s245 · L6 tunnel side walls

## Change

`tools/l6/build-layout.ts` now emits full-height collision strips along the two drawn tunnel wall faces. Each strip is 3.75 m tall (`y=.35..4.1`) and sits outside the measured inner faces at south `z=11.2` and north `z=18.8`. Six service-door apertures remain, centered on the L6 tunnel doors and 4.6 m wide. The generated `D-SUBWAY.layout.json` is produced by the layout tool.

`Companion.respawnNear` now accepts a solid-clear candidate only when `nav.visible` also connects it directly to the courier. Its existing near-point searches and admission fallback remain.

## Reachability evidence

`l6-wall-reach.ts` flood-fills the L6 **player nav grid** from the tunnel and reports mission anchors, service doors, off-footprint cells and sampled physical wall clearance. The map images show blocked cells in charcoal, reached in-footprint cells in pale gray, and any reached out-of-footprint cell in red.

| Measure | Before | After |
| --- | ---: | ---: |
| Reached cells | 20,731 | 20,323 |
| Reached cells outside authored footprint | 0 | 0 |
| South physical wall samples blocked | 94 / 180 | 180 / 180 |
| North physical wall samples blocked | 130 / 180 | 180 / 180 |
| Mission anchors and all 8 L6 door approaches reached | yes | yes |

The before image uses the committed layout; the after image uses the regenerated layout. The player-grid mask already bounded the authored playable footprint before this change. The physical collision samples show the change: both drawn wall faces are solid at every sampled point, while the door approaches remain in the same reached component.

[Evidence sheet](evidence.jpg): before and after flood maps, followed by HIGH and LOW scene captures.

At the reported respawn position `(110.18, 15.62)`, the diagnostic places the corgi at `(110.18, 17.62, 1.17)`: nav-clear and visible from the courier, inside the drawn tunnel band.

## Balance and validation

Threat audit before and after both report **zero L6-specific flags**. Each invocation also emits the expected `PARTIAL_LEVEL_SELECTION` marker because only L6 was selected.

- Baseline: `node --import tsx/esm tools/qa/threat-audit.ts --levels L6` — 0 L6 flags; 1 partial-selection marker.
- After: same command — 0 L6 flags; 1 partial-selection marker.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `tests/engine/npcs.test.ts` corgi regression: pass.
- E24 verifier via `node --import tsx/esm tools/verify.ts E24`: pass. The `npm run verify` tsx launcher cannot create its IPC pipe under this sandbox.
- Full unit suite in the verifier: pass, 27/27 files and 107/107 executed tests, 161.2 s of the 240 s budget. The test-budget scan covered 150 cases across 45 files.
- Remote unit request: no healthy Hetzner runner was available. The local suite above passed.

## Visual review

HIGH and LOW Scene Lab runs passed at game-camera zoom 1.5 with zero console errors and undrawn frames. The [evidence sheet](evidence.jpg) shows the courier on the illuminated side walkway at the drawn wall and the survivor group on the track. Both tiers preserve the visible tunnel geometry. The capture does not independently prove all movement contacts; the physical collision sampling above supplies the wall coverage evidence. Individual frames and metrics are in `test-results/s245-high/` and `test-results/s245-low/`.
