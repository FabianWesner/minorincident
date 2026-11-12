# S70 armored infected HP

## Change

The PO finding was that armored infected took too many landed hits. Their shared definition was 400 base HP, multiplied by `INFECTED_TOUGHNESS = 1.5` at spawn (600 HP in the L9 fixture). I changed the global infected definition and the combat balance profile to 160 base HP. This produces 240 spawned HP in every level. No level-specific stat override exists for `infected.armored`.

The directional plate in `Damage.ts` remains unchanged: front bullet damage is halved; side and rear bullets take full damage. Thus the new rear/side effective HP is 240 (4× a 60 HP ordinary runner), and front effective HP is 480, close to the 450 HP scaled brute profile. Explosives and status damage continue to bypass the plate.

`ttkBands` has 27 armored cells. I recomputed those cells for the 0.4 HP ratio while retaining each band's existing timing tolerance. For the standard bands, `[max(0.01, 0.8T - 0.25), 1.2T + 0.25]` becomes `[max(0.01, 0.8 × 0.4T - 0.25), 1.2 × 0.4T + 0.25]`; since the original bounds encode T, this is `max(0.01, 0.4 × low - 0.15)` and `0.4 × high + 0.15`, rounded to hundredths. The rocket-launcher row follows its explicit `ceil(HP / (180 × (1 - armor)))` formula and is now `[0.55, 1.45]`. No other archetype's band changed.

The separate `infected.alpha` armored variant uses Alpha HP and its own bullet resistance; it is not the `infected.armored` archetype. I left that distinct Alpha archetype unchanged. The armored archetype has no additional heavy-role, level-tier, or Alpha HP source.

## s69 fixture rerun

Command: `node --import tsx/esm tools/qa/diag/s69-isofixtures.ts` (seed 1, L9 horde arena, 1.5× infected toughness). Ordinary control is a 60 HP runner.

| Weapon | Ordinary | Front | Front ratio | Rear | Rear ratio | Side | Side ratio |
|---|---:|---:|---:|---:|---:|---:|---:|
| Handgun | 3 | 24 | 8× | 12 | 4× | 12 | 4× |
| Assault rifle | 3 | 19 | 6.33× | 10 | 3.33× | 10 | 3.33× |
| Army MG | 5 | 35 | 7× | 18 | 3.6× | 18 | 3.6× |
| Shotgun | 1 | 2 | 2× | 1 | 1× | 1 | 1× |

Counts are centered landed shots to kill, not spread-miss estimates. The flank results meet the ≈4× ordinary target for single-projectile weapons; shotgun pellet damage crosses HP thresholds in whole-shell increments.

## Threat audit

`node --import tsx/esm tools/qa/threat-audit.ts --levels L4,L6,L7,L9` was run before and after the change. Per-level flags remained equal to the main baseline and did not increase:

| Level | Before | After |
|---|---:|---:|
| L4 | 4 | 4 |
| L6 | 0 | 0 |
| L7 | 2 | 2 |
| L9 | 0 | 0 |
| L8 | 0 (main baseline) | 0 |
| L10 | 0 (main baseline) | 0 |

Armored also spawns in L8 and L10; a second audit of those levels completed with zero level flags (its only flag was the partial-selection sentinel). L7 was included as requested although its authored Alpha mix uses the distinct Alpha archetype.

The selected-level run exits 1 for its six existing level flags plus the `PARTIAL_LEVEL_SELECTION` diagnostic sentinel (7 acceptance fail flags total). L4 high-hold still completed. No encounter composition, timing, or placement compensation was needed.

## Validation

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test:unit` — passed, 27 files / 107 tests.
- `git diff --check` — passed.
- `sh tools/remote/run.sh "$PWD" -- npm test` — passed on runner 46.225.66.90: 27 files, 106 passed / 1 skipped, 196.8 s within the 240 s budget; collection 150/150.
