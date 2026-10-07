# Audio stingers: procedural cue inventory and replacements

## Inventory method

Baseline: lane HEAD matched main at job start. There are 170 procedural sprite slices (including variants), each rendered as mono 48 kHz PCM WAV at `/tmp/audio-stingers-before/<cue>.wav`. `src/audio/synthesis.ts` runs in the asset builder, not in gameplay. The browser only plays encoded sprites. The only runtime synthesis is convolution noise: seven reverb presets at high/low quality (14 WAVs named `reverb.<preset>.<quality>.wav` in the same directory). These are room responses, not event tones.

Classification below is based on the rendered signal and the synthesis equations; it is not a human listening approval. Music placeholders step through eight notes per duration; voiced placeholders combine pitch drift with 5 Hz vibrato and 2–3 Hz syllable gates. Buzz uses 11/3.7 Hz amplitude dropouts, not pitch sweeps. Plain tones have no pitch modulation.

## Runtime synthesis inventory

| Response (two WAVs: high / low) | Duration high / low | When used | Pitch modulation |
| --- | --- | --- | --- |
| `reverb.street.high.wav` / `.low.wav` | 0.300 / 0.300 s | Convolution on sounds in street zone | None; exponential noise decay |
| `reverb.suburb-open.high.wav` / `.low.wav` | 0.192 / 0.192 s | Convolution on sounds in suburb-open zone | None; exponential noise decay |
| `reverb.interior-small.high.wav` / `.low.wav` | 0.540 / 0.540 s | Convolution on sounds in interior-small zone | None; exponential noise decay |
| `reverb.interior-large.high.wav` / `.low.wav` | 0.840 / 0.800 s | Convolution on sounds in interior-large zone | None; exponential noise decay |
| `reverb.tunnel.high.wav` / `.low.wav` | 1.440 / 0.800 s | Convolution on sounds in tunnel zone | None; exponential noise decay |
| `reverb.under-bridge.high.wav` / `.low.wav` | 1.200 / 0.800 s | Convolution on sounds in under-bridge zone | None; exponential noise decay |
| `reverb.park.high.wav` / `.low.wav` | 0.144 / 0.144 s | Convolution on sounds in park zone | None; exponential noise decay |

## Each procedural slice before this change

| Cue / WAV basename | Shape / duration | When it plays | Chirp or warble risk | Now |
| --- | --- | --- | --- | --- |
| `telegraph.riot` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `telegraph.firefighter` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `telegraph.armored` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `telegraph.gorilla` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `action.weapon.knife` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.weapon.nail-bat` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.weapon.shovel` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.weapon.police-baton` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.weapon.fire-axe` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.weapon.katana` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.weapon.pistol` | shot / 0.16 s | noise | Noise + bass crack; no pitch sweep | Retained physical/system placeholder |
| `action.weapon.shotgun` | shot / 0.16 s | Weapon/ability noise event; matching action | Noise + bass crack; no pitch sweep | Retained physical/system placeholder |
| `action.weapon.nail-gun` | shot / 0.16 s | Weapon/ability noise event; matching action | Noise + bass crack; no pitch sweep | Retained physical/system placeholder |
| `action.weapon.smg` | shot / 0.16 s | Weapon/ability noise event; matching action | Noise + bass crack; no pitch sweep | Retained physical/system placeholder |
| `action.weapon.hunting-rifle` | shot / 0.16 s | Weapon/ability noise event; matching action | Noise + bass crack; no pitch sweep | Retained physical/system placeholder |
| `action.weapon.assault-rifle` | shot / 0.16 s | Weapon/ability noise event; matching action | Noise + bass crack; no pitch sweep | Retained physical/system placeholder |
| `action.weapon.machine-gun` | shot / 0.16 s | Weapon/ability noise event; matching action | Noise + bass crack; no pitch sweep | Retained physical/system placeholder |
| `action.weapon.rocket-launcher` | shot / 0.16 s | Weapon/ability noise event; matching action | Noise + bass crack; no pitch sweep | Retained physical/system placeholder |
| `action.weapon.grenade` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.weapon.molotov` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.weapon.pipe-bomb` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.weapon.firecracker-lure` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.weapon.smoke-grenade` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.weapon.flashbang` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.ability.corgi-lure` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.ability.ground-slam` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.ability.shield-bubble` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.ability.adrenaline` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.ability.turret` | noise / 0.24 s | Weapon/ability noise event; matching action | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `action.weapon.test-projectile` | shot / 0.16 s | Weapon/ability noise event; matching action | Noise + bass crack; no pitch sweep | Retained physical/system placeholder |
| `tail.street` | noise / 0.25 s | Ranged shot tail in matching acoustic zone | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `tail.interior` | noise / 0.65 s | Ranged shot tail in matching acoustic zone | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `tail.open` | noise / 0.25 s | Ranged shot tail in matching acoustic zone | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `weapon.rocket-whoosh` | noise / 1 s | Matching event adapter / variant pool | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `weapon.reload` | step / 0.4 s | Matching event adapter / variant pool | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `weapon.dry` | step / 0.12 s | Matching event adapter / variant pool | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.wood` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.wood` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.wood` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.metal` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.metal` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.metal` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.glass` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.glass` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.glass` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.water` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.water` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.water` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.blood` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.blood` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.blood` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `prop.roll` | noise / 1 s | prop.motion | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `prop.scrape` | noise / 1 s | Prop motion/impact event of matching kind | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `generator.pull` | noise / 0.4 s | light.generator | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `generator.sputter` | tone / 0.4 s | hazard.leaked | Steady sine / beep; no warble | Retained physical/system placeholder |
| `generator.idle` | tone / 1 s | Generator light event of matching phase | Steady sine / beep; no warble | Retained physical/system placeholder |
| `lamp.hum` | tone / 1 s | light.lamp | Steady sine / beep; no warble | Retained physical/system placeholder |
| `explosion.tell` | tone / 0.4 s | hazard.armed | Steady sine / beep; no warble | Recorded sfx2-k-impactMetal_light_000 |
| `explosion.sub` | tone / 0.8 s | Matching explosion beat | Steady sine / beep; no warble | Retained physical/system placeholder |
| `explosion.roar` | noise / 1.5 s | Matching explosion beat | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `explosion.crackle` | noise / 0.4 s | prop.ignited, vehicle.burning | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `tinnitus` | tone / 1.5 s | Explosion within 4 m with tinnitus enabled | Steady sine / beep; no warble | Recorded sfx2-k-impactBell_heavy_001 |
| `vehicle.engine-low` | tone / 1 s | vehicle.sound | Steady sine / beep; no warble | Retained physical/system placeholder |
| `vehicle.engine-high` | tone / 1 s | Vehicle sound event of matching phase | Steady sine / beep; no warble | Retained physical/system placeholder |
| `vehicle.sputter` | noise / 1 s | Vehicle sound event of matching phase | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `vehicle.fire` | noise / 1 s | Vehicle sound event of matching phase | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `vehicle.skid` | noise / 1 s | Vehicle sound event of matching phase | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `dialogue.radio` | vocal / 3 s | dialogue, dialogue.line | HIGH: pitch drift, 5 Hz vibrato, syllable repetition | Retained physical/system placeholder |
| `dialogue.emergency` | vocal / 3 s | Radio/dialogue event of matching line | HIGH: pitch drift, 5 Hz vibrato, syllable repetition | Retained physical/system placeholder |
| `dialogue.safe-zone` | vocal / 3 s | Radio/dialogue event of matching line | HIGH: pitch drift, 5 Hz vibrato, syllable repetition | Retained physical/system placeholder |
| `ui.tick` | tone / 0.1 s | level.started, sim.tick, scenario.loaded, scenario.unloaded, story.say, civilian.state, civilian.finished, escort.downed, ai.alerted, combat.effect, combat.hit-stop, barricade.built, barricade.broken, barricade.repaired, music.intensity, attack.resolved, checkpoint.restored, checkpoint.set, cinematic.completed, cinematic.started, entity.spawned, interact.interrupted, migration.started, mission.briefing, mission.signal, mission.spawned, objective.started, progression.requested, vehicle.feedback, vehicle.recovering, vfx.effect, world.blocker.changed, world.tier-requested, outbreak.bite, outbreak.distraction, outbreak.civilian-escaped, outbreak.infection | Steady sine / beep; no warble | Silent marker |
| `civilian.hey` | vocal / 0.4 s | civilian.bark | HIGH: pitch drift, 5 Hz vibrato, syllable repetition | Retained physical/system placeholder |
| `bed.wind` | bed / 2 s | Matching world-tier ambience bed | Noise + steady tones; no pitch sweep | Retained physical/system placeholder |
| `bed.horns` | bed / 2 s | Matching world-tier ambience bed | Noise + steady tones; no pitch sweep | Retained physical/system placeholder |
| `bed.helicopter` | bed / 2 s | Matching world-tier ambience bed | Noise + steady tones; no pitch sweep | Retained physical/system placeholder |
| `bed.fire` | bed / 2 s | Matching world-tier ambience bed | Noise + steady tones; no pitch sweep | Retained physical/system placeholder |
| `bed.hum` | bed / 2 s | Matching world-tier ambience bed | Noise + steady tones; no pitch sweep | Retained physical/system placeholder |
| `bed.fire-roar` | bed / 2 s | Matching world-tier ambience bed | Noise + steady tones; no pitch sweep | Retained physical/system placeholder |
| `ambient.sprinkler` | noise / 0.6 s | Seeded one-shot schedule in matching world tier | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `ambient.lawnmower` | noise / 0.6 s | Seeded one-shot schedule in matching world tier | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `ambient.basketball` | noise / 0.6 s | Seeded one-shot schedule in matching world tier | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `ambient.news` | noise / 0.6 s | Seeded one-shot schedule in matching world tier | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `ambient.megaphone` | noise / 0.6 s | Seeded one-shot schedule in matching world tier | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `ambient.radio` | noise / 0.6 s | Seeded one-shot schedule in matching world tier | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `ambient.gunshot` | shot / 0.6 s | Seeded one-shot schedule in matching world tier | Noise + bass crack; no pitch sweep | Retained physical/system placeholder |
| `ambient.glass` | noise / 0.6 s | Seeded one-shot schedule in matching world tier | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `ambient.explosion` | shot / 0.6 s | Seeded one-shot schedule in matching world tier | Noise + bass crack; no pitch sweep | Retained physical/system placeholder |
| `ambient.power` | noise / 0.6 s | Seeded one-shot schedule in matching world tier | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `ambient.automatic` | noise / 0.6 s | Seeded one-shot schedule in matching world tier | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `ambient.collapse` | noise / 0.6 s | Seeded one-shot schedule in matching world tier | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `ambient.debris` | noise / 0.6 s | Seeded one-shot schedule in matching world tier | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `ambient.helicopter` | noise / 0.6 s | Seeded one-shot schedule in matching world tier | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `stinger.low-hp` | music / 1 s | Loop while player HP <25%, outside twist silence | HIGH: eight short stepped notes; warped: 3 Hz gate | Recorded sfx2-k-impactSoft_heavy_000 |
| `diegetic.jukebox` | music / 2 s | diegetic | HIGH: eight short stepped notes; warped: 3 Hz gate | Recorded morning |
| `diegetic.jukebox.warped` | music / 2 s | Positional diegetic event of matching kind | HIGH: eight short stepped notes; warped: 3 Hz gate | Recorded morning |
| `diegetic.ice-cream` | music / 2 s | Positional diegetic event of matching kind | HIGH: eight short stepped notes; warped: 3 Hz gate | Recorded morning |
| `diegetic.ice-cream.warped` | music / 2 s | Positional diegetic event of matching kind | HIGH: eight short stepped notes; warped: 3 Hz gate | Recorded morning |
| `diegetic.car-radio` | music / 2 s | Positional diegetic event of matching kind | HIGH: eight short stepped notes; warped: 3 Hz gate | Recorded morning |
| `diegetic.school-bell` | music / 2 s | Positional diegetic event of matching kind | HIGH: eight short stepped notes; warped: 3 Hz gate | Recorded sfx2-k-impactBell_heavy_001 |
| `diegetic.pa` | vocal / 2 s | Positional diegetic event of matching kind | HIGH: pitch drift, 5 Hz vibrato, syllable repetition | Retained physical/system placeholder |
| `diegetic.megaphone` | vocal / 2 s | Positional diegetic event of matching kind | HIGH: pitch drift, 5 Hz vibrato, syllable repetition | Retained physical/system placeholder |
| `telegraph.riot.v1` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `telegraph.riot.v2` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `telegraph.riot.v3` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `telegraph.firefighter.v1` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `telegraph.firefighter.v2` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `telegraph.firefighter.v3` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `telegraph.armored.v1` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `telegraph.armored.v2` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `telegraph.armored.v3` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `telegraph.gorilla.v1` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `telegraph.gorilla.v2` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `telegraph.gorilla.v3` | step / 0.4 s | Matching infected windup | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.wood.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.wood.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.wood.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.wood.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.wood.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.wood.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.wood.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.wood.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.wood.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.metal.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.metal.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.metal.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.metal.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.metal.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.metal.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.metal.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.metal.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.metal.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.glass.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.glass.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.glass.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.glass.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.glass.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.glass.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.glass.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.glass.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.glass.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.water.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.water.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.water.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.water.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.water.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.water.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.water.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.water.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.water.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.blood.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.blood.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.infected.blood.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.blood.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.blood.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.corgi.blood.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.blood.v1` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.blood.v2` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `footstep.tires.blood.v3` | step / 0.3 s | Matching actor / surface movement | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `explosion.crackle.v1` | noise / 0.4 s | prop.ignited, vehicle.burning (variant) | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `explosion.crackle.v2` | noise / 0.4 s | prop.ignited, vehicle.burning (variant) | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `explosion.crackle.v3` | noise / 0.4 s | prop.ignited, vehicle.burning (variant) | Noise transient; no pitched sweep | Retained physical/system placeholder |
| `civilian.hey.v1` | vocal / 0.4 s | civilian.bark (variant) | HIGH: pitch drift, 5 Hz vibrato, syllable repetition | Retained physical/system placeholder |
| `civilian.hey.v2` | vocal / 0.4 s | civilian.bark (variant) | HIGH: pitch drift, 5 Hz vibrato, syllable repetition | Retained physical/system placeholder |
| `civilian.hey.v3` | vocal / 0.4 s | civilian.bark (variant) | HIGH: pitch drift, 5 Hz vibrato, syllable repetition | Retained physical/system placeholder |
| `l1.flicker.buzz` | buzz / 1.5 s | l1.flicker | MODERATE: rapid gating; no pitch sweep | Retained physical/system placeholder |
| `l1.ringing` | tone / 1.2 s | l1.ringing | Steady sine / beep; no warble | Recorded sfx2-k-impactBell_heavy_001 |
| `l1.chaos.run` | step / 0.3 s | L1 chaos scheduled running Foley | Short resonant thud; no pitch sweep | Retained physical/system placeholder |
| `l1.chaos.fall` | shot / 0.5 s | L1 chaos scheduled impact | Noise + bass crack; no pitch sweep | Retained physical/system placeholder |
| `l1.interior.hush` | bed / 2 s | L1 chaos inside an interior zone | Noise + steady tones; no pitch sweep | Retained physical/system placeholder |
| `l1.outro.sting` | music / 2.5 s | L1 level.completed (previously overlaid with stinger.complete) | HIGH: eight short stepped notes; warped: 3 Hz gate | Recorded aftermath |

## Event mapping after the change

| Event | Sound |
| --- | --- |
| Objective completion / civilian saved / escort rescued or revived | `stinger.objective`: 1 s acoustic guitar excerpt, comfort in uncertainty, 16 s |
| Weapon pickup | CC0 metal pickup tap plus 1 s acoustic `stinger.weapon` |
| Escape / elite / explicit elite stinger | 1 s acoustic `stinger.elite` |
| Twist | Existing 1 s score silence, then 1 s acoustic `stinger.twist` |
| L1 completion | One 2.5 s acoustic `l1.outro.sting`, fading over its last second; score resolves to aftermath. Removed double completion overlay |
| L2–L5 completion | Existing 1 s acoustic `stinger.complete` |
| L6 extraction / dawn | Existing 4 s acoustic `stinger.dawn` |
| HP <25% | 1 s loop of a low-passed recorded soft impact, with 0.3 s decay; no melody |
| UI click / weapon switch / interaction / pickup / respawn | Short recorded CC0 metal Foley taps, four variants for repeated UI families |
| Death / mission failed | Existing low-pitched recorded bell hit |
| Nearby explosion / L1 blast ringing | Recorded bell decay, same duration, low gain and existing low-pass recovery / setting |
| Explosion arming tell | Recorded metal tap |
| Jukebox / ice cream / car radio | Running free guitar excerpt; degraded variants use gentle fixed detuning / low-pass |
| School bell | Recorded bell hit |

## Scope and licenses

Reused existing source masters and pinned download/member hashes. No new source recordings, dependencies, categories or requests on the critical load path. Existing sprite durations/offsets and lazy category membership are preserved. Attribution for the CC-BY 3.0 guitar remains in THIRD_PARTY_NOTICES.md and both regenerated segment ledgers; Kenney Impact Sounds are CC0. Source licenses were checked on [the album page](https://opengameart.org/content/peace-is-king-here) and [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds).

Remaining procedural combat/world effects and vocal placeholders are listed above; this change focuses on event/UI music and tones. Those voices still warrant a separate recording pass. The synth buzz is an authored failing-light effect. Room-response synthesis remains required for acoustics.

Initial audio budget (both formats): 3,949,029 → 3,944,377 bytes (−4,652 bytes); limit 4,194,304 bytes. New music stays in lazy banks. Thirty-one replacement WAV excerpts are in `/tmp/audio-stingers-after/`.

No specs edited. The tinnitus ring now comes from a real bell decay and the heartbeat from recorded percussion; durations and low-health/low-pass behavior remain. Product listening approval remains a human check.

## Validation

Pending; commands and actual results will be appended after validation.
