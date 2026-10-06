# Audio side track — research and implementation log

Research date: 2026-10-06. Public source repository and browser game: recordings
must permit commercial use, editing, and redistribution of the actual files.
No John Murphy recordings, samples, melodies, or imitation score are used.
The reference is a mood: patient guitar build, rhythmic pressure, then release.

## Music shortlist

These are real composer recordings, not generated oscillators. Fits below are
editorial judgments from the artists' descriptions and arrangement analysis;
the product owner should audition the WAV previews before judging emotional fit.

| Track | Author | Source and verified license | Slot / fit |
| --- | --- | --- | --- |
| Blinding Lights | Zander Noriega | [OGA](https://opengameart.org/content/blinding-lights), [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Primary tension/combat: cinematic post-rock, guitars, mallets, drums and an emotional build. |
| Running free | bbatv1 | [PEACE is king here](https://opengameart.org/content/peace-is-king-here), CC-BY 3.0 | Morning: gentle post-rock guitar. |
| Oscillator | bbatv1 | Same album/page, CC-BY 3.0 | Tension alternative: repetitive motion in the same guitar palette. |
| That feeling you give me. | bbatv1 | Same album/page, CC-BY 3.0 | Calm alternative: warm instrumental contrast to the outbreak. |
| a long night, | bbatv1 | Same album/page, CC-BY 3.0 | Night/aftermath: longer reflective post-rock arc. |
| why? | bbatv1 | Same album/page, CC-BY 3.0 | Aftermath alternative: restrained and reflective. |
| keep you heart close to your chest. | bbatv1 | Same album/page, CC-BY 3.0 | Morning/aftermath: emotive instrumental continuity. |
| Nice To | bbatv1 | Same album/page, CC-BY 3.0 | Calm alternative from a coherent album. |
| isn't the rain nice today? | bbatv1 | Same album/page, CC-BY 3.0 | Quiet exploration/aftermath. |
| comfort in uncertainty | bbatv1 | Same album/page, CC-BY 3.0 | Primary aftermath: gentler guitar resolution. |
| The Complex | Kevin MacLeod | [Incompetech track](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300025), [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Backup combat: accumulating electronic/percussion pressure; less guitar-focused. |
| Pressure | yd | [OGA](https://opengameart.org/content/pressure), CC0 | Backup rising tension: dark background composition. |

Only selected tracks are shipped. CC-BY edits (extracts, filtering, normalization,
loop fades, encoding) must be identified in credits, notices and the ledger.
Zander specifically requests a linked author credit in HTML; preserve that.

## Community and forum leads

- [r/gamedev Sonniss announcement](https://www.reddit.com/r/gamedev/comments/11weehj/): recorded Foley is a stronger starting point than procedural noise.
- [r/GameAudio Sonniss discussion](https://www.reddit.com/r/GameAudio/comments/128d7mf/): large professional libraries; inspect the actual publisher license.
- [r/GameAudio CC0 sources](https://www.reddit.com/r/GameAudio/comments/1vzg6le/what_cc0_sample_sources_do_you_use/): filter OGA/Freesound per item.
- Searched r/indiegames for royalty-free horror music; no independently verified redistribution-safe guitar recording emerged there. [Adjacent IndieDev discussion](https://www.reddit.com/r/IndieDev/comments/1tnozj3/how_do_yall_handle_music_in_your_game/) reinforces checking game rights rather than equating download access with permission.
- [r/WeAreTheMusicMakers promotion thread](https://www.reddit.com/r/WeAreTheMusicMakers/comments/1gnwlfr/): possible CC attribution composers, but a post alone is insufficient for asset provenance.
- [Post-rock licensing discussion](https://www.reddit.com/r/postrock/comments/c91rod/any_postrock_artists_here_with_creative_commons/): useful leads, often NC; verify individually.
- [Unity forum Sonniss discussion](https://discussions.unity.com/t/massive-library-of-sound-effects/839729): confirms discovery route, not a license grant.

## Library decisions

| Library | Decision for this public repo |
| --- | --- |
| OpenGameArt | Use only individually verified CC0/CC-BY files; a collection's label cannot clear all its contents. |
| Incompetech | [Publisher licensing](https://incompetech.com/music/royalty-free/licenses/) and track page verify CC-BY; retain track title/author/link/license. |
| Free Music Archive | [License guide](https://freemusicarchive.org/License_Guide): per-track verification required; many post-rock candidates have NC/ND terms. No FMA file selected. |
| Freesound | [License FAQ](https://freesound.org/help/faq/#licenses): CC0/CC-BY accepted, NC and legacy Sampling+ rejected. Fantozzi recordings used through the OGA mirror with its CC0 grant. |
| Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds), CC0, accepted for UI. |
| Sonniss GDC | [License](https://sonniss.com/gdc-bundle-license): finished games allowed, standalone sound redistribution restricted. Good closed-distribution alternative; hold for this repo's exposed assets. |
| Pixabay | [Content License](https://pixabay.com/service/license-summary/): game integration is possible, standalone distribution restricted. Hold rather than publishing raw reusable files in this repo. |
| Mixkit | [Actual music terms](https://mixkit.co/license/modal/musicFree/) explicitly exclude video games. [Actual SFX terms](https://mixkit.co/license/modal/sfxFree/) allow games but forbid distribution with source files. Reject both for this public repo. |
| BBC Sound Effects | [Licensing](https://sound-effects.bbcrewind.co.uk/licensing): RemArc is non-commercial; reject for this public redistributable game. |
| OGA Post rock song (incl stems) | [Page](https://opengameart.org/content/post-rock-song-incl-stems): CC-BY-SA, outside the requested CC0/CC-BY allowance; reject. |
| OGA Dog & bird ambience | [Page](https://opengameart.org/content/dog-bird-ambience): GPL-only; reject. |

## SFX shortlist and intended treatment

| Need | Source / author / license | Treatment |
| --- | --- | --- |
| Asphalt and grass footsteps | [Fantozzi's Footsteps](https://opengameart.org/content/fantozzis-footsteps-grasssand-stone), Fantozzi, CC0 | Four separate stone and grass samples, pitch ±3%, gain ±1 dB. Stone maps to asphalt/sidewalk. |
| Fists, kicks, bat, crowbar, machete on flesh | [37 hits/punches](https://opengameart.org/content/37-hitspunches), Independent.nu, CC0 | Body thump pools plus material transient; impact tied to hit, swing kept separate. |
| Infected groans, attack/bite and transformation | [Zombie Sound Effects](https://opengameart.org/content/zombie-sound-effects-by-bendzer), Bendzer, CC-BY 4.0; [Undead Moans](https://opengameart.org/content/undead-moans), AntumDeluge, CC0 | Recorded mouth performance, distinct pools, transformation swell. |
| Crowd panic/screams | [Crowd Shouting](https://opengameart.org/content/crowd-shoutingspeaking-ambience), StarNinjas, CC0; [Female scream](https://opengameart.org/content/female-high-pitched-scream-sfx), WuxiaScrub, CC0 | Layer restrained crowd with isolated cries; no wall of identical screams. |
| UI | [Interface Sounds](https://kenney.nl/assets/interface-sounds), Kenney, CC0 | Short quiet clicks/confirmations, four variants. |
| Morning birds | [Ambient Bird Sounds](https://opengameart.org/content/ambient-bird-sounds), per-page CC0 | Recorded outdoor bed, seam fades. |
| Sirens/traffic | [Sirens and Alarm Noise](https://opengameart.org/content/sirens-and-alarm-noise), aquinn, CC0; [High traffic road sounds](https://opengameart.org/content/high-traffic-road-sounds), IgnasD, CC0 | Recorded traffic and distant filtered siren bed. |
| Corgi barks | [Dog barking mono](https://opengameart.org/content/dog-barking-mono), Brandon Morris, CC0 option | Four real barks, modest upward pitch; dog breed not asserted by source. |

## Implementation and validation

Implemented: four long stereo recordings stream through the existing E16 music
bus with two-second fades. The next deck must start successfully before the old
deck fades; transitions use the existing bar grid. Calm uses Running free;
tension uses Blinding Lights 0–32s; combat uses its 32–128s escalation; aftermath
uses comfort in uncertainty 16–112s. A shared palette currently serves L1–L6;
separate per-level curation remains future work. Accent layers are filtered
recorded excerpts, not claimed to be isolated instrument stems. These rhythm
layers sit low enough to preserve the full track's melody.

285 of 490 sprite cues use recordings. Four-slice pools prevent immediate
repetition; most SFX vary pitch ±3% and level ±1 dB. Telegraph timing/pitch and
levels stay stable so the +3 dB offscreen information remains exact. HRTF,
distance attenuation, occlusion, ducking and the master limiter remain in use.
Body impacts now happen on contact at the target position; bamboo swooshes are
separate swings. Wet towel Foley provides gore transients. Civilian bite screams
and the rising-stage transformation use real vocal recordings. Human dialogue,
some exotic creatures/surfaces, engines, explosions and diegetic jingles remain
the original procedural system cues; this is not a claim that every cue has
been replaced with a recording.

The importer pins master/download SHA256 hashes and refuses silent/truncated
extracts. Older tiny FLACs have broken seek tables; decoded-sample trimming is
used instead of input seeking. Stereo score is 96 kbps, mono sprites 32–48 kbps
in WebM/Opus and fast-start M4A/AAC. Both startup codec variants combined are
4,018,675 bytes; the actual Opus path is 1,894,934 bytes. Long tracks are not
downloaded before the first gesture. WAV masters stay outside git.

Credits list every CC-BY track/pack, linked authors/licenses and modifications;
the ledger names each encoded file and every recorded sprite slice. Original
archive notices are preserved, including older MIT notices in the qubodup
packs alongside their current OGA CC0 grant.

Validation in progress: E16 headless verification/capture on port 3351 waits on
the machine-wide E2E lock. Typecheck, lint and audio units pass. Full unit suite:
166 pass, three authored-animation tests fail identically in an isolated archive
of main 202ffc2 (baseline reproduction stored in /tmp/audio-1-baseline-result.json).
No animation code or criteria are changed by this lane.
