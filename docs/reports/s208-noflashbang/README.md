# S208 — no flashbang

## Done list

- [x] Fixed full-rack pickup replacement: new non-throwable actions append and duplicates refill; only Molotov/Pipe Bomb swap within key 0.
- [x] Removed flashbang from L10 pickups, level weapon slots, input rack selectors, audio cues, and design dialogue.
- [x] Migrated legacy saves: a held flashbang becomes a Molotov in owned actions, racks, and selection.
- [x] Molotov direct blast is 90 damage (half of the 180 rocket impact), retaining 4.5 m splash and 0.6 falloff. Pipe Bomb is 270 damage, 6 m splash, 2 s fuse, 5 s cooldown, and knockdown. Pickup hint identifies throwable replacement.
- [ ] Verify burning status in the molotov pool on main (s202 fire implementation is not in this worktree).
- [ ] Run final typecheck, lint, focused tests, smoke, threat QA, and remote npm test.

## Remaining `flashbang` references

The repository search was `rg -n -i 'flashbang|flash.bang' src tools tests docs/design`.

- `src/data/actions/catalog.ts`: legacy action definition retained only so old save action IDs remain known during migration.
- `src/sim/progression/Save.ts`: migration source ID; top-level and L10 resume snapshots map it to Molotov, removing duplicate rack entries.
- `tests/engine/save-progression.test.ts`: legacy save fixture and migration assertions.
- `src/assets/manifest.json` and `src/data/physicsAssets.ts`: generated manifest/physics metadata for the retired model and icon. The asset files remain orphaned and are no longer referenced by weapon slots or level data.
- `tests/fixtures/reports/ac-close-shared/evidence/verify-E28-before-vitest.json`, `tests/fixtures/reports/heap-budgets/evidence/before/L7-retainers.json`, `.../light-lab-retainers.json`, and `.../rocket-retainers.json`: archived test evidence from earlier runs; not runtime data.

No references remain in `tools/` or `docs/design/`.

## Open

Threat QA route completion and remote suite remain unverified. The explicit-path commit is pending final checks.
