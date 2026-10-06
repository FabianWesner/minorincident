# E16 audio upgrade — recorded score and Foley

The audio lane adds real licensed recordings, an adaptive streamed score, recorded
variation pools, public-repository provenance and focused live encounter captures.
It merged main once at `202ffc2aef33393ce047561e532ced42d4e49326`.

## Delivered

- Twelve-track research shortlist, community/forum research, license decisions and
  rejected libraries in `epics-pipeline/audio-research.md`.
- Three CC-BY 3.0 recordings: Running free and comfort in uncertainty by bbatv1;
  Blinding Lights by Zander Noriega. Calm → tension → combat → aftermath, two-second
  bar-aligned crossfades, mission stingers and low-level recorded accent layers.
- Thirteen CC0/CC-BY source packs; 285 of 490 sprite cues now use recordings.
  Core footsteps, body impacts, gore, infected/civilian vocals, crowd panic,
  transformation, UI, suburban birds/traffic/sirens and dog barking have four-slice
  pools, no adjacent variant, ±3% pitch / ±1 dB gain and existing spatial attenuation.
  Telegraph pitch/gain stay stable; original offscreen +3 dB remains exact.
- Flesh impacts play on actual contact; bamboo swing Foley is separate. Acoustic
  tier refreshes preserve incident music and cue history. Cached lazy media decks
  survive resets and early pauses. Four reserved media slots retain total caps
  32 high / 16 low. Existing HRTF, ducking, reverb, occlusion and limiter are reused.
- WebM/Opus and M4A/AAC. Both startup sprite codecs combined: 4,018,675 bytes
  (<4 MiB); actual Opus path: 1,894,934 bytes. Music loads on demand after a gesture;
  masters are not checked in. Encoded sources measure −18.2 to −17.8 LUFS.
- Credits screen, THIRD_PARTY_NOTICES, per-file license/hash ledger and pinned
  import recipes. Original archive notices and primary grants are retained.

## Mix and playback evidence

The final SFX bus is −2 dB and voice bus −1.5 dB. Music decks trim to 0.5 before
the existing +6 dB master, preserving normalized music headroom; accents use 18%
of authored gain. SFX slices peak-normalize to −6 dBFS before cue/spatial gains.
The 60-second production-graph mix measures −14.0 LUFS / −1.6 dBTP, dialogue
frequency-band dominance 13.11–16.31 dB. Acceptance thresholds are unchanged.

Three stereo gameplay WAVs are in the requested scratchpad `audio-preview/`:
`01-morning.wav`, `02-diner-incident.wav`, `03-store-fight.wav`.
`measurements.json` contains PCM metrics, full cue/variant logs, score transitions,
mission phase and tick evidence. The capture taps final production WebAudio PCM,
while sending silence to OS output. It explicitly checks simulation advancement,
incident stinger timing (<2 s), transformation/screams, bat impact variation and
combat-stream transition. All three have zero clipping and no measured sustained
silence gaps. Exact final values are in `audio-preview-measurements.json`.

Setup uses god mode, diner-anchor placement and the authored store checkpoint;
mission/AI/combat/audio then run normally. These are focused encounter playthroughs.
They do not claim an unmodified full campaign walk or human listening assessment.
Music-only audition WAVs in `source-auditions/` are separately labeled.

## Validation

- `npm run typecheck`, `npm run lint`, `npm run build`: pass.
- Audio unit tests: 17/17 pass.
- `E2E_PORT=3351 npm run verify -- E16`: exit 0; 20 Node / 69 browser tests pass.
- `E2E_PORT=3351 npm run test:smoke`: exit 0; 3 Node / 22 browser tests pass.
- Browser runs use the two-slot machine lock, headless only, two workers.
- Full check commands/results and case names: `audio-upgrade-validation.json`.
  File provenance: `assets/audio/LICENSES.md`, mirrored into public assets;
  source loudness: `recorded-source-loudness.json`.

Full `test:unit` ran: 166 pass / 6 fail under shared-machine load. Three static/asset
files timed out; serial rerun passed all six tests without changing thresholds.
The remaining three authored-animation assertions reproduce exactly on merged
main in an isolated git archive. Their values and rerun evidence are recorded in
`audio-unit-baseline.json`; this lane does not edit animation code or criteria.
Thus the global unit suite is not fully green; this is an existing main exception.

## Limits and audition decisions

A shared score palette currently serves L1–L6. Recorded accents are filtered
excerpts, not isolated instrument stems. Human dialogue, engines/explosions,
some exotic surfaces/creatures and diegetic jingles retain procedural cues.
Stone Foley substitutes for asphalt; the dog source does not identify breed.
Signal measurements cannot establish emotional fit: the product owner should
listen to the previews. No John Murphy material is sampled or imitated.

Historical committed fixture WAVs/screenshots are retained unchanged. Current
upgrade evidence is the new validation/preview JSON and scratchpad WAVs; the
older fixture audio is not presented as a recording of the upgraded mix.
