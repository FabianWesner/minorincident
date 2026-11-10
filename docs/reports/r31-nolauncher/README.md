# r31-nolauncher

PO 2026-11-10: L8 is more fun without the rocket launcher ("Let's do 1."), and L9 does not need it ("it will be lost anyway at the end").

## What changed
- **Heavy-weapon list** `src/data/l8Gate.ts`: only `weapon.rocket-launcher`. It is the only heavy tier a courier can carry into L8 (flamethrower and minigun are L10 grants; no grenade launcher exists).
- **L8** `src/sim/missions/L8Gate.ts` (called from `LevelEightZoo.begin()`, before the 'sanctuary' checkpoint): at the level start the courier's launcher is removed from racks, ownership and the campaign save (`transactArsenal`). Soldier line `L8.gate-soldier` ("Heavy weapons stay at the armory. Rules of the sanctuary. …") at tick 0, HUD line `L8.gate-toast` ("Rocket launcher handed over to the armory.") 4 s later, only when something was taken. Nadia's first line moved from 3 s to 9 s so the soldier line is readable (`tests/helpers/l8Story.ts` expectation 180 -> 540). No launcher pickups/racks exist in L8 level data; shared launcher code (5 m minimum range, Pickups) untouched.
- **L9**: `campaignLoadout` never offers the launcher at level 9 (older saves keep decoding, they just lose it); `preset('L9-default')` and L8 completion (`dropSanctuaryHeavy` in `carryover.ts`) strip it from racks, ownership and selection. The burning L9 rack prop shows shotgun/MG/handgun and the launcher-slides-into-river animation is removed (`src/render/L9Props.ts`).
- **L10**: unchanged, `cureHangarWeapons` still grants the launcher. Ruiz's line (dialogue.ts + story-script.md): "...Cleaned them. Took the liberty — and one of ours."
- **Story script** updated (L8 beat 1, L9 bridge, L10 Ruiz).

## Carryover
An existing save with the launcher entering L8 loses it at the gate (world loadout + save); entering L9 it is filtered out; L8 completion strips racks/owned/selectedAction. No decode change. Asserts are in the existing "bare hands" test of `tests/engine/save-progression.test.ts` (no new test case) plus the L9 expectation of the first test.

## Browser QA needed
- L8 start, high and low, zoom 1 and 1.5: soldier subtitle at spawn, then toast line ~4 s later, then Nadia at 9 s; weapon wheel/hotbar (key 7) has no launcher; bottom toast does not overlap the objective tracker.
- L8 with the default save and with a progressed save: no launcher pickup glow anywhere; MG/shotgun fights read fine.
- L9: APC rack prop (back of the APC, and during the bridge fall) shows three guns, no launcher; hatch fight loadout has no launcher.
- L10 hangar: Ruiz line and launcher returned (hotbar 7).
