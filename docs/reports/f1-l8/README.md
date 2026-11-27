# L8 acceptance repair

Fresh acceptance receipts are under `docs/reports/fix51-verify/` for both tiers, generated on the current worktree source. The current result is partial: G-16 and G-21 pass, while G-13, G-22 and L8-06 remain open.

## Measurements

| Row | Orchestrator baseline | Latest low | Latest high | Result |
|---|---|---|---|---|
| G-16 opening rack | Rocket launcher absent from observed rack; PO requires the six weapon set | Six exact weapons, including rocket launcher | Six exact weapons, including rocket launcher | Pass in both tiers; breach surrender remains later in the level |
| G-21 arena checkpoint restore | Arena restore returned fists/kick instead of saved racks; follower 355 HP also mismatched | All 15 checkpoint death clauses pass, including arena-lion, gorilla and elephant | All 15 checkpoint death clauses pass, including arena-lion, gorilla and elephant | Pass in both tiers |
| G-22 breach cohort | Low cohort admitted 2, with no courier windup within 20 s | Stationary breach cohort: 10 admitted; first attack 75.75 s | Stationary breach cohort: 19 admitted; first attack 70.05 s | Still fails the 20 s windup target; initial entrants get delayed or killed before attacking |
| L8-06 reachability | Minimum bounded-path reachable share 0% in both tiers | 14.29% minimum | 0% minimum | Still below the fixed 90% target |
| G-13 escort pace | At least one follower was below 0.95× group median | Worst observed ratio 0.8473 (ID 389) | Worst observed ratio 0.9104 (ID 381) | Still fails in both tiers |

## Causes found and changes

- **G-16:** The initial rack was surrendered from `LevelEightZoo.begin()`, before the ordinary opening observation. Surrender now occurs at the perimeter breach. The opening receipt and progression test confirm the rocket launcher is present until then.
- **G-21:** Arena checkpoints were captured before the arena transition and its gate/follower state settled. Capture now occurs after phase setup. Mortal restore fixtures pass all checkpoint cases in both tiers.
- **G-22:** The north gate spawn at z=86.5 is outside the spawn director's safe area. Moving the gate to z=80 admits the north cohort. The remaining issue is physical approach and allied fire: entrants have not made a courier attack windup in 20 seconds.
- **L8-06:** The worst samples place infected in animal enclosures near fixed fence/cover geometry. The gorilla throw-rock collider and some west fence panels were removed, and its climbing frame was moved away from the active lane. The worst sample then shifted to the lion enclosure; other enclosure paths remain too long or disconnected under the bounded-path check.
- **G-13:** The L8 follower controller routes the group separately from ordinary survivor movement, but some followers still lose pace during escort. Current low/high receipts identify slow followers in the escape phase; the movement change so far has not brought all medians above 0.95×.

Files changed: `src/data/l8Bosses.ts`, `src/levels/L8/layout.ts`, `src/render/L8Gates.ts`, `src/sim/ai/InfectedSystem.ts`, `src/sim/missions/L8BossArenas.ts`, `src/sim/missions/LevelEightZoo.ts`, `src/sim/outbreak/Allies.ts`, and `tests/engine/save-progression.test.ts`.

## Validation and remaining work

- `npm run qa:accept -- --level L8 --skip-browser --tier high`: completed; 1 failing row, L8-06. G-16/G-21 pass. Current G-13/G-22 numeric results are in `global.json`.
- `npm run qa:accept -- --level L8 --skip-browser --tier low`: completed; 1 failing row, L8-06. G-16/G-21 pass. G-13 and G-22 remain below target.
- `npm run typecheck`, `npm run lint`, and `npm test -- tests/engine/save-progression.test.ts --maxWorkers=4`: pass; focused test has 7 passing cases.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L8`: 3 total flags, including `PARTIAL_LEVEL_SELECTION` (diagnostic-selection notice); actual L8 flags are G-22 `WAVE_FIRST_ATTACK_OVER_20_SECONDS` and G-13 `SLOW_FOLLOWER:354`. It does not meet the required zero-flag gate.

Open: improve all infected routes out of the animal enclosures without excluding them from the census; get at least three north-side breach entrants to make a real courier windup within 20 seconds; and correct escort pace for every slow follower. Then rerun both acceptance tiers and threat audit against the final source.
