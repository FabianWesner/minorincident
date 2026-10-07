# Courier footwork (Fable round)

Lane `lane/player-anim-r1`, on top of the round-one skinned courier (`31ba3417`, merged main `60578a6a`). No push, no merge into main, no deployment; sim untouched (animation is presentation only). The courier meshes, fitted skeleton and retained CC0 clips stay; the Mesh2Motion avatar was not revisited.

## What the PO saw, and why

Three complaints, one cause: the fitted courier's legs were driven by a "flat planted ankle" solver whose swing knee was capped at ~24° (foot lift 8 mm, a shuffle), and whose turn handling released both feet to a body-relative neutral that rotates with the body. Side by side at the game camera the rigid figure (PROD, `?skin=0`) reads as *stepping* (visible knee, 5 cm lift, legs apart) while the skinned one glides on nearly straight legs; in a turn the skinned figure stands on both feet and spins ("skating when I turn"). Model-free contact metrics on the old build confirm it: the swing foot never clears 1.2 cm (counted as 60+ cm of "slide" per cycle), and in a 180° turn the planted feet yaw 180° with the body.

Path chosen: keep the skinned mesh (PO: "with skin=1 is better") and give it the rigid figure's legibility plus real footwork, rather than reverting to the rigid build. `?skin=0` is untouched and still available.

## Changes

`src/render/characters/CourierGroundContacts.ts` (rewritten), `KeyframeAnimator.ts` (cadence, start phase), `clips.ts` (documented gait shape).

- **World-locked feet.** A foot on the ground keeps its world position *and yaw*. It leaves only by a gait swing (distance-driven phase past the stance fraction) or by a timed step (0.14–0.17 s) when the body has twisted more than 24° (standing) / 32° (moving) or drifted 5.5 cm away from it. One foot steps at a time while walking or standing; both are airborne only in running flight. A hard pivot clamp exists at 70° but is counted (`pivots`) and never engaged in the measured scenarios.
- **Turn footwork.** Turning in place is a sequence of alternating steps that land on the current heading; turning while moving lets the swing foot land on the new heading while the stance foot stays planted. A keyboard 180° at the 6 rad/s presentation cap and click-to-move turns at the sim's 4.5 rad/s both resolve with steps.
- **Readable swing.** Swing height follows a knee profile (release flex → 68° walk / 85° run → the landing flex the geometry needs) with guaranteed clearance, bounded so a trailing foot never kicks above ~14 cm and the knee never races through the straight-leg singularity. Heel-to-toe roll: the heel rises about the toe contact before toe-off, the heel strikes first and settles flat. Swings land where they arrive (no touchdown jump); the plant is the heel contact's flat-foot ankle.
- **Stops and starts.** A stop converts an in-flight swing into a short step and leaves feet where they landed unless they are more than 5.5 cm from the resting stance (then one step each, not a slide). Movement starts mid-stance so the first step is a real step; a foot the leg can no longer reach releases early.
- **Pelvis.** Rides the supporting legs on a soft knee (14° + compression at mid-stance), descends in anticipation of heel strike, holds its arc through running flight, and shifts 2.8 cm over the support foot during standing steps. Walk bob ~2.5 cm, run ~3 cm.
- **Cadence.** Fitted courier walk 2.9 Hz (was 2.5), run 2.9 Hz (was 2.7) so the 0.4 m legs can reach the stride; stance 0.52 walk / 0.27 run.

Unchanged: torso/arm fitting from round one, posture guard, melee timing and lunge, mount/dismount, rider IK, weapon stowing, `face()` turn rates, the rigid (`skin=0`) figure.

## Measurements

Model-free contact metrics (`tools/playeranim/metrics.ts`): heel and toe points from the foot node, a foot is grounded while its lowest point is within 1.2 cm of the floor, slide is the motion of the grounded point per contact, yaw drift the foot yaw change per contact. 60 Hz recorded `CharacterView` poses, sim-like turns (yaw 4.5 rad/s, travel follows yaw; running 180° at 6 rad/s). Female / male.

| Scenario | Rigid `skin=0` slide max / yaw drift | Old skin (QA) slide max / yaw drift | New slide max / yaw drift | New lift / knee |
| --- | --- | --- | --- | --- |
| walk 2 m/s | 5.1 / 0 cm, 0° | 63 / 61 cm (shuffle), 0° | **0.05 / 0.04 cm**, 0° | 8–10 cm, 68° |
| run 4.5 m/s | 5.1 / 0 cm, 0° | 68 / 68 cm, 0° | **0.05 / 0.05 cm**, 0° | 14 cm, 85° |
| start–stop | 5.1 / 3.0 cm | 63 / 61 cm | **0.3 / 0.05 cm** | – |
| walk turn 90° | 5.1 / 0 cm | 82 / 61 cm, 90° / 30° | **0.08 / 0.19 cm, 2.4° / 4.3°** | – |
| walk turn 180° | 5.1 / 0 cm | 68 / 91 cm, 112° / 85° | **0.14 / 0.20 cm, 4.3°** | – |
| turn in place 180° | 53 / 63 cm, 180° | 45 / 46 cm, 180° | **0.36 / 0.28 cm, 4.3°** (4 steps) | – |
| running 180° (6 rad/s) | 54 / 64 cm, 180° | 46 / 47 cm, 180° | **0.45 / 0.37 cm, 5.7°** | – |

Other: chest pitch never backward (min +2.4° idle, +2.9° gait, +0.9° strikes — unchanged from round one). Max per-frame leg-joint step in steady walk 29–32°, run 39° (male) / 50° (female, one frame at run onset); the rigid figure's run is 32°. Planted strikes keep the authored pelvis snap at bat contact in the leg joints (≤ 58°, was 43° with the body-rotating feet). CPU: `CharacterView.update` + contacts p95 0.03–0.08 ms in the recordings; see `test-results/player-anim-fable/profile/` for the isolated 2,000-frame profile.

Running touchdown: with 0.4 m legs a fully velocity-matched heel strike would need the foot to overshoot the body-space landing point by ~12 cm (out of reach), so a run lands with about half the body speed; the contact frame of a 6 rad/s running turn can carry up to ~4 cm. Walking and standing turns land matched.

## Evidence

`test-results/player-anim-fable/` (small PNG/WebM, actual L1 renderer, game FOV at an 8 m review radius, every sim pose at 60 Hz, 20 fps video, dialogue overlays hidden):

- `before-skin0-*` rigid PROD figure, `before-skin1-*` the QA build (`31ba3417`), `after-skin1-*` this round; female and male.
- Videos per variant: `*-idle-walk-stop.webm` (5 s), `*-click-turns.webm` (click-to-move 180° from standing, 90° and 180° while moving, stop; 4.75 s), `*-run-turns.webm` (keyboard run, 180°, 90°, stop; 4.5 s), `*-fight.webm` (fast-click fists + bat, 7.5 s), `*-bike.webm` (mount, ride, stop, dismount; 4.25 s).
- `compare-<variant>-<state>.jpg`: six-frame strips, rows rigid `skin=0` / old skin / new, same moments, for walk, stop, run, running 180°, click 180° from standing, click 180° while moving, bat, ride.
- JPEG stills at ticks 0/12/30/60 of each scene (turn scenes every 6 ticks).
- Offline recordings `before-rigid/`, `before/`, `after/` (gzip) and `metrics.json`; gate logs in `gates/`.

Reproduce:

```sh
npx vite --host 127.0.0.1 --port 3377 --strictPort --configLoader runner
E2E_PORT=3377 sh tools/e2e-lock.sh npx tsx tools/playeranim/fable-capture.ts test-results/player-anim-fable --tag=after --skin=1
npx tsx tools/playeranim/record.ts test-results/player-anim-fable/after after
npx tsx tools/playeranim/metrics.ts test-results/player-anim-fable before-rigid before after
```

## Validation

VALIDATION_TABLE

## Review and remaining weaknesses

REVIEW
