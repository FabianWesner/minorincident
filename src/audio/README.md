# Audio contracts (E16)

`AudioService` owns the native context, output lifecycle, captions, noise rings,
settings, and bindings. `Game` constructs it after input, resets it before changing
worlds, and calls `load()` after world assembly. An unload leaves no audio sim listeners.
The service subscribes to the existing `EventBus<GameEvent>` and observes simulation
state; it does not resolve damage, missions, lighting, prop or vehicle physics.

`src/data/noise.ts` is the shared hearing/playback data in metres. Weapon definitions
use it for hearing radii; the sim emits one `noise` event and AI/audio subscribe to
that event. World producers use the same data for horns, alarms, glass, and blasts.
Do not play the weapon transient again from `combat.attack` when its `noise` does so.

`src/data/audioEvents.ts` documents adapter events for E08/E09/E12/E25/E26/E27.
Generator/lamp/vehicle/prop events use stable `sourceId`s so loops update in place;
stop/off/break events release them. `music.intensity` is an authoritative producer
snapshot when present; otherwise E16 derives alerted counts and recent damage at 5 Hz.
`music.stinger` supplies level IDs for twist silence and L6 extraction's dawn reprise.
Explosion producers emit each anatomy beat once, and only `crack` triggers ducking,
tinnitus (strictly inside 4 m), and haptics. `diegetic` sources are spatial; emergency
radio uses dialogue ducking and `inCar` applies a 2.4 kHz low-pass.

The cue table maps all sim event types, including silent control events, archetype
telegraphs, surfaces and materials. Sprite offsets/durations are seconds. Licensed
recordings and residual procedural system cues are built with
`npx tsx tools/audio/build.ts` (requires FFmpeg with Opus/AAC encoders, curl and bsdtar).
This produces both formats and `public/assets/audio/LICENSES.md` with per-file hashes.
The loader tries Opus, then
AAC, decodes each category once, and never queues a play while locked or away.
The production graph is also used by the query-gated native offline renderer.

A gesture unlocks audio; `audio=muted` silences only test output while the graph runs.
Player mute is a separate persisted setting. Visibility hidden, blur, pagehide,
freeze and Safari interruption synchronously silence the master, suspend the native
context, discard one-shots, release held inputs and auto-pause. Visibility/focus return
resumes only unmuted audio, with a 300 ms fade; the game requires an explicit Resume.
Music loops remain in the suspended context and retain their phase. All schedulers
use audio/sim time, and late ambience updates emit one sound rather than a backlog.

The additive `__SS__.audio` API (version 1.8) provides snapshot, emitter-node
inspection, cue playback, native decode checks, event-bus injection, acoustic-map
fixtures, an L1 composition traversal bot, interruption simulation, and PCM WAV
offline renders. `tools/audio/measure.ts` independently measures these WAVs with
FFT/autocorrelation/Schroeder decay and FFmpeg EBU R128 with true-peak analysis.
The traversal bot covers every currently authored L1 objective; the E19 campaign
mission-completion bot remains a separate contract.
# Recorded score and Foley

The adaptive score streams stereo recordings via `StreamedMusic` into the existing
music bus. `MusicDirector` chooses calm, tension, combat and aftermath at bar
boundaries; two-second fades wait for the incoming recording to start. Objective
events begin the diner tension/stinger and store combat; completed levels resolve
to aftermath. Blur, mute, hidden, freeze and interruption pause media as well as
the AudioContext. Filtered recorded excerpts supply low-level accent layers.

`AudioRegistry` chooses four sprite variants without immediate repetition and
applies ±1 dB gain and ±3% pitch variation to core Foley. Telegraph gain/pitch
remain stable for information and timing. Cue logs retain logical cue IDs and
record the physical `variant` slice. Hit events play flesh impacts at the target;
swing events play separate recorded bamboo swooshes.

Rebuild with `npx tsx tools/audio/build.ts` (FFmpeg, curl, bsdtar required). Masters
are cached outside git at `AUDIO_MASTER_CACHE` or the system temporary directory.
`assets/audio/imports.json` pins downloads, archive members and hashes, and maps
every recorded sprite slice. The builder rejects changed, silent or truncated
masters and writes both license ledgers. `--score-only` rebuilds streamed music;
category arguments rebuild selected sprites while preserving all provenance.

The headless live capture runs with:
`E2E_PORT=3351 sh tools/e2e-lock.sh npx playwright test tests/e2e/audio/preview.spec.ts --project=chromium --workers=1`.
It taps the final production PCM into WAVs without audible OS output, exercises
the authored diner incident and store fight, and exports loudness/peak/gap/log
measurements alongside three previews. `AUDIO_PREVIEW_DIR` overrides their location.

Streams start only in L1–L6 missions, with at most four cached, lazily created
decks (one per state). A level can replace a state's recording (`levelStreams` in
`StreamedMusic.ts`): L1's calm morning streams `score-calm-L1`, a 192 s (80-bar)
excerpt of Kevin MacLeod's "Jazz Brunch" (CC-BY 4.0) whose tail is crossfaded into
the bars before its start, so the media loop has no seam. The bird/traffic/chatter
calm ambience stays on its own bus underneath; the accident hands over to tension
exactly as in other levels. Acoustic tier refreshes preserve the score and cue history. Four reserved
slots keep combined sprite/media voices within 32 high / 16 low. Music files
measure approximately −18 LUFS; SFX and voice bus trims are −2 and −1.5 dB.
Per-file grants, authors and provenance are in `assets/audio/LICENSES.md` and
`assets/audio/imports.json`; research and rejected sources are documented in
`epics-pipeline/audio-research.md`.

## L1 v2 sound arc (lane H)

`L1Arc.ts` (`L1ArcDirector`) is pure logic on audio time: calm layer until the `l1.flicker`/`l1.blast` events, accident cues
(buzz, muffled blast, glass rattle, ~1.2 s ringing + the tinnitus low-pass, bell, screams), calm beds -12 dB within 3 s then
faded out, and a chaos layer whose intensity follows the live infected count (cap `l1v2.sound.chaosMaxInfected`).
`AudioService` feeds it the `l1.*` events and applies the frame. Cues live in sprite `l1arc` (recordings plus residual MIT system effects, ledger
in `public/assets/audio/LICENSES.md`). The fire-station interior is any `interior-*` acoustic zone during chaos (muffles the
ambience bus, adds a hush bed); `level.completed` plays `l1.outro.sting`.

Event stingers use recorded acoustic guitar, with one completion cue in L1.
Low HP loops a recorded soft impact rather than a fast melody. Audible UI cues
use metal Foley taps, and blast ringing uses a recorded bell decay. Diegetic
music uses recorded guitar/bell excerpts. No category, offset or lazy-load contract
changes. See `docs/reports/audio-stingers.md` for the complete procedural inventory
and per-event replacements.

## Infected voices and credits

The lazy `infected` bank holds recorded humanoid voices: `infected.alert` (shared anti-spam key on `ai.alerted`),
`infected.hurt` / `infected.death` (melee/ranged hits and kills on human archetypes), and `infected.bite` (a landed
infected melee attack). Idle groans (`infected.vocal`, max four nearby via `HordeClusters`) and the clustered
`horde.loop.*` beds stay in the initial banks. Telegraph wind-ups for human archetypes share one CC0 performer with
per-archetype pitch/colour. Voice recipes set `level` in `imports.json`: the builder compresses gently and matches the
active-part RMS (−21 dBFS) under the sprite ceiling, so variants in a pool sit within about 1.5 dB.
The in-game Credits & Licenses screen and the generated block in `THIRD_PARTY_NOTICES.md` come from
`npx tsx tools/credits/generate.ts` (package.json, package-lock.json, `imports.json`); a unit test fails when they drift.

### Nearby danger encounters

Live gameplay uses the same camera-frustum check as telegraphs and the sim's sight
blockers (including L1's active gates/curtains). A living, upright infected within
12 m, or a player attack, selects the existing `score-combat` recording. It is
preloaded silently after the first gameplay frames, then crossfaded in 0.8 s with
trim 0.6. Each sighting renews a 7 s hold; the outgoing recording fades to zero
while the level's calm recording returns in 0.8 s. L1's calm recording remains
`score-calm-L1` (Jazz Brunch). Explicit `music.intensity` events and offline renders
retain the original bar-scheduled horde score; encounter transitions carry an
`immediate` marker. Both paths use the same music bus, stingers and suspension.
The reused danger excerpt is Blinding Lights by Zander Noriega (CC-BY 3.0),
32–128 s, already attributed in both audio ledgers and Credits & Licenses.

Story intensity floors are data in `src/data/musicBeats.ts`, read from the current
serialized mission state, so checkpoint restores retain the correct score without
replaying audio events. L1's accident/spread hold tension until the fire station;
L2's doors-open collapse and escape hold dramatic rock until the police checkpoint.
L3's active defend/escape objectives set the highest concurrent floor. Safe beats,
briefings and completed levels release the floor. Nearby combat can raise any
floor, with the same seven-second encounter hold before returning to that floor.
The active beat and floor are exposed in `audio.snapshot().music.story`.
