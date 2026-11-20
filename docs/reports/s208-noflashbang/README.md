# S208 — no flashbang

## Done list

- [x] Fixed full-rack pickup replacement: new non-throwable actions append and duplicates refill; only Molotov/Pipe Bomb swap within key 0.
- [x] Removed flashbang from L10 pickups, level weapon slots, input rack selectors, audio cues, and design dialogue.
- [x] Migrated legacy saves: a held flashbang becomes a Molotov in owned actions, racks, and selection.
- [x] Molotov direct blast is 90 damage (half of the 180 rocket impact), retaining 4.5 m splash and 0.6 falloff. Pipe Bomb is 270 damage, 6 m splash, 2 s fuse, 5 s cooldown, and knockdown. Pickup hint identifies throwable replacement. Melee hits interrupt grabs; cling grabs release when the courier moves clear.
- [x] Checked main for pool-driven burning status. Its current sources show burning DoT processing and separate hazard damage, but no application of `burning` status from an infected standing in a Molotov pool; the requested pool-status behavior is therefore not verified on main and may be missing.
- [x] `npm run typecheck` and `npm run lint` passed. Focused combat/save tests passed (13 tests, ≤150 suite cases). `npm run qa:threat` passed: all skilled routes completed, 0 flags. Local `npm test` passed all 106 tests (150-case budget).
- [ ] `npm run test:smoke` built successfully, then failed when the browser pool could not bind `127.0.0.1:4329` (`EPERM`) in the sandbox. Retrying with a writable cache path produced the same browser-pool restriction.
- [ ] `sh tools/remote/run.sh "$PWD" -- npm test` could not run: no healthy Hetzner runner is provisioned and the remote command is ineligible for local Mac fallback.

## Remaining `flashbang` references

The repository search was `rg -n -i 'flashbang|flash.bang' src tools tests docs/design`.

- `src/data/actions/catalog.ts`: legacy action definition retained only so old save action IDs remain known during migration.
- `src/sim/progression/Save.ts`: migration source ID; top-level and L10 resume snapshots map it to Molotov, removing duplicate rack entries.
- `tests/engine/save-progression.test.ts`: legacy save fixture and migration assertions.
- `src/assets/manifest.json` and `src/data/physicsAssets.ts`: generated manifest/physics metadata for the retired model and icon. The asset files remain orphaned and are no longer referenced by weapon slots or level data.
- `tests/fixtures/reports/ac-close-shared/evidence/verify-E28-before-vitest.json`, `tests/fixtures/reports/heap-budgets/evidence/before/L7-retainers.json`, `.../light-lab-retainers.json`, and `.../rocket-retainers.json`: archived test evidence from earlier runs; not runtime data.

No references remain in `tools/` or `docs/design/`.

## Open

Commit: `f8cfdad7` (explicit paths). Remaining gates are smoke/browser-pool startup, remote npm test/runner provisioning, and Molotov pool burning-status verification on main.
