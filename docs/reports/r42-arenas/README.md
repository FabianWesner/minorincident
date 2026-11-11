# r42-arenas: L8 gorilla fight, L8 monkey-to-zebra marker, L10 arena edge, L4 pocket flag (2026-11-11, Sonnet)

Source: `docs/reports/r41-vqa/README.md` (P2-1..P2-5, P3). No zombie/animal stat change (HP untouched), no corpse removal.

## Changes
| # | Finding | Fix |
|---|---|---|
| 1 | Gorilla deleted by the MG in ~4-7 s from the doorway, never hits | (a) `l8Route.gorilla.depth = 7`: the fight (turn + engage) starts only once the courier is 7 m inside the entry gate (marker last node moved to z -21); the dormant gorilla takes no damage (probe: 5400 ticks of MG from the doorway, HP stays 100, phase stays 0). (b) Opens with a charge-and-pound (cycle 3, 8.5 m/s approach, 42-tick telegraph instead of 60). (c) New `gorillaCover`: after losing >= 90 HP in 1.5 s while she is > 6 m away it runs behind a standing pillar on a spot her rifle line does not reach (sampled with `shotVisible`), holds ~1.5 s, then comes out with a pound. |
| 2 | Marker through the monkey house | zebra leg gets a node (-24, 19) before the exit gate (`l8Route.zebra.nodes`). |
| 3 | L10 console: no arena edge | `finale.perimeterHalf = 55`: once the Mega is within 45 m of the console a service-fence square closes (sim barriers N, S, E and the west side with a 12 m gate on the approach road so infected behind her can still enter), until the cure is released. Drawn by new `src/render/L10Perimeter.ts` (3 rails + posts, grey). State key `perimeter-up`. |
| 4 | L4 shop-shelf pocket | `InfectedSystem.seek`: a wide body within 10 m of the courier that has not closed on her in 4 s walks the admission grid for 10 s (fields `wideStuck`, `wideFallbackUntil`). New threat-audit flag `STUCK_CHASER_OVER_30_SECONDS` (`tools/qa/threat/observer.ts`): a chasing infected 2.8-6 m from the courier that does not move 0.5 m for 30 s. |
| 5 | Flamingo flights stack | each flight lands on its own ring and bearing (`callFlight`). Corgi behind the L10 railing: NOT addressed (no repro; needs a browser look). |
| - | `tests/helpers/l8Route.ts` | places the courier at `depth + 1` inside the gate (was 6 m). |

## Evidence
- Native probes `tools/qa/r42/`: `gorilla-probe.ts` (MG, real input frames, courier standing at z -22): before 3.7 s kill, 0 hits; after 7.5 s, cover duck, 1 hit landed on a stationary sprayer. Doorway (z -14) never starts the fight. `l10-probe.ts` and `l4-pocket-probe.ts` are diagnostics (headless L10 has no resident terrain; the L4 shop is a solid block natively, so the pocket could not be reproduced natively).
- Real-input fixture play (`r28-vqa-fixture-play.ts`, low WebGL, zoom 1, no god, MG, `--prefer gorilla`, l8-before-gorilla): fight started inside, gorilla in cover behind a pillar (`sheet-gorilla.jpg`, looked at), courier took 65 damage (100 -> 35), fight lasted ~16 s (ticks ~900-1900), then the run went on to the elephant. 
- l8-before-monkey (low WebGL zoom 1.5, god, follow-marker): after the monkey pack "Cross the visitor field to the zebra paddock" counted 6 m -> 4 m (new node) -> 35 m -> on, no stall (r41: 70 s / 167 s).
- l10-dispersal-console (low WebGL zoom 1, no god, kiting driver): courier stopped at the fence on x +55, z -55 and z +55 (x 4056, z -81, z 27) instead of 200-340 m out; fence drawn and lit (`sheet-l10-fence.jpg`, looked at). After the west gate change: high WebGPU zoom 1.5, 0 page errors, fence/arena looks fine. West gate lets her leave toward the approach road (up to ~75 m seen).
- l4 level:L4:line-break (low WebGL zoom 1.5, 420 s, marker): brute/riot/butcher engaged and hit her throughout; no parked heavy; one brute attacked at 2.8 m at (2.6, 36.4), the r41 pocket spot. The exact r41 situation did not recur, so the fix is unproven in that spot.
- `threat-audit --levels L4,L8,L10`: L4 flags identical to the r41 baseline (breach-west first attack, breach-north cohort, L4-06 x2); L8 0 flags; L10 0 flags with the west gate (first version without the gate flagged 2 infected walled out outside the fence plus a stuck chaser: that is why the gate exists).
- `tsc`, eslint on changed files clean. Remote `npm test`: 106 pass; the `interactions` test failed once on the first `depth` change (test helper fixed); on later full runs two tests (l4-contact, A* budget) timed out near the 240 s budget under load and pass in isolation (l4-contact + missions: 7/7).
- No layout rebuild, so no smoke run.

## Open / risks
- A stationary MG sprayer takes only one pound; a moving player takes fewer hits. Cover spots depend on pillar positions (4 pillars).
- L10 fence: infected already outside north/south when it closes are walled out (they path around to the west gate). Corgi/railing P3 and the L4 pocket in its exact geometry still need a browser re-check by QA.
- Browser QA needed: l8-before-gorilla high/low zoom 1 and 1.5 WebGPU; l10-dispersal-console high zoom 1.5 WebGPU, fence edges at the east wall; L4 retreat at (5.9, 36.4).
