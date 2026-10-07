# E13 · Progression, Upgrades and Save

## Goal
Make the player visibly and mechanically stronger between levels, with simple and visual choices: fixed unlocks, plus **pick 2 of 3 upgrade cards**, plus a **rack setup**, plus a gear-tier change on the avatar. Campaign progress persists.

## Depends on / Enables
E06, E12 / E14, E20–E24.

## Scope
**In:**
- `UpgradeDef` (family, tier, prerequisites, modifiers, visual tags) and upgrade families from concept §10.
- A seeded offer generator (3 cards, no duplicates, prerequisites respected, weighted toward the player's used weapons).
- Fixed unlocks per level (concept §11 table).
- Modifier application into the sim (stat multipliers and action hooks).
- **Power score.**
- Gear-tier mapping.
- Rack setup screen logic (rack sizes 1/1 → 2/2 → 3/3).
- Save schema v1 in `localStorage` (campaign: character, unlocked level, owned actions, upgrades, racks, settings) with migration hooks.
- Level select for unlocked levels, and "continue".
- Progression presets for tests (`progression: 'L4-default'`) so later levels can load directly.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Options.js`](../folio-2025/sources/Game/Options.js): persistence pattern

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E13-AC01 | Offers: for 1000 seeds, every offer has 3 distinct valid cards whose prerequisites are met; the same save seed gives the same offer | unit |
| E13-AC02 | Modifiers apply: "+20% melee damage" raises bat damage by exactly 20% in `combat-arena`; "larger magazines" raises the magazine of every firearm by its defined amount | sim |
| E13-AC03 | Power score rises monotonically L1→L6 for **every** possible choice path (exhaustive over the 3-choose-2 offers per level with seeded offers: ≤ 3^5 paths) | unit |
| E13-AC04 | Rack sizes per level match the concept (L1 1/1, L2–L3 2/2, L4+ 3/3); the rack UI rejects over-filling | unit/e2e |
| E13-AC05 | Save round trip: save → reload page → `continue` restores character, unlocked level, upgrades, and racks exactly (deep-equal) | e2e |
| E13-AC06 | A corrupted or unknown-version save gives a "save could not be loaded" dialog with "start new" and never crashes; old version migration tests pass | unit/e2e |
| E13-AC07 | Progression presets `L2-default…L6-default` exist and produce valid saves; `loadLevel('L5', {progression:'L5-default'})` starts with the expected loadout | sim |
| E13-AC08 | The gear tier follows progression (tiers 0–4 reached at L1–L5 ends on the default path) and is visible on the avatar (E04-AC10) | sim/visual |
| E13-AC09 | Between-level flow: result → unlock reveal → upgrade cards → rack setup → briefing → level, navigable with mouse-only, keyboard-only, and touch (e2e per scheme) | e2e |

> **PO decision 2026-10-07:** the between-level reward UI (unlock reveal, "Pick 2 of 3 upgrades", rack setup) is removed from the flow. The data model stays (unlocks, upgrade cards, racks); after the result screen `Continue` finishes the pending phases with the old defaults (first weapon alternative, first two offered upgrades, best melee LEFT) and goes straight to the next level. L1's permanent unlock is the baseball bat. Story/next-step screens will be authored by the PO.
