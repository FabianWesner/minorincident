# Weapon audio pass (PO bug 36, 10-15)

> "That shutgun sounds lsuper lightM not like an actual shotcun. For all weapons make sure we use proper sounds"

Before: every ranged weapon (shotgun, handgun, rifles, MGs, rocket) shared one 0.16 s synthesized noise burst; five melee swings and no sound at all
for the knife, katana, fire axe, shovel, nail bat, baton, throwables, the minigun, reload, pump or the HMG. Now every catalogued weapon id has a recorded
cue with four takes (no immediate repeat, +-1 dB gain, small pitch spread), curated from CC0 recordings through the existing pipeline.

Build: `python3 tools/audio/weapons_recipes.py <scratch dir>` (registers sources and recipes in `assets/audio/imports.json`, with URL, licence and SHA-256 of the
download and of the member), then `npx tsx tools/audio/build.ts weapons`, `npx tsx tools/credits/generate.ts`. Loudness: `npx tsx tools/audio/weapon-loudness.ts`.

## Sources (all CC0, no credit required; credited anyway in the in-game credits)

| Used for | Source | Author | Licence | URL |
| --- | --- | --- | --- | --- |
| handgun (Walther PPQ 9 mm), pistol (1911 .45, S&W 642 revolver), nail gun / firecracker (Ruger Mark III .22), shotgun (Winchester Model 12, Benelli Nova, Charles Daly pump 12 ga), SMG / turret (PPSh), assault rifle / machine gun / minigun (AK-47), army MG (AR-15, Carl Gustav M45), HMG (AR-15, Savage Model 10), hunting rifle (Tikka T3, Savage 10), rocket (Model 12 / Nova blast slowed), tails (Model 12 mid distance) | The Free Firearm Sound Library, "Prepared SFX Library" | Ben Jaszczak, Brian Nelson, Kevin Heras, Matthew Nanney (OGA user bart) | CC0 1.0 | https://opengameart.org/content/the-free-firearm-sound-library |
| reload, rifle reload, shotgun pump | gun reload sounds (gunreload1, assaultriflereload1, shotguncock) | SpringySpringo | CC0 1.0 | https://opengameart.org/content/gun-reload-sounds |
| rocket launch boom, empty click, minigun barrel whir | Residue SFX (boom.ogg, emptyclip.wav, ventilator.wav) | FacadeGaikan | CC0 1.0 | https://opengameart.org/content/residue-sfx |
| melee swings (knife, katana, nail bat, shovel, baton, fire axe), throw whooshes | Bamboo stick swooshes (already in the pipeline) | qubodup | CC0 1.0 | https://opengameart.org/content/swish-bamboo-stick-weapon-swhoshes |
| molotov glass, ground-slam thump | 75 CC0 breaking / falling / hit SFX; Kenney Impact Sounds (already in the pipeline) | rubberduck; Kenney | CC0 1.0 | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx ; https://kenney.nl/assets/impact-sounds |

Licence snapshot: `imports.json` keeps `license`, `licenseUrl`, `url`, `downloadUrl`, `downloadSha256` and member `sha256` per source (the build refuses a changed file); the licence page text of
each source was read on 2026-10-15 (the Firearm Library page states "CC0 NO RIGHTS RESERVED for this library"; SpringySpringo and FacadeGaikan pages show the CC0 badge). Rejected: q009's weapon sounds
(CC-BY-SA), SoundBible shotgun-reload files (CC-BY 3.0, would need credit and were not needed), itch.io SnakeF8 pack (not CC0/CC-BY).

## Listen-check notes per weapon

Honest caveat: an agent cannot listen. The notes below come from the source descriptions plus measurements (loudness, crest, spectrum balance, decay times). The orchestrator / PO should audition
`npx tsx tools/audio/weapon-loudness.ts` output alongside the game; per-class levels are single numbers in `tools/audio/weapons_recipes.py` (BOOST) if anything is too hot.

| Weapon | What it has |
| --- | --- |
| Shotgun | Real 12-gauge pump recordings (Model 12 x2, Nova, Charles Daly), slowed 10 %, +7 dB low shelf at 110 Hz for body, heavy saturation so the tail and low end sit close to the crack (+12 LU over the handgun). 1.1 s tail. A pump rack (shotguncock, 3 pitched takes) follows 0.45 s after each blast. |
| Handgun / pistol | Walther PPQ 9 mm / 1911 .45 / S&W revolver: a dry sharp crack with a 0.6 s natural decay, the quietest firearm class. |
| Nail gun, firecracker | Ruger .22 high-passed and sped up: a small snap. |
| SMG, turret | PPSh single rounds with a bass lift, 0.35 s so 10+ rounds a second do not smear. |
| Assault rifle / machine gun / army MG | AK-47 and AR-15 rounds; the MG is pitched down 12 % with +5 dB low shelf, 0.4-0.5 s each, saturated for density in rapid fire. |
| Rotary minigun | AK rounds at 0.28 s (20 rounds/s), plus a looped barrel whir (`weapon.minigun-whir`, Residue ventilator) that AudioService pitches (0.45 -> 1.8x) and levels from the live spin: spin-up 0.5 s, spin-down 1.2 s follow the gun. |
| HMG / door gun (ally) | `weapon.hmg`: AR-15 / Savage rounds slowed 22 % with a +9 dB shelf at 90 Hz: deeper than the army MG. |
| Hunting rifle | Tikka / Savage bolt-action crack with a 0.9 s tail. |
| Rocket launcher | Residue boom and shotgun blast at half speed with a +10-12 dB low shelf: launch blast (loudest cue, -17.7 LUFS); the in-flight whoosh loop (`weapon.rocket-whoosh`) stays synthesized (self-made); the explosion keeps its own beats. |
| Melee swings | Bamboo swishes at weapon-specific speeds: knife / katana fast and high, shovel / fire axe slow and low (heaviest), bat / baton in between; hits keep the existing flesh + body + thump layers (new weapons map to the nearest existing flesh take: knife, katana, fire axe -> machete; nail bat, baton -> bat; shovel -> crowbar). |
| Throwables | Slow low whooshes per type; molotov adds glass. |
| Reload / empty | `weapon.reload` (pistol class) and `weapon.reload-rifle` (rifle, MG, SMG) play when the player's magazine empties and the reload starts; `weapon.dry` (empty click) is a cue, not yet triggered (the sim has no dry-fire event). |
| Tails | `tail.street` (short slap), `tail.interior` (long, dark, echoed: interior and tunnel zones), `tail.open` (faint). Recorded decay of the mid-distance Model 12, played after every ranged noise event. Distance falloff, lowpass and the interior/tunnel convolution reverb are the existing graph. |

## Loudness (offline, FFmpeg EBU R128 on the shipped weapons.webm slices, padded to 1 s of silence each side)

"played" adds the cue's runtime gain (1.0 for handgun, SMG, rifle, MG and HMG cues; 0.8 for shotgun, rocket and throwables; 0.5 for melee swings and reloads; 0.6 for the pump). True peak is measured on the decoded Opus slice.

| class | cues | mean LUFS (sprite) | mean LUFS (played) | worst true peak dBTP | mean crest dB |
| --- | --- | --- | --- | --- | --- |
| melee | 29 | -28.6 | -34.6 | -5.2 | 11.5 |
| handgun class (handgun, pistol) | 8 | -29.2 | -29.2 | -4.9 | 17.3 |
| smg (smg, turret, nail gun, firecracker) | 16 | -27.7 | -28.2 | -4.3 | 14.8 |
| rifle (assault, hunting) | 8 | -28.4 | -28.4 | -5.2 | 16.2 |
| machine-gun (MG, army MG, minigun, HMG) | 16 | -27.2 | -27.2 | -3.6 | 14.8 |
| shotgun | 4 | -22.6 | -24.5 | -4.4 | 13.6 |
| rocket | 4 | -23.6 | -25.5 | -4.5 | 10.1 |
| throw | 20 | -29.2 | -31.2 | -5.7 | 12.2 |
| reload / pump | 6 | -26.5 | -31.5 | -5.6 | 15.5 |

Tested order: melee < handgun class (5.4 LU above melee, gate 3) < smg/rifle < machine-gun < shotgun (4.7 LU above the handgun class, gate 4) ~ rocket (within 3 LU); every firearm take is at least 3 LU above a punch; class crest at least 12 dB (rocket 10.1: the Residue boom is dense at the source), clip density at most 2%; no weapon cue above -3.6 dBTP (gate -1). Per-cue table: `npx tsx tools/audio/weapon-loudness.ts`.

## Tests

- `tests/unit/audio/weapon-audio.test.ts`: every action id in `catalog`, `balanceActions` and `mountedActions` has `action.<id>` and a recorded recipe (only the E05 test projectile and three support abilities are synthesized) with four takes (the five original melee swings keep one); rapid-fire cues are not anti-spammed below their fire rate; sources are CC0/CC-BY with hashes; shotgun >= 4 LU above handgun and every weapon cue <= -1 dBTP (needs ffmpeg).
- `tests/e2e/audio/weapons.spec.ts`: every ranged weapon plays its own cue plus a tail in the real graph, only the shotgun pumps, a magazine weapon plays the reload.
- E16 offline RT60 / occlusion probes now use the E05 test projectile (`src/debug/audioHarness.ts`) instead of the pistol, so changing real weapon assets cannot move the reverb measurements.
