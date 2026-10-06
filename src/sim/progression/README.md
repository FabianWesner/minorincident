# Campaign progression (E13)

`Campaign.ts` is pure, deterministic campaign data. Its seed and recorded weapon usage
select three prerequisite-valid cards without replacement. `beginRewards` grants fixed
story unlocks; `chooseWeapon` resolves L1/L2/L3 alternatives; `revealCards`, `pickUpgrades`
and `finishRewards` advance the persisted between-level transaction. Replays cannot
claim a completed level's rewards again. Racks have one, two, or three slots per side.

`preset('L5-default')` supplies a valid campaign for later epic tests. Headless consumers
call `applyCampaign(world, preset(...))` after constructing the survivor/combat world.
The additive test API `campaign.state()` returns a copy; `campaign.restore(save)` validates
and applies a build without writing storage; `campaign.save()` persists it; `campaign.menu()`
opens the native menu from storage. Browser consumers use `__SS__.loadLevel('L5', {progression: 'L5-default'})`. Application
materializes action definitions once, leaving the E06 catalog untouched; loadout timers,
reloads, attacks, and checkpoints consume the same definitions. Earlier-level replays
truncate equipped racks to that level's capacity without deleting the saved setup.

`SaveStore` receives a storage adapter; the browser supplies localStorage under
`minor-incident.campaign`. Version 1 stores character, seed, unlocked/completed levels,
owned actions, upgrades, racks, settings, usage, and an optional reward transaction.
No physics, health, combat timers or mid-level position is persisted. Continue restarts
an unlocked level at its briefing or resumes pending upgrade choices. Corrupt, invalid,
unknown-version, and inaccessible saves return an error result; CampaignUI displays
Start new. Version 0 compatibility renames `level` to `unlockedLevel` before validation.

E14's title/character/level menus now start or continue this same campaign. Its
pause/settings/HUD remain active during gameplay; progression hands off to
CampaignUI without a second menu or focus trap. Text size, colorblind mode and
the `auto` quality preference are validated save settings. Effective quality
also selects E08's civilian density. Loading an isolated debug scenario detaches
the campaign without removing the stored save.

Power is a weighted sum of player/action modifiers, weapon tiers and abilities. Gear
thresholds map that power to E04's existing cumulative tiers. The default seed reaches
0–4 after L1–L5. Tests enumerate all 243 upgrade paths, sample 1,000 offer seeds, exercise
save migration/reload and all input schemes, and capture five actual avatar gear tiers.
