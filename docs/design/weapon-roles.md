# Weapon roles

Ordinary infected remain at 40 HP. These jobs are the selection hint; special damage, reach and control effects are weapon-owned.

| Weapon | Job | Damage | Reach / spread | Rate / capacity / reload | Special |
| --- | --- | ---: | --- | --- | --- |
| Fists / kick | Last resort | 9 / 18 | 1.45 / 1.5 m | 2.5 / 1.54 swings/s | unchanged |
| Bat | Shove crowds back | 22 (roundhouse 7) | 1.9 / 2.2 m sweep | 2 / 2 swings/s | unchanged |
| Fire axe | Heavy blows; sweep crowds | 56 (sweep 16) | 2.1 / 2.5 m sweep | 2 / 2 swings/s | unchanged |
| Handgun | Reliable; never runs dry | 20 | 22 m | 3 shots/s; unlimited | no reload |
| Army MG | Hold a line; bullets pass through | 14 | 26 m; pierce 1 | 10 shots/s; unlimited | each hit slows 20% for 0.5 s |
| Shotgun | Close-range panic button | 240 total across 8 pellets | 18 m; falloff after 8 m | 2 shots/s; 6 shells; 2 s reload | centre hit within 3 m knocks down for 1.5 s |
| Hunting rifle | Pick off Alphas and specials from afar | 300 | 40 m; pierce 2 | 1 shot/s; 5 rounds; 2.4 s reload | one shot per ordinary infected |
| Nail gun | Nail them down, quietly | 14 per nail; 3 nails per ordinary | 18 m | 6 nails/s; 24 nails; 1.6 s reload | pin 2 s; listed heavies 1 s; Alpha 0.5 s; refreshes; bosses immune; noise radius ≤⅓ handgun |
| Assault rifle | Accurate all-rounder with a torch | 26 | 28 m | 7.5 shots/s; 30 rounds; 2 s reload | unchanged |
| Flamethrower | Melt crowds up close | 4.5 per stream tick; 35 DPS burn | 8 m; 25° cone | 15 ticks/s; 6 s fuel; 5 s refill | burn lasts 4 s and spreads to touching infected; fire kills char bodies to permanent ash heaps over 1.5 s |
| Rocket launcher | Blow apart groups and heavies | 180 | 35 m; 6 m blast | 1.2 rockets/s; unlimited | everything in blast knocked down |
| Flashbang | Stun a crowd; break grabs | 0 | 7 m radius | 2 charges; 12 s recharge | 3 s stun; frees grabbed courier/follower |

## Sound cue plan

Weapon fire uses each action's own recorded `action.weapon.*` take and its per-action `weaponSlices` timing. Reloads use the existing recorded `weapon.reload` cue; shotgun uses `weapon.pump`. Impacts use the recorded hit material cues (`impact.body.*`) with weapon-specific tails for shotgun, rifle and rocket. The nail gun uses its own short pneumatic action take; the flame action uses a roaring loop plus ignition and sputter cues; the rifle action uses its heavy crack take and outdoor tail. The imported source and license for every recorded take remain listed in `assets/audio/imports.json`.
