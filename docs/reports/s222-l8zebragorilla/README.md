# s222 — zebra and gorilla fights

## Feel notes

- **Zebra herd:** Read the shared hoofbeat tell and clear the dust lane as the herd commits. The fence makes its pass turn into a slowed straggler window; watch behind you for the separate rear kick. Each animal now has 360 authored HP, so a single close shotgun blast cannot erase a zebra.
- **Gorilla:** Interrupt the chest beat to earn a stagger window. If it completes, the gorilla enrages and its later attacks hit harder. Break line of sight for the ledge barrage, leave the pound radius, and punish after the slam or bluff stop. Its authored HP is 1,200. The close grab-and-slam is distinct from the ground-pound, and its throw barrage starts from a short climb to the house ledge before it drops back into the duel.

## Evidence

- `tests/nightly/mission-interactions.test.ts`: passed after moving per-cage story latches into serialized L8 state.
- `npm run typecheck`, `npm run lint`: passed.
- Full `npm run qa:threat`: completed in 537.1 s, exit 1 with 4 acceptance flags, all from L8 passive measurements. The passive kiting probe had 0 landed hits while retreating; follower IDs 387 and 354 were below the pace floor. The full report is in ignored `test-results/qa-threat/README.md` and `audit.json`. A separate circular-policy L8 probe landed 1 hit in 20 s and cleared the kiting threshold, but was not substituted into the required default run. The L8 skilled receipt completes, with additional local flags for escape reachability, follower 354, and the tunnel-breach first-attack window. Global zero-flag acceptance remains open.
- `tests/nightly/mission-interactions.test.ts`: passed on the latest source. The separate `tools/qa/l8-boss-proof.ts` cue probe remains failing at its `escape.status === 'active'` assertion before reaching the animal proofs.
- Full remote unit suite: passed (27 files, 105 tests, 1 skipped; 201 s). An initial run exposed generic gorillas selecting the arena-only grab; the generic selection was corrected before the passing run.
- D-ZOO rebuild: `npm run layouts:build -- D-ZOO` succeeded after the filesystem restriction was lifted, producing the layout JSON and GLB.
- Habitat diagnostic: HIGH first, then LOW, native WebGL2/Metal at zoom 1 (teleported paused courier, seed 1). The [contact sheet](habitat-review.jpg) shows both views are too dark to assess the habitat: zebra ground appears nearly black with the herd clipped at the edge; the gorilla view shows trees and crates but little recognizable enclosure structure. This is a failed visual review, not acceptance. Capture framing, night readability, and the full move tell/hit review remain open.

This report records implementation intent and current validation only. It does not claim capture review or full acceptance.

- Subsequent habitat pass: the visible arena floor uses savanna and earth palette colors, with a broken rail and blood trace by the zebra paddock and a dropped rifle and blood trace in the gorilla house. HIGH then LOW zoom 1 recaptures show the floor tint change, but both remain dark and the traces are outside these views. `node --import tsx/esm tools/qa/l8-habitats.ts` fails its existing 60-second breach assertion; it did not validate the habitats. Full story pieces and visual acceptance remain open.
