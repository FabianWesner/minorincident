# s190d: fixed start racks and L9 leaper motion

Merged main (including its reverts), then restored the fixed level start racks and the 150-case checkpoint test fold. The rack table is identical to `9ab49474`.

The L9 HIGH campaign gate reproduced a 32 cm planted-foot slide beginning at frame 6344 for leaper 872. Its scripted pounce windup set `thrownBy` to freeze its AI, but left its locomotion response active. The cleanup brake continued moving it through the crouch. Separation and final collision correction were both zero in the captured frames. Resetting the response when the scripted actor freezes matches the ordinary special-attack entry and stops that residual movement; the authored flight remains in control afterward.

Validation at `7bded137`:

- `SCENE_PORT=5131 npm run qa:vehicle-campaign-motion`: pass, all L9, L7 bus, L4 parked and L4 tank cases on HIGH and LOW. L9 HIGH maximum grounded slide 6.4 cm, LOW 2.9 cm. All eight receipts share source hash `82094bf031c8c505a51a7c5d3edf4d8fa67a2e8671f183678f7ade50409a4423`.
- `SCENE_PORT=5131 npm run qa:vehicle-motion`: pass.
- `npm run typecheck` and `npm run lint`: pass.
- `npx vitest run tests/engine/save-progression.test.ts tests/engine/vehicles.test.ts --maxWorkers=4`: 2 files, 8 tests pass.
- `sh tools/remote/run.sh "$PWD" -- npm test`: pass in 208.2 s / 240 s; budget 150 / 150 cases, 45 / 45 files; 105 passed and 1 skipped in the default Vitest project.
- `npm run qa:threat -- --levels L9`: skilled and passive routes complete, zero L9 flags. Exit 1 is the audit's `PARTIAL_LEVEL_SELECTION` diagnostic flag, since this invocation selects only L9; it is not an L9 finding. The report notes L9-03 camera visibility is not measured by this harness.

No motion threshold, fixture, gate script, zombie stats, or rack table was changed by this fix. Corpses remain persistent.
