# S69 isolated fixture measurements

**Measurement verdict:** the four native simulation checks now have deterministic receipts. Heavy enemies attack while being continuously shot; the APC passes the ordinary infected ram check; and the road barrier settles and remains on the ground for 60 seconds. Armored infected still exceed the specified rear-shot limit by 3–10×. LOW zoom 1.5 visual companions were captured and opened after sandbox access was restored; the native simulation supplies the numerical evidence.

## Results

All measurements come from [`measurements.json`](measurements.json), reproduced by `node --import tsx/esm tools/qa/diag/s69-isofixtures.ts`. This tool uses the native `SimWorld`, fixed seed 1, the L9 `L9-default` level and catalog weapon values. It changes no gameplay code or enemy definitions.

### Butcher and brute under continuous fire

Player began stationary; one enemy at 3 m or 6 m; actual catalog army MG (`weapon.army-mg`) or assault rifle (`weapon.assault-rifle`) damage was applied every catalog fire interval for a 10 s window. Player had 10,000 HP to keep attacks observable; enemy health was unmodified. Counts below are actual completed `infected.attack` events; wind-up completions count distinct attack IDs.

| Enemy | Start distance | Weapon | Attacks started | Landed hits | Wind-up completions | Enemy killed |
|---|---:|---|---:|---:|---:|---:|
| Brute | 6 m | Army MG | 2 | 2 | 2 | 3.22 s |
| Brute | 6 m | Assault rifle | 1 | 1 | 1 | 2.28 s |
| Brute | 3 m | Army MG | 2 | 2 | 2 | 3.22 s |
| Brute | 3 m | Assault rifle | 2 | 1 | 1 | 2.28 s |
| Butcher | 6 m | Army MG | 4 | 12 | 12 | 9.62 s |
| Butcher | 6 m | Assault rifle | 3 | 8 | 8 | 6.82 s |
| Butcher | 3 m | Army MG | 5 | 13 | 13 | 9.62 s |
| Butcher | 3 m | Assault rifle | 3 | 9 | 9 | 6.82 s |

Every case landed at least one attack under fire. This confirms the qualitative s54 result that firing does not suppress all brute/butcher attacks. It does not reproduce s54's exact rotary-minigun 15 m `0→3` / `0→7` before/after pair: that used a different weapon and range. Enemy death stops further hits in each 10 s window. `attackStarts` counts rising edges of the sim's attack state; completed-hit and distinct-ID counts are the stronger evidence for butcher's two-strike combo.

### Armored shots to kill by direction

Each entry is a deterministic, centered landed hit with the weapon's catalog damage and target yaw held at 0. “Pistol” maps to the campaign pistol (`weapon.handgun`); “rifle” maps to the assault rifle. Same-world ordinary controls use an `infected.runner`, so the ratios account for the arena's common 1.5× HP scale (ordinary 60 HP, armored 600 HP). This probe measures damage resolution, not spread misses or the chance of each shotgun pellet intersecting the target.

| Weapon | Ordinary shots | Front shots | Front ratio | Rear shots | Rear ratio | Side shots | Side ratio |
|---|---:|---:|---:|---:|---:|---:|---:|
| Pistol (`weapon.handgun`) | 3 | 60 | 20× | 30 | 10× | 30 | 10× |
| Rifle (`weapon.assault-rifle`) | 3 | 47 | 15.67× | 24 | 8× | 24 | 8× |
| MG (`weapon.army-mg`) | 5 | 86 | 17.2× | 43 | 8.6× | 43 | 8.6× |
| Shotgun (`weapon.shotgun`) | 1 | 5 | 5× | 3 | 3× | 3 | 3× |

**Failure:** all rear rows exceed the specified 2× ordinary threshold. The front remains 5–20× ordinary and merits the “extremely hard to kill” flag. Current `Damage.ts` grants half bullet damage from the front and full from side/rear; the measured HP gap dominates. No gameplay change was made.

### APC through 20 ordinary infected

The APC started at 14.4 m/s on the L9 authored road, throttle held, with 20 ordinary runners spread across four rows. The probe stopped when all 20 had registered contacts (0.25 s); it recorded a minimum contact speed of **14.487 m/s**, minimum while touching **16.2 m/s**, 20/20 contacts, **0 armor lost**, and **0 armor cost on each ram**. The APC was set up with existing mission infected removed, so incoming attack damage did not contaminate the billing result.

### Barrier persistence

An APC at 14.4 m/s hit a road barrier on the same L9 road. The APC was halted immediately after impact to isolate the prop. The barrier settled in **2.0 s**, reached a peak **12.99° tilt** and 0.823 m centre height during the tumble, and remained present with health 1 after 60 more seconds. Its bottom stayed within 0.1 mm of ground; horizontal drift over that minute was **0.191 m**. It neither floated nor sank.

## Visual fixtures and capture status

Added four isolated Scene Lab scenes at LOW, zoom 1.5: brute firing exchange, butcher firing exchange, three armored orientations, and a settled barrier pose. Added each to `specs/scenes/gate-list.json` as a small standing visual gate.

All four WebGL2 LOW visual companion scenes passed after access was restored. Opened [capture sheet](captures.jpg): upper left shows the downed brute after MG fire; upper right shows the live butcher in the firing exchange; lower left shows the armored orientations; lower right shows the barrier seated on asphalt. The barrier image is a static visual companion; its 60-second persistence is proven by native physics measurements. Earlier browser attempts failed on sandbox port/ps restrictions.

## Validation and limits

- Native measurement script completed and wrote the JSON receipt.
- Scene/gate JSON syntax and `git diff --check` passed.
- `npm run typecheck` and `npm run lint` passed on the final probe source.
- Required `sh tools/remote/run.sh "$PWD" -- npm test` passed on runner 46.225.66.90: 27 files, 106 passed / 1 skipped; 197.0 s within the 240 s budget. Collection stayed at 150/150 cases.
- Sandbox access was restored for captures and committing.
- No gameplay code, stats, thresholds, or specs criteria were changed.
