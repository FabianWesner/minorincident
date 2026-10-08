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

All browser runs use `E2E_PORT=3357`, the shared e2e lock, headless ANGLE/Metal,
and at most two workers. Heavy sim/unit runs use the shared sim lock.

- `npm run typecheck` and `npm run lint`: pass.
- `sh tools/sim-lock.sh npx vitest run tests/unit --maxWorkers=2`:
  101 files / 358 tests passed before the additional recovery test.
- `E2E_PORT=3357 sh tools/e2e-lock.sh npx playwright test tests/e2e/audio --project=chromium --workers=1`:
  first pass 47/48; L2's final silence assertion ran just before the fade settled,
  and that run also saw transient model 404s against the crash-era preview build.
  The strict gains and deadlines were preserved; the poll now waits for both sides.
- Clean-build danger encounter rerun: L1 onset **786 ms**, release **7721 ms**;
  L2 onset **811 ms**, release **7715 ms**. Maximum sampled summed deck gain 0.6.
  L2's ten-second threat-free escape and safe-checkpoint release also passed.
- `npm run scene -- specs/scenes/qa-courier-attack-bat.json --frames 120 --shots 90 --out test-results/epics/E16/danger-scene`:
  pass; zero console errors, undrawn frames and actor clipping hits. Body overlap
  5.2 cm (gate 6 cm); 27 draw calls / 104110 triangles at p95. Screenshot reviewed:
  courier and all five infected visible, bat attack presented. This visual scene
  checks the encounter presentation; the music gains are measured in the full game.

- `npx vitest run tests/unit/audio/danger.test.ts --maxWorkers=2`: 4/4 passed,
  including the added down/recover regression (pure director tests, 194 ms).
- `E2E_PORT=3357 sh tools/e2e-lock.sh npx playwright test tests/e2e/audio/danger.spec.ts --project=chromium --workers=1`:
  the two encounter tests and escape test passed. The new attack fixture supplied
  an empty rack; corrected to a bat left rack / fists right rack.
- The same locked browser command with `--grep 'starting a player attack'`:
  1/1 passed after correcting the fixture. All four final danger browser cases
  have passed; the clean encounter run produced no model 404s.
- `E2E_PORT=3357 npm run verify -- E16` and
  `E2E_PORT=3357 npm run test:smoke`: queued on the shared sim lock at this checkpoint.
  Logs: `test-results/danger-verify.log`, `test-results/danger-smoke.log`.

## Deviations and limits

No specification files or existing audio-test thresholds were changed. Local
encounters use immediate fades to meet the requested one-second response; explicit
intensity events and offline fixtures retain the existing bar-based behavior.
Browser checks are headless WebGL2 on ANGLE/Metal; WebGPU remains manual.
