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
`minor-incident.campaign`. Version 2 stores character, seed, unlocked/completed levels,
owned actions, upgrades, racks, settings, usage, and an optional reward transaction.
L9's crash and L10's mission resume records persist their checkpoint state. Other levels do not persist physics, health, combat timers or mid-level position. Continue restarts
an unlocked level at its briefing or resumes pending upgrade choices. Corrupt, invalid,
unknown-version, and inaccessible saves return an error result; CampaignUI displays
Start new. Version 0 compatibility renames `level` to `unlockedLevel`; version 1 migrates
to version 2 while retaining any existing world aftermath, survivor list and results.

`level.completed` immediately records rewards, the next unlocked level, and results,
before the result screen or automatic transition. L1's player-caused aftermath lives in
`world.L1` (L2 always applies the scripted burned annex and outbreak house); L5's rescued
survivor keys live in `survivors` for L6. Replays refresh these outcomes without granting
rewards twice. Missing records use the existing level defaults. Start game opens the
saved level selection when progress exists; CampaignUI's Start new starts a fresh run.

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

L9's completed crash/crawl commits `crossingHandover` before navigation: both racks and
active combat selections become fire axe only, old projectile/drop/reward state is
removed, and ordinary next-level health is restored. Lost weapon IDs and living human
passengers are history; abilities/upgrades remain progression. The protected corgi
keeps its identity at L10. Save validation uses the lost IDs only to validate historical
upgrade prerequisites, never to equip them. Finished S6 saves migrate to this transaction;
pre-finale zero-HP crash saves migrate to the driveable floor at the saved position.
Continue starts L10 on foot at `cure-crash`, with no reward or credits screen. The S7
composition reuses the authored safe crawl ground; E32's region lanes replace/extend
that opening without changing the campaign transaction.

Scene catalog for S7: `npm run scene:catalog -- --filter 'l9-crash-handover,l9-crash-axe-start' --matrix --backend webgl2` (repeat with `webgpu`). These scenes live in `tests/` to keep the
source-of-truth specs unchanged.

L10-S1: `preset('L10-default')` is the axe-only standalone entry on Level select.
Historical weapon prerequisites remain in `crossingHandover.lostWeapons`; selecting
old unlocks never equips them at R1. `levelTenMission(resolveAnchor)` exports the
seven-region ordered graph, checkpoint IDs and D1–D4 anchor contract in
`src/levels/L10/mission.ts`. Missing later anchors leave spatial goals pending and
hide their waypoint. Region builders provide anchors; encounters never spawn in
response to arsenal grants.

`arsenal` script actions add/remove entitlements and racks before tick-end checkpoint
capture. Checkpoints include the arsenal alongside entity loadout timers and existing
`chunks` / `megaPursuit` seams. `saveResume()` provides current live state plus the
last reached retry snapshot in `CampaignSave.cureResume`; `loadResume()` restores
live state after services are installed, while death restores the retry snapshot.
Game saves at checkpoint boundaries and menu/save actions using the existing
SaveStore/version 2 optional-record validation. Later finale lanes use mission items,
states and counters for cure/charge/heat/epilogue data; the snapshot preserves them.
Terminal, pickup, install, charge, boss-dead, release, epilogue and credits controllers
set the named `cureStates`; `charge-ready` must mean 3,600 eligible ticks and explicit
release is owned by S7. S1 supplies ordering and persistence, not those controllers.
Scene Lab `cureProgression` exercises the preset/graph at an optional reached
checkpoint on an existing slab; catalog names are `l10-progression-*`.
