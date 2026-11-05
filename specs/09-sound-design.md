# 09 · Sound Design

> **You hear the outbreak before you see it.** Sound is the player's second pair of eyes in an isometric game where threats come from off-screen. It tells the story of the town's decline: sprinklers and birdsong at the start, sirens in the middle, fire and silence at the end.

Implementation: [E16](epic-16-audio.md). Related: lighting/power sounds ([06](06-lighting-shadows-reflections.md)), props, explosions, and smoke ([07](07-physics-props-explosions-smoke.md)), and the noise model for the AI (E06/E07).

## 1. Pillars

| Pillar | Meaning |
| --- | --- |
| **Sound is information** | Every threat has an audible tell; off-screen danger is heard and located before it arrives |
| **What you hear, they hear** | One **noise system** drives the AI's hearing and the audio. Loud things (guns, alarms, horns, explosions) attract infected *because* they are loud |
| **The town has acoustics** | Streets echo, stores are boxy, tunnels boom, walls muffle |
| **Music tells the decline** | The score decays with the world tier and reacts to intensity in real time |
| **Silence is a tool** | After twists, in overrun streets, before the final wave |

## 2. Audio telegraphs and directional threat cues

| Source | Cue (≥ 0.35 s before the threat, synced with the E07 `telegraph` event) | Character |
| --- | --- | --- |
| Runner | lunge snarl | short, mid-range |
| Crawler | dragging scrape + wet breathing | low, close-only (≤ 8 m) |
| Sprinter | rapid footstep patter rising in tempo | high, rhythmic |
| Brute | heavy footsteps slowing before the charge, then a roar | sub-bass thuds |
| Screamer | **rising inhale** (0.8 s), then the scream | unmistakable, the highest priority |
| Bloated | gurgle and stretching skin (1 s before bursting) | wet, low-mid |
| Riot | shield bash on the ground | metallic |
| Armored | pads clacking, a grunt | percussive |
| Hazmat | respirator breathing, a gas hiss | filtered |
| Firefighter | axe dragging on asphalt | metal scrape |
| Butcher | cleaver sharpening before a combo | signature |
| Nurse | a high-pitched giggle before reviving | eerie |
| Explosives | fuse hiss, an accelerating beep, a propane jet | tell beat (07 §5) |
| Infected dog | low growl + crouch scrape before the pounce | close, aggressive |
| Infected cat | hiss + tail swish (only when within 5 m) | sharp, high |
| Crow flock | caws building to a crescendo before a dive | swirling, panned around the player |
| Lion (zoo) | a roar before the pounce | huge, sub-heavy |
| Gorilla (zoo) | chest-beat drum, then a grunt as it throws | percussive, signature |
| Zebra stampede | rising hoof thunder (rumble from the direction of approach) | sub rumble |
| Turning civilian | gasping → silence → a growl as they rise | story moment (E08) |

- **Off-screen emphasis:** cues from sources outside the camera frustum within 25 m are boosted by 3 dB and have their stereo panning widened, so they read clearly. They are mirrored by the corgi's bark and a HUD direction marker (an accessibility option).
- **One telegraph palette:** every telegraph sound belongs to the `telegraph` bus, which is never ducked below −6 dB, so danger stays audible during chaos.

## 3. Noise system (shared with the AI)

Each `noise` event has `{position, radius, loudness, kind}`. The sim uses it for infected hearing (E07). The audio uses the same event for playback. The radii come from the data files:

| Kind | Radius | Notes |
| --- | --- | --- |
| melee hit | 6 m | |
| pistol / SMG | 25 m | |
| shotgun / rifle | 35 m | |
| machine gun | 40 m | |
| explosion small / medium / large / mega | 30 / 45 / 60 / 120 m | |
| car horn | 30 m | the LEFT action while driving |
| car alarm | 20 m, 10 s | hazard (E11) |
| police siren | 35 m (looping) | the cruiser lure |
| firecracker lure | 15 m, 5 s | throwable |
| breaking glass | 12 m | windows, lamps |
| barricade hit | 10 m | |

An optional accessibility mode shows **noise rings** on the ground when the player makes noise.

## 4. Acoustics

- **Reverb zones**: the layout JSON (E10) carries zone polygons with acoustic presets:

| Preset | Where |
| --- | --- |
| `street` | open, short slapback from facades |
| `suburb-open` | lawns, little reflection |
| `interior-small` | houses, diner, pharmacy |
| `interior-large` | supermarket, gym, mall |
| `tunnel` / `under-bridge` | long, boomy |
| `park` | open air |

Each preset is a small convolution impulse response (IR, ≤ 1.5 s, mono, generated procedurally at build time or taken from CC0 IRs) plus a wet/dry mix. The player's zone decides the listener's reverb; emitters in a different zone get that zone's send. Zone changes crossfade over 0.3 s.
- **Occlusion:** a cheap 2D segment test from emitter to listener against building footprints (layout JSON). Each occluding building applies a low-pass (cutoff 1.2 kHz) and −6 dB, with a maximum of 2 buildings. It is computed at 10 Hz per active emitter.
- **Distance:** an inverse-distance roll-off per bus, plus **air absorption** (a low-pass dropping with distance beyond 20 m) and **Doppler** for vehicles and passing projectiles (a rocket whoosh).
- **Gun tails** by environment: each firearm has a dry transient plus an environment tail (interior vs street vs open), so a shotgun in the supermarket sounds different from one in a park.
- **Footsteps by surface** come from a surface map in the layout JSON: asphalt, sidewalk, grass, wood porch, gravel, tile, metal (bridge), glass shards, water or wet ground, blood (a squelch layer, gore setting). Survivors, infected (aggregated), the corgi (tiny claws), and vehicles (tire noise by surface) all use it.

## 5. Music

- **Layered stems** (vertical layering), 4 per track: `base` (pads and ambience-like) · `pulse` (rhythm) · `drive` (full percussion and bass) · `peak` (lead and brass). The **intensity score** (0–1) comes from alerted infected near the player, damage taken in the last 5 s, objective phase (timer < 60 s, defend, boss), and vehicle speed. Layers fade in and out at **bar boundaries** (at the track's BPM) over 2–4 s.
- **Stingers:** objective complete, a weapon found, an elite spawn, low HP (a heartbeat layer), the twist (**music cuts to silence, then a single stinger**), and level complete.
- **The theme decays with the town:**

| Level | Musical identity |
| --- | --- |
| L1 | warm Americana: acoustic guitar, glockenspiel, light drums (the "Sunset Grove theme") |
| L2 | the same theme, now with tension strings and pulses |
| L3 | driving synth bass under the theme (car chase energy) |
| L4 | golden-hour melancholy: a slowed theme, heavy synth, distorted guitar |
| L5 | a big percussive defense score (wave peaks) |
| L6 | dark and fragmented (the theme only in broken fragments) → a **dawn reprise**: the L1 theme as a solo piano at extraction |

- **Diegetic music (inside the world):**
  - Joe's Diner **jukebox** (L1 playing; in L6 the same song warped and skipping).
  - An **ice-cream-truck jingle** in L1 that returns detuned and broken in L6 (a hidden abandoned truck).
  - **Car radios** while driving, alternating songs with the **emergency broadcast** (story radio lines), with the in-car low-pass.
  - A school bell (L2), the gas station PA, and the safe-zone megaphone loop (L3).
- **Sources:** researched candidates and a starter set per level are in [10-music-sources.md](10-music-sources.md) (CC0 first, CC-BY with credits). Very few free tracks ship with stems, so the vertical layering uses **stems we make ourselves**: split the chosen tracks into layers (or rebuild them), add our own percussion and pad layers, or commission a small score later. All picks must be listened to **together** before committing, because they come from about 8 composers.
- **Reuse:** Bruno's portfolio music (`folio-2025/static/sounds/musics/`, **CC0**: *Baguira*, *Boy*, *Sudo*) may be used for menus, credits, or diegetic radio. Bruno's SFX have **no license file**, so **do not copy them**.

## 6. Ambience per world tier

Each district has ambience beds (2–3 looping layers) plus **random one-shot emitters** placed in the world (seeded):

| Tier | Beds | One-shots |
| --- | --- | --- |
| W0 | birds, light wind, distant traffic | lawnmower, sprinkler tick-tick, kids playing, a dog barking, the ice-cream truck, a basketball bouncing |
| W1 | birds (fewer), traffic jam horns | distant sirens, car alarms, shouting, a TV news murmur from windows |
| W2 | sirens (a layered city bed), helicopter pass-bys | megaphone announcements, police radio chatter, distant gunshots |
| W3 | wind + **fire crackle**, transformer hum (powered blocks), electrical buzz | alarms, glass breaking, distant explosions, power-down "clunk" waves |
| W4 | fire roar beds, crowd moans far away | screams, distant automatic fire, collapsing structures |
| W5 | fire, wind, **near silence** in burnt-out streets | debris falls, a lone dog, the helicopter far away; dawn birds return at extraction |

## 7. System sounds (coupled to the other systems)

- **Lights and power (E25):** street-lamp hum, fluorescent buzz and flicker ticks synced with the light flicker, generator start (pull cord → sputter → idle loop), power-on "thunk" cascades along the bridge, sparks when a lamp is shot out, the transformer arc crackle.
- **Props (E26):** impact sounds by **material × impulse** (wood, metal, plastic, glass, rubber, sandbag), rolling loops for carts and drums, scraping while pushing (pitch follows speed), a brace "chunk" when a barricade locks, creaks on barricade hits that rise as HP falls, splintering and a crash on breaking. Rate randomization and anti-spam (Bruno `Audio.js`).
- **Explosions (E27):** one layer per beat: tell (hiss and beep) → crack transient → boom body → low thump (sub) → debris rattle and glass → roar decay → crackle. **Tinnitus effect** within 4 m (a 1.5 s ringing tone, everything low-passed, then a slow recovery; it can be turned off). Mega blasts duck all buses −12 dB for 0.8 s ("audio hit-stop").
- **Vehicles (E09):** an engine loop with RPM-based pitch and crossfaded layers, tire noise by surface, skids, horn, siren, crash impacts by impulse, the damage states (sputtering engine below 40%, fire crackle below 15%), and infected thumping on the roof (grab).
- **Combat (E05/E06):** per-weapon transient + mechanical layer (reload, cock) + environment tail; the melee swish + impact by target (flesh, armor, shield); a "dry fire" click when out of rounds.
- **Gore (01 §7):** layered squelch, bone crunch on dismemberment, and splats on landing; the volume and presence follow the gore setting (Off removes the gore layers).
- **Survivor voice barks:** short effort grunts, hurt sounds, and **dark-humor quips** (one-liners on a cooldown of ≥ 25 s; for example on picking up the first weapon, on a car kill, at low HP). Male and female voice sets.
- **Corgi:** barks (a warning bark is directional and distinct from happy barks), whimper when hurt, panting while running.
- **UI:** menu clicks, card flips (upgrades), objective pings, the rack-switch click.

## 8. Mix and dynamics

**Buses:** `master → { music, sfx (→ weapons, impacts, vehicles, props, gore), telegraph, ambience, voice (→ dialogue, barks), ui }`, with each bus's reverb send going to the zone convolvers.

**Ducking (sidechain-style gain automation):**
- Dialogue and radio duck music −8 dB and ambience −6 dB.
- Explosions (large and above) duck everything except `telegraph` and `dialogue`.
- Low-HP state: a low-pass on music and ambience, and a heartbeat layer.

**Voice limits and priorities:** player weapons > telegraphs > player hurt > dialogue > vehicles > infected vocals > props > ambience one-shots.

| Tier | Max voices |
| --- | --- |
| High | 32 |
| Low / mobile | 16 |

**Horde aggregation:** instead of one voice per infected, the crowd is clustered (k-means on positions, 3–6 clusters at 5 Hz). Each cluster plays a horde loop (granular moan, footsteps, density layers scaled by count) positioned at the cluster centroid. At most 4 individual infected vocals play nearby (≤ 6 m), plus the telegraph cues.

**Loudness targets** (measured offline, §10):

| Measure | Target |
| --- | --- |
| Integrated loudness, gameplay | −16 LUFS ±2 |
| True peak | ≤ −1 dBTP |
| Dialogue intelligibility | dialogue band ≥ 6 dB above the rest during radio lines |

**Mobile:** haptics via `navigator.vibrate` on heavy hits, explosions, and vehicle crashes (setting, default on), plus a reduced reverb quality (shorter IRs).

## 9. Technology

- **Web Audio API graph** owned by the `AudioService`:
  - `PannerNode` (HRTF on high, equal-power on low) per emitter
  - `ConvolverNode` per reverb zone (max 2 active)
  - `BiquadFilterNode` for occlusion, air absorption, and low HP
  - `DynamicsCompressorNode` on master as a limiter
  - gain automation for ducking
- **Howler** is used only for loading, audio sprites, and format fallback (Bruno `Audio.js` pattern: register, `antiSpam`, `distanceFade`, rate randomization), with the playback routed into our graph. If Howler gets in the way of the custom graph, use plain Web Audio with a small loader.
- **Formats:** Opus in WebM/Ogg (primary) with an AAC `.m4a` fallback (Safari). SFX go into **audio sprites** per category (fewer requests), and music stems stream.
- **Audio budget** (part of the 15 MB initial download budget, E18): ≤ 4 MB before L1 starts (the L1 stems + core SFX). Other levels' music and SFX load during the briefing screens.
- **Unlocking:** audio starts on the first user gesture (title-screen click or tap).
- **Silence when the player leaves (Bruno's behavior, made stricter): no sound ever plays in the background.**
  - **Triggers:** any of these counts as *away*:
    - `visibilitychange` → `hidden` (tab switched, window minimized, mobile app switch, screen lock)
    - window `blur` (another app or window focused, as Bruno does in `Audio.js:692`)
    - `pagehide` / `freeze` (mobile background, bfcache)
    - a Safari AudioContext `interrupted` state (phone call, Siri)
  - **On away, within 100 ms:**
    1. A short master fade to silence (≤ 80 ms, so there's no click).
    2. `AudioContext.suspend()`: the whole audio graph stops processing (no CPU or battery use, unlike a mute).
    3. The music **pauses at its position** (it doesn't restart).
    4. The game **auto-pauses** (sim stopped, pause menu shown).
    5. All held inputs are released (Bruno `Keyboard.js` blur handler).
  - **On return** (visible **and** focused): `AudioContext.resume()` with a 300 ms fade-in, and the music continues from where it paused. **Only if the player hasn't muted the game** (Bruno's `mute.active` check, persisted in `localStorage`). The game stays paused until the player resumes it, so nobody is killed by surprise. If the browser needs a gesture to resume audio (iOS), the first click or tap resumes it.
  - **No backlog:** schedulers for ambience one-shots, music bars, and voice cooldowns run on audio and sim time, which stood still. Coming back never fires a burst of queued sounds, and the clock clamps the frame delta after a resume (no catch-up storm).
  - Loading screens and cinematics follow the same rule.

## 10. How agents test sound

Agents can't listen, but they can **measure**:

1. **Coverage:** every sim event type and telegraph has a cue, and every cue's file exists and decodes (Node + `audio-decode`).
2. **Offline renders:** a scripted 30–60 s sequence is rendered with an `OfflineAudioContext` in the browser (test mode). The WAV is analyzed in Node: integrated loudness (LUFS), true peak, ducking depth during dialogue, voice counts, reverb tail length (RT60 estimate) inside vs outside, the occlusion low-pass (spectral centroid drop), and Doppler (a pitch shift on a pass-by).
3. **Sim-side checks:** the noise radii match AI hearing (one data source), the horde cluster count, the music intensity state machine.
4. **Licenses:** a static check that every file in `public/assets/audio/` has a `LICENSES.md` entry with an MIT-compatible license (§11).
5. **Human pass:** the overall feel, the mix balance, and the music emotion in the milestone playtests.

## 11. Sourcing and licensing (open MIT repository)

The game is **open source (MIT) and browser-only**, so every audio file in the repo is redistributed:

- **Allowed:** CC0 (Freesound CC0, Kenney, OpenGameArt CC0, Bruno's CC0 music), CC-BY (attribution in `THIRD_PARTY_NOTICES.md` and in the credits), self-recorded or self-synthesized sounds (e.g. procedural synthesis for UI, hums, and beeps), and AI-generated audio **only** where the tool's terms allow redistribution in an open repo.
- **Not allowed:** "royalty-free for use in games" packs that forbid redistributing the raw files (e.g. most commercial bundles), and Bruno's SFX (no license).
- Voice barks and radio lines: recorded by contributors, or generated with a tool whose terms allow redistribution, with credits.
