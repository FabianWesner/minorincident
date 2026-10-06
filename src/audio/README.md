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
telegraphs, surfaces and materials. Sprite offsets/durations are seconds. All assets
are original procedural placeholders built with `npx tsx tools/audio/build.ts`
(requires a local FFmpeg with Opus/AAC encoders). This produces both formats and
`public/assets/audio/LICENSES.md` with per-file hashes. The loader tries Opus, then
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
