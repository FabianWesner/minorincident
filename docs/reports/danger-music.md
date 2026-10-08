# Danger music regression

## Cause and history

`git log -S 'alerted / 20' -- src/audio` points to `cd0118ae` (E16 director).
The live adapter counted alerted/chasing infected within 30 m; a single infected
scored 0.05, whereas the recorded combat state required 0.2 (four alerted infected).
Idle/wandering infected contributed nothing and starting a player attack did not
select combat. Bar scheduling and a two-second stream fade added further delay.
That crowd-based rule missed the reported small L1 encounter.

`4e888add` introduced the licensed streamed score and retained that rule.
`b513fe68` changed only L1's calm recording to coffee-shop jazz. It did not remove
the director or rock recording. Searches of the audio history and current banks
confirm that no asset restoration is necessary.

## Change

- `9e9e3a07`: perceive living infected within 12 m using telegraph camera visibility
  and sim sight blockers; player attacks also engage danger. Preload the existing
  combat stream silently, crossfade over 0.8 s, hold for seven seconds after the
  last perceived threat, and return to the current level/story bed.
- `8f30a560`: exclude hidden ambush actors as well as dead/downed infected.
- Follow-up: exercise down/recover through the director and capture encounter
  screenshots. The browser release check waits for both sides of the fade to
  reach the original gain thresholds within the original deadline.

The recovered implementation also reads serialized L1–L3 mission beats: L1's
outbreak holds tension, L2's collapse/escape holds rock until the police checkpoint,
and L3 uses its highest active objective floor. A local encounter temporarily
raises that story floor; safety releases it. This is additional scope retained
from the crashed run and is covered by unit and L2 escape browser tests.

## License

Reuse `score-combat.webm` / `.m4a`: **Blinding Lights — Zander Noriega,
CC-BY 3.0**, excerpt 32–128 s. Already listed in `assets/audio/LICENSES.md`,
`public/assets/audio/LICENSES.md`, `src/data/credits.ts` (in-game Credits & Licenses),
and `THIRD_PARTY_NOTICES.md`. No new recording or dependency was added.

## Validation

Validation results and measured timings are recorded here after the final run.

## Deviations and limits

No specification files or existing audio-test thresholds were changed. Local
encounters use immediate fades to meet the requested one-second response; explicit
intensity events and offline fixtures retain the existing bar-based behavior.
Browser checks are headless WebGL2 on ANGLE/Metal; WebGPU remains manual.
