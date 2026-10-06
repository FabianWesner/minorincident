# E16 — Audio

E16 scope complete: all 21 acceptance IDs have passing tagged tests; final verify and smoke exit 0. Full unit has the documented unrelated E17 exception explicitly reserved for central reconciliation by the orchestrator.

## Built

An isolated native WebAudio service extends the existing lifecycle/event bus with sprite loading, codec fallback, antispam and deterministic rate variation adapted from Bruno Audio.js. It supplies HRTF/equal-power spatial voices, hearing data shared with AI, off-screen telegraphs, surface footsteps, bounded horde clustering, acoustic zones, occlusion, air absorption and Doppler. Nested buses, per-emitter sends, ducking, limiting, adaptive bar-scheduled music, tier ambience, original stingers, diegetic sources, system adapters, haptics, captions and mono output share the same production/offline graph.

The service owns background suspension, persisted mute, input release, simulation pause, discarded one-shots and a 300 ms return fade. Game integration is limited to lifecycle/load hooks and event subscription; no render hub changes. The query-gated test API supplies actual-node inspection, PCM renders and a navigation/controller L1 coverage bot.

### Independently verified slices

1. Shared hearing metadata, complete cue table, original licensed sprite pairs and format/budget unit checks (`589ecf1`).
2. Live spatial graph, event adapters, score/ambience and background lifecycle (`cd0118a`).
3. Independent PCM measurements and runtime/mobile acceptance tests; native gain envelopes, repeated gesture handling and settings (`737ca26`).
4. Close-vocal and mobile photo coverage (`0c9c540`), responsive captions with overlap assertions (`9ba794e`).
5. Final report, accessibility review, acceptance map and epic status.

## Acceptance evidence

All tests explicitly contain their acceptance ID. Measurements read rendered PCM, not authored metadata.

| AC | Tagged evidence | Result / artifact |
| --- | --- | --- |
| 01 | T-E16-01a/b/c | Every GameEvent/archetype maps to an existing cue; both native formats decode all 237 cues; L1 navigation bot visits all six authored objectives, 3993 ticks / 259 m, zero missing cues. `decode.json`, `L1-audio-bot.json` |
| 02 | T-E16-02, T-E16-02b | One 25 m pistol noise consumed once by real audio and AI; 24 m infected alerted, 26 m infected idle. `noise-consumers.json` |
| 03 | T-E16-03 | Real archetype telegraphs precede attack; Screamer inhale 0.8 s, bloated burst 1 s; inspected +3 dB off-screen gain and protected bus. `telegraphs.json` |
| 04 | T-E16-04 | 200-voice priority storm enforces high 32/low 16; lowest/oldest cull order |
| 05 | T-E16-05, T-E16-05b | 150 infected within 30 m yield five actual centroid emitters, at most four close vocals; monotone count gain. `horde.json` |
| 06 | T-E16-06 | Native convolution RT60 street0.341 s / interior-large0.589 s / tunnel1.232 s, each within its band. `reverb.json`, WAVs |
| 07 | T-E16-07 | One wall: centroid736→155 Hz, 6.62 dB loss. `occlusion.json`, WAVs |
| 08 | T-E16-08 | 15 m/s pass-by 167.18→153.43 Hz (8.22% drop). `doppler.json`, WAV |
| 09 | T-E16-09, geometry unit | Real controller traversal logs asphalt→grass→wood→glass against surface cells. `footsteps.json` |
| 10 | T-E16-10, T-E16-10b | Quiet10 s→base only, 10 alerted→drive within one bar, exact bar scheduling. `music.json` |
| 11 | T-E16-11 | L1–L6 twist PCM silent≥1 s then twist; L6 dawn reprise. `twists.json`, six WAVs |
| 12 | T-E16-12 | Positioned jukebox/jingle normal and warped variants, rate detuning, radio lowpass and emergency dialogue duck. `diegetic.json` |
| 13 | T-E16-13, T-E16-13b | All six tiers have beds/seeded one-shots; W5 bed≥10 dB quieter. `ambience.json`, WAVs |
| 14 | T-E16-14a/b | PCM radio8/6 dB and mega12 dB ducks, protected buses and0.8 s duration; overlapping envelopes and strict<4 m tinnitus/setting. `ducking.json`, `tinnitus.json` |
| 15 | T-E16-15 | Production bus adapters log generator/lamp/material/impulse/HP-rate/explosion anatomy events. `system-coupling.json` |
| 16 | T-E16-16 | 60 s PCM mix−14.3 LUFS /−1.6 dBTP; radio dominance18.78–19.42 dB in1–4kHz band. `mix.json`, mix/control WAVs |
| 17 | T-E16-17a/b | Direction captions for telegraphs, scream/alarm/dialogue, setting-controlled rings; measured mono sums both channels. Screenshots and mono/stereo WAVs |
| 18 | T-E16-18 | First gesture unlock, setting-controlled three-event vibration spy, native suspend for freeze/pagehide/interrupted. Chromium, four mobile orientations and WebKit |
| 19 | T-E16-19 | Before L1: Opus1,514,419 B +AAC1,771,860 B =3,286,279 B combined (<4 MiB); all 17 categories sprite-packed,34 files |
| 20 | T-E16-20 | Per-file allowed MIT self-made license and SHA256; no Bruno unlicensed-SFX hash matches |
| 21 | S-11 T-E16-21 | Hidden/blur/pagehide ×muted/unmuted: native suspend<100 ms, master0, frozen music/sim, ≤50 ms resume drift, empty500 ms cue log, released inputs and explicit game Resume. `background-*.json` |

## Checks

- Typecheck, lint and production build: exit 0, no new warnings.
- `npm run test:unit`: exit 1; 79 pass / 1 fail. Sole failure: existing `T-E17-sources`, `bld.helipad` lacks `sourceGlb`. Eight existing standalone exports lack metadata. Per orchestrator, no asset registrations/exports or main merge were attempted; central reconciliation owns this.
- E16 + full simulation regression: all 155 tests /18 files pass with one worker (18.83 s). An initial concurrent run exceeded the E07 timing budget; isolated and serial reruns passed without changing behavior or thresholds.
- `E2E_PORT=3326 npm run verify -- E16`: exit 0;15 unit/smoke tests and44 browser tests across Chromium, Pixel 7/iPhone 14 portrait+landscape, WebKit. `checks.json`, `vitest.json`, `playwright-verify.json`, `acceptance-map.json`.
- `E2E_PORT=3326 npm run test:smoke`: exit 0;3 simulation smoke tests +18 browser smoke tests (38 s). `playwright-smoke.json`.

- Focused E01 API regression: all 5 browser tests pass (25.4 s), including 3600-tick Node/browser state/hash parity, API query gate, exact stepping and load/unload x20. Browser-only audio subscription count is explicitly asserted; all gameplay fields still compare exactly. `playwright-harness.json`.

## Deviations and integration limits

- Plain native loading/sprites use the explicitly permitted `09-sound-design` §9 escape hatch. Howler would require private graph internals to combine live/offline panners and buses; no new dependency was added. Bruno registry/mute/variant patterns were ported, with source attribution in THIRD_PARTY_NOTICES.
- Every audio asset is an original procedural placeholder, MIT, with paired Opus/AAC and file hashes. Vocal cues are synthetic formant placeholders; they are not intelligible recorded speech. Captions carry text. Replace final art/audio through the existing cue contract.
- E08/E09/E12/E25–27 producers are absent from this checkout. Typed adapter events are tested on the production sim bus, including named lab event sequences; these tests do not claim those other epics' physics/mission implementations. Existing combat/AI/player events use real producers.
- The L1 bot walks every authored composition objective through the real nav grid/controller. Campaign mission completion remains the separate E19 contract, whose API is still a stub here; no teleports or objective-completion cheats were used.
- The initial WebKit horde-arena audio fixture exposed an existing crowd shader declaring vertex attribute16. Audio mobile/lifecycle tests use the existing survivor fixture, retain the strict console-error guard and pass on WebKit; renderer work stays with its owning epic.
- Safari interruption is simulated only at the native state accessor to exercise its production handler; suspension/resumption call the real AudioContext. WebKit/mobile emulation does not replace real-device testing.
- No acceptance criterion was weakened or rewritten. No main merge after starting, as explicitly instructed by the orchestrator.

## Performance

150-infected live production service,600 simulation updates: p50 0.4 ms /p95 0.6 ms,32 max voices. Includes whole simulation plus audio callbacks, excludes GPU rendering and browser audio-thread DSP. Horde/acoustics are bounded at 5/10 Hz; input simulation and render frames do not rebuild audio graphs. Initial audio bytes 3,286,279 for both fallback formats combined. Offline 60 s mix reaches 11 concurrent voices. Low tier caps 16 and uses equalpower panners/shorter mono IR.

## Known issues

Portrait review captures show a faint/absent central character; the audio UI remains clear and character rendering requires a separate follow-up. The unrelated E17 asset metadata failure remains for central reconciliation. The WebKit crowd shader attribute-limit error is a separate renderer integration follow-up; E16 did not change crowd rendering. Procedural vocals and other placeholder sounds need artistic replacement. Typed adapters and real-device lifecycle behavior require integration/playtest as their owning epics/devices become available.

Final background sweep: 36 trigger/mute cases; max native suspend 7 ms; max music resume drift 0 ms. Accessibility screenshot review: applicable E16 must/should items PASS; no caption/action-button overlaps.
