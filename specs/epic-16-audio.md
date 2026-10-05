# E16 · Audio

## Goal
Put the sound design from [09-sound-design.md](09-sound-design.md) into practice. Sound must be **information** (audio telegraphs, directional off-screen cues, one shared noise system with the AI), have **acoustics** (reverb zones, occlusion, distance and air absorption, Doppler, surface footsteps, environment gun tails), use **adaptive layered music** whose theme decays with the town (including diegetic jukebox, ice-cream-truck, and car radios), have **ambience per world tier**, and use **system sounds** coupled to lights, props, explosions, vehicles, and gore. It also needs a **controlled mix** (buses, ducking, voice priorities, horde aggregation, loudness targets), mobile haptics, and accessibility captions. All of it is measured by agents through offline renders.

## Depends on / Enables
E05, E06, E07, E09, E10 (zones and surfaces in the layout JSON), E25, E26, E27 / all levels.

## Scope
**In:**
- `AudioService` on a Web Audio graph (Howler for loading and sprites) with buses, sends, convolver zones, HRTF panners, filters, a master limiter, and ducking automation.
- Cue mapping from sim events (`src/data/audioCues.ts`); the noise system's audio side.
- Telegraph cues per archetype; off-screen emphasis.
- Reverb zones, occlusion, air absorption, Doppler, environment gun tails; surface footsteps (survivor, infected aggregated, corgi, tires).
- Layered music stems with the intensity score, bar-synced transitions, stingers, per-level themes, and the dawn reprise; diegetic sources (jukebox, ice-cream truck, car radio + emergency broadcast, school bell, PA, megaphone).
- Ambience beds + seeded one-shot emitters per tier.
- System sounds: power and lights, props and barricades, explosions (per beat, tinnitus, mega duck), vehicles, gore layers.
- Survivor barks and quips (m/f), corgi.
- Horde clustering; voice limits; loudness targets.
- Mobile haptics; captions for important sounds; the noise-ring accessibility option.
- **No background audio** (`09` §9): suspend the AudioContext and pause the music on hidden, blur, pagehide, or freeze, and on a Safari interruption; resume on visible + focused only if the player hasn't muted the game; no backlog of queued sounds; the game auto-pauses.
- The offline-render test harness.
- Audio sprites and formats (Opus + AAC fallback), the download budget, and the licensing check.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Audio.js`](../folio-2025/sources/Game/Audio.js): Howler registry, positional playback, `antiSpam`, `distanceFade`, rate randomization, ambiences, playlist (port as the loading/registry layer)
- [`World/ExplosiveCrates.js`](../folio-2025/sources/Game/World/ExplosiveCrates.js): `setSounds()`, the arming click + randomized explosion variants pattern
- `Audio.js` `setMute()` (lines ~638–708): the user mute toggle persisted in `localStorage`, **window blur → `Howler.mute(true)` + pause the playlist; focus → unmute + resume unless user-muted** (port, then add `AudioContext.suspend()` and `visibilitychange`)
- [`Inputs/Keyboard.js`](../folio-2025/sources/Game/Inputs/Keyboard.js): releases all pressed keys on window blur
- [`static/sounds/musics/`](../folio-2025/static/sounds/musics/): **CC0 music** (Baguira, Boy, Sudo), usable for menus, credits, and radio. Bruno's other SFX are **not** licensed for reuse.

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E16-AC01 | Coverage: every sim event type and every archetype telegraph in the cue table maps to a cue whose file exists and decodes; a full L1 bot run logs 0 missing-cue errors (test mode: audio graph active, output muted) | unit/e2e |
| E16-AC02 | Noise system: AI hearing radii and audio noise events come from the same data (`src/data/noise.ts`); a pistol shot emits one `noise` event (25 m) consumed by both the AI and the audio (sim + spy test) | sim/unit |
| E16-AC03 | Telegraphs: every `telegraph` event plays its archetype cue ≥ 0.35 s before damage (Screamer inhale 0.8 s); off-screen sources within 25 m are +3 dB vs on-screen (gain-node inspection); the telegraph bus is never ducked below −6 dB | e2e |
| E16-AC04 | Voice limiter: concurrent voices ≤ 32 (high) / 16 (low); under overload, the lowest-priority voices are culled first (synthetic event storm test) | unit |
| E16-AC05 | Horde aggregation: with 150 infected within 30 m, 3–6 cluster emitters play at the cluster centroids (within 2 m), plus ≤ 4 individual vocals within 6 m; the horde loop gain rises monotonically with the count | unit/e2e |
| E16-AC06 | Reverb zones: an offline render of the same pistol shot in `street`, `interior-large`, and `tunnel` gives RT60 estimates in increasing order (street < interior-large < tunnel), each within its preset's band | e2e (offline) |
| E16-AC07 | Occlusion: an emitter behind one building has a spectral centroid ≥ 30% lower and a level 4–8 dB lower than the same emitter in line of sight (offline render) | e2e (offline) |
| E16-AC08 | Doppler: a car passing the listener at 15 m/s shows a pitch drop of 6–12% between approach and departure (offline render pitch tracking) | e2e (offline) |
| E16-AC09 | Footsteps by surface: walking across asphalt → grass → wood → glass triggers the matching footstep set per surface cell (event log of the cue IDs vs the surface map) | sim/unit |
| E16-AC10 | Music intensity: the intensity score drives the stem layers (0 alerted for 10 s → `base` only; ≥ 10 alerted → `drive` within one bar); transitions happen only at bar boundaries (±20 ms, scheduled time vs the beat grid) | unit/e2e |
| E16-AC11 | Twist and stingers: each level twist cuts music to silence (≤ −50 dBFS for ≥ 1 s) and then plays the twist stinger; L6 extraction plays the dawn reprise | e2e (offline) |
| E16-AC12 | Diegetic: the jukebox (L1 normal, L6 warped variant), the ice-cream-truck jingle (L1 normal, L6 detuned), and the car radio (songs + emergency broadcast, with the in-car low-pass) play at their sources with positional panning | e2e |
| E16-AC13 | Ambience by tier: each tier W0–W5 loads its bed set; one-shot emitters fire with seeded timing (deterministic sequence per seed); W5 burnt-out streets measure ≥ 10 dB quieter (bed level) than W2 streets | unit/e2e (offline) |
| E16-AC14 | Ducking: during a radio line, music −8 dB ±1 and ambience −6 dB ±1; a mega explosion ducks all buses except telegraph and dialogue −12 dB for 0.8 s; the tinnitus effect triggers only within 4 m and is disabled by its setting | e2e (offline) |
| E16-AC15 | System coupling: generator start, lamp hum, lamp break, prop impacts (material × impulse → cue + gain), barricade creaks (rate rises as HP falls), and the per-beat explosion layers all fire from their sim/light events (event → cue log test across `light-lab`, `prop-yard`, `blast-lab`) | e2e |
| E16-AC16 | Loudness: an offline render of the `audio-mix` scenario (60 s of combat + dialogue + explosion) measures −16 LUFS ±2 integrated and ≤ −1 dBTP true peak; dialogue-band dominance ≥ 6 dB during radio lines | e2e (offline) |
| E16-AC17 | Accessibility: captions appear for important sounds (telegraphs, off-screen screamers, alarms, dialogue) with a direction ("[Screamer shrieking — left]") when enabled; noise rings render when that option is on; mono mode sums the channels | e2e |
| E16-AC18 | Mobile: haptics fire on heavy hits, explosions, and crashes (`navigator.vibrate` spy) and respect the setting; audio unlocks on the first gesture; `pagehide` / `freeze` and a Safari `interrupted` AudioContext suspend audio like a hidden tab | e2e (mobile) |
| E16-AC19 | Budget and formats: audio needed before the L1 start is ≤ 4 MB; every SFX category is packed into sprites; every file has Opus + AAC versions | static/perf |
| E16-AC20 | Licenses: every file in `public/assets/audio/` has a `LICENSES.md` entry with an allowed license (CC0, CC-BY with attribution, self-made, or a redistribution-permitted generated source); none are from Bruno's unlicensed SFX folders (path/hash check) | static |
| E16-AC21 | **No background audio:** for each trigger (tab hidden via `visibilitychange`, window `blur`, `pagehide`), within 100 ms `AudioContext.state === 'suspended'`, the master output is silent, the music is paused (its playback position is stable while away), and the sim tick is constant (auto-pause). On return (visible + focused) audio resumes with the music continuing from the same position (±50 ms); if the player had muted the game, it stays silent. No sound events queued while away play on return (cue log empty for the first 500 ms except the resume fade) | e2e |
