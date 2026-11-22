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

- Mechanics follow-up: fixed the ledge branch so it advances the gorilla throw and completes its descent, made zebra stampede contact knock down, and require the courier to be behind a zebra before it starts the rear kick. Typecheck, lint, and mission-interactions pass; focused L8 threat audit still completes skilled L8 but reports 5 acceptance flags. Tell/hit captures and direct move verification are still required.

- Ledge probe: the first direct simulation showed the gorilla timing out while seeking ground props. Three light props were placed at the upper platform; a repeated 1,300-tick probe observed three distinct `infected.prop-thrown` events from the ledge and subsequent descent. Typecheck, lint, and mission-interactions passed. The L8-only threat audit still reports 5 acceptance flags despite skilled completion; visual tell/hit captures remain open.

- Zebra contact probe: a controlled native simulation started a stampede toward a stationary courier and observed 35 damage plus a 90-tick knockdown. This proves contact resolution only; the tell, herd movement and hit still require native capture review. Passive-route sampling showed corgi 354 tracking a 4.5 m/s courier at approximately 4.5 m/s, while soldier 387 varied through the crowded formation; the pace flags remain unresolved.

- Controlled native move diagnostic, HIGH first then LOW, WebGL2/Metal zoom 1: [HIGH contact sheet](move-diagnostic.jpg) and [receipts](move-diagnostic.json). The fixture turns each arena animal, positions the courier nearby and directly starts the move; the other zebras are forced dead for isolation, so their pile is fixture setup rather than a corpse-placement review. Both tiers show the stampede lane and a visible kick knockback; the receipts record damage for stampede, kick, chest beat, slam and pound. Gorilla tells are visually similar and dark, and the throw fixture records no hit or projectile. The ledge barrage and natural fight sequence remain unreviewed; these images do not satisfy the full capture acceptance.

- Gorilla tell fix: habitat slabs covered markers at physics ground height. Raised arena tells and the pound wave above the visible floor; chest beat uses amber, grab a forward arc, and pound a red ring. Reviewed HIGH then LOW zoom 1 controlled tell frames in [this sheet](tell-review.jpg): all three are now visible and distinct. This does not verify the natural fight or barrage hit. Typecheck, lint and render-contract tests pass.

- Slam follow-up: restored the intended 150-tick recovery (the shared gorilla cap had reduced it to 60) and added a distinct reach-and-slam pose. Typecheck, lint, and mission-interactions pass; the L8-only audit still completes skilled L8 with 5 acceptance flags. The revised pose and recovery need natural play and visual review.

- Lion story pass: at breach, a finished zoo keeper is created beside a solid feed container and stored before the breach checkpoint. A native passive route retained that body at the lion rocks; typecheck, lint and mission-interactions pass. D-ZOO was regenerated. The L8-only audit still completes skilled L8 but now reports 11 acceptance flags, including additional passive follower pace flags; visual review and threat resolution remain open.
