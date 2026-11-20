# Weapon roles

Ordinary infected remain at 40 HP. These jobs are the selection hint; special damage, reach and control effects are weapon-owned.

| Weapon | Job | Damage | Reach / spread | Rate / capacity / reload | Special |
| --- | --- | ---: | --- | --- | --- |
| Fists / kick | Last resort | 9 / 18 | 1.45 / 1.5 m | 2.5 / 1.54 swings/s | unchanged |
| Bat | Shove crowds back | 22 (roundhouse 7) | 1.9 / 2.2 m sweep | 2 / 2 swings/s | unchanged |
| Fire axe | Heavy blows, sweeps crowds | 56 (sweep 16) | 2.1 / 2.5 m sweep | 2 / 2 swings/s | unchanged |
| Handgun | Reliable, never runs dry | 20 | 22 m | 3 shots/s; unlimited | no reload |
| Army MG | Hold a line; bullets pass through | 14 | 26 m; pierce 1 | 10 shots/s; unlimited | hits at 20–26 m slow 20% for 0.5 s |
| Shotgun | Close-range panic button | 240 total across 8 pellets | 18 m; falloff after 8 m | 2 shots/s; 6 shells; 2 s reload | centre hit within 3 m knocks down for 1.5 s |
| Hunting rifle | Pick off Alphas and specials from afar | 300 | 40 m; pierce 2 | 1 shot/s; 5 rounds; 2.4 s reload | one shot per ordinary infected |
| Nail gun | Nail them to the ground, quietly | 14 per nail; 3 nails per ordinary | 18 m | 6 nails/s; 24 nails; 1.6 s reload | pin 2 s; listed heavies 1 s; Alpha 0.5 s; refreshes; bosses immune; noise radius ≤⅓ handgun |
| Assault rifle | Accurate all-rounder with a torch | 26 | 28 m | 7.5 shots/s; 30 rounds; 2 s reload | unchanged |
| Flamethrower | Melt crowds up close | 15 per stream tick; 35 DPS burn | 8 m; 25° cone | 15 ticks/s; 6 s fuel; 5 s refill | 4 s burn spreads within 1 m and deals burn damage; butcher takes 3× fire damage; fire bypasses armored plates; firefighter takes 25%; any death while burning leaves permanent ash |
| Rocket launcher | Blow apart groups and heavies | 180 | 35 m; 6 m blast | 1.2 rockets/s; unlimited | infected in blast knocked down; existing boss and L7 follower exceptions remain open against the requested universal knockdown |
| Flashbang | Stun a crowd and break grabs | 0 | 7 m radius | 2 charges; 12 s recharge | 3 s stun; frees grabbed courier/follower |

## Sound cues

| Weapon | Attack | Reload / refill | Impact |
| --- | --- | --- | --- |
| Fists / kick | `action.weapon.fists` / `action.weapon.kick` | — | `flesh.fists` / `flesh.kick`, layered body and thump |
| Bat | `action.weapon.bat` | — | `flesh.bat`, wood body and thump |
| Fire axe | `action.weapon.fire-axe` | — | `weapon.impact.fire-axe`, metal body and thump |
| Handgun | `action.weapon.handgun` | unlimited | `weapon.impact.handgun` |
| Army MG | `action.weapon.army-mg` | unlimited | `weapon.impact.army-mg` |
| Shotgun | `action.weapon.shotgun`, `weapon.pump` | `weapon.reload.shotgun` | `weapon.impact.shotgun` |
| Hunting rifle | `action.weapon.hunting-rifle` and environment tail | `weapon.reload.hunting-rifle` | `weapon.impact.hunting-rifle` |
| Nail gun | `action.weapon.nail-gun` | `weapon.reload.nail-gun` | `weapon.impact.nail-gun` |
| Assault rifle | `action.weapon.assault-rifle` | `weapon.reload.assault-rifle` | `weapon.impact.assault-rifle` |
| Flamethrower | `weapon.flame-ignite`, `weapon.flame-loop`, `weapon.flame-stop` | automatic | `weapon.impact.flamethrower` |
| Rocket launcher | `action.weapon.rocket-launcher`, `weapon.rocket-whoosh` | unlimited | explosion beats |
| Flashbang | `action.weapon.flashbang` | automatic recharge | `weapon.impact.flashbang` |

Recorded source and license details are in `assets/audio/imports.json`. Flame loop/stop need listening review for the requested roar and sputter; the layered melee takes need an audible distinctness audit.
