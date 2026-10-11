# First-click gun raise — 2026-10-11

## Frame review

Inspected all 16 contact sheets below, frame by frame. Captures use headless Chromium, macOS Metal WebGL2, 60 fixed ticks/s, 1280×720, high tier. A one-tick click occurs at script frame 20 (sim tick 21). Walking resumes immediately after the click and remains at 2 m/s through discharge. The walking character turns toward its target while its legs continue walking; the gun heading blends from the previous carry heading.

| Frame | Since tap | Handgun pitch | Army MG pitch | Observation in both cameras |
| --- | ---: | ---: | ---: | --- |
| 19–20 | before | −43.0° | −37.2° | Low carry, palm attached, other hand empty. Walking gait already active. |
| 21 | 0 ms | −43.0° | −37.2° | Click accepted; gun stays in carry, no flash/tracer. |
| 22 | 16.7 ms | −39.8° | −34.5° | Raise begins gently, no discharge. |
| 23 | 33.3 ms | −31.8° | −27.6° | Forearm and barrel visibly rising together. |
| 24 | 50 ms | −21.5° | −18.6° | Midpoint; no gun pivot through the fingers. |
| 25 | 66.7 ms | −11.1° | −9.7° | Barrel approaching target height; no flash. |
| 26 | 83.3 ms | −3.2° | −2.8° | Nearly level; still no shot. |
| 27 | 100 ms | 0° | 0° | First discharge from the level muzzle. Walking continues. |
| 28–30 | 117–150 ms | 0° | 0° | Raised hold, flash/tracer fade; MG casing moves away. |

Close views show a continuous shoulder/forearm lift, with the palm fixed on the grip. Game views show the same transition at ordinary play scale: low carry, rise, then flash. No bat is visible in any frame. Female and male poses both keep the stock outside the torso; all 16 geometry probes report zero gun/body intersections. At frame 27, tracer origin equals the muzzle socket within the existing 5 cm bound; grip distance stays below the existing 0.1 mm bound. Pitch changes stay below the existing 0.2-per-tick vertical-vector bound. Walking also blends horizontal heading, so that bound is deliberately a pitch check.

| Character / gun | Idle close | Idle game | Walking close | Walking game |
| --- | --- | --- | --- | --- |
| female / handgun | [idle close](captures/female-handgun-idle-close.jpg) | [idle game](captures/female-handgun-idle-game.jpg) | [walk close](captures/female-handgun-walk-close.jpg) | [walk game](captures/female-handgun-walk-game.jpg) |
| female / army-mg | [idle close](captures/female-army-mg-idle-close.jpg) | [idle game](captures/female-army-mg-idle-game.jpg) | [walk close](captures/female-army-mg-walk-close.jpg) | [walk game](captures/female-army-mg-walk-game.jpg) |
| male / handgun | [idle close](captures/male-handgun-idle-close.jpg) | [idle game](captures/male-handgun-idle-game.jpg) | [walk close](captures/male-handgun-walk-close.jpg) | [walk game](captures/male-handgun-walk-game.jpg) |
| male / army-mg | [idle close](captures/male-army-mg-idle-close.jpg) | [idle game](captures/male-army-mg-idle-game.jpg) | [walk close](captures/male-army-mg-walk-close.jpg) | [walk game](captures/male-army-mg-walk-game.jpg) |

The final corrected-source replay passes all 16 cases, and its sheets match the inspected sheets byte for byte; see [review audit](comparison/capture-review-audit.json). Each sheet has its matching JSON probe file. Full-size handgun close frames 20, 23, 26, and 27 are also retained for idle and walking. [Capture summary](captures/summary.json) records all 16 passes.

## Reproduction

```sh
SCENE_PORT=3347 sh tools/e2e-lock.sh sh -c 'npx tsx tools/scenelab/gun-raise.ts > /tmp/gun-raise-captures.log 2>&1'
```

The capture tool uses a private port; it does not start a server on 3300. Optional `GUN_RAISE_CASE` selects names by regex.

## Implementation

The player action runner prepares a gun for six fixed ticks. A pre-aimed gun spends only the remaining preparation ticks; held fire retains the weapon's original cadence after the first discharge. NPC gun timing is unchanged. Ammo, noise, hit resolution, sound and muzzle presentation occur on the discharge tick. Releasing a tap still fires; switching weapons or disabling the player cancels an unfired raise without spending ammunition. Preparation and the post-shot ready interval participate in the deterministic snapshot.

The renderer follows the same fixed-tick preparation with smoothstep, including horizontal heading from the previous low carry. Palm attachment and the selected-weapon visibility rules from gun-hold are retained.

See [simulation comparison](comparison.md) for the independent L3 failures and their provenance.
