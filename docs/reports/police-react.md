# Police reaction and gun hold — 2026-10-11

## Changes and causes

The camera restriction could discard nearby attackers, including cached targets. Regroup orders also cleared a shot every tick before its strike tick, so distant squad members could aim without firing. Grabbed humans skipped the ally brain entirely. Close defence now interrupts idle/regroup, pending shots survive regroup, and a grabbed officer shoves through the normal damage/stagger/rescue pipeline. Officers keep moving while firing during retreat. The yard gate waits for all recruited living officers; its old 15-second timeout could trap a rescued officer inside permanently.

Officers defend against infected within 10 m with clear line of sight. Longer shots retain the existing camera-derived restriction and 6 m shooter reach. A biting infected gets target priority so nearby colleagues help. All armed ally roles use the existing `InfectedSystem.hearing` Perception for the 2 m awareness interrupt; walls still block hearing. No ammunition/reload system was introduced.

The crowd reuses the player's gun pose solver for low ready and aim. Idle/walk/run put the barrel forward/down; aiming raises it toward the live target, and the held prop and muzzle read the corrected hand matrix. Both officer gait variants use the same correction. Combat presentation turns at 14 rad/s (180 degrees in about 0.225 s). Moving bite/grab reactions retain their hurt clip instead of being replaced by a walk clip.

## Inspected Scene Lab evidence

All seven scenes ran headless with real ally/outbreak behaviour and passed capture/console/reaction checks. Times are simulation ticks at 60 Hz; the CLI fails if a defensive attack exceeds 24 ticks. Every officer in each combat scene reacted.

| Scene | Measured first attack | Contact sheet inspection |
| --- | --- | --- |
| [Behind approach](../scenes/police-react/behind.json) | 2 ticks / 0.033 s | [Sheet](../scenes/police-react/captures/behind/sheet.jpg): f0 low ready, f10 turned and aiming, muzzle/tracer toward attacker; f160–180 contact shove, blood and infected flinch. |
| [Three rush squad](../scenes/police-react/rush.json) | All three: 2 ticks | [Sheet](../scenes/police-react/captures/rush/sheet.jpg): all three raise and fire, spread/reposition; f90–130 infected flinch and fall; officers lower their pistols after targets go down. |
| [Grab alone](../scenes/police-react/grab-alone.json) | 19 ticks / 0.317 s | [Sheet](../scenes/police-react/captures/grab-alone/sheet.jpg): real grab at f0; officer turns/shoves before bite completes, attacker recoils by f20; firing and backsteps follow. |
| [Grab with colleague](../scenes/police-react/grab.json) | Helper: 2; grabbed officer: 19 | [Sheet](../scenes/police-react/captures/grab/sheet.jpg): helper fires immediately, grabbed officer shoves, attacker flinches/blood; continued shots show flashes at the pistol tip. |
| [Carry variant 0](../scenes/police-react/carry-0.json) | First shot: 212 (threat spawned at 210) | [Sheet](../scenes/police-react/captures/carry-0/sheet.jpg): f0–30 idle, f45–90 walk, f135–150 run, f225 aim, f255 flash. Pistol stays in the right hand, forward/down in carry; raised toward the target when aiming. [Aim f211](../scenes/police-react/captures/carry-0/shot-0211.png), [shoot f212](../scenes/police-react/captures/carry-0/shot-0212.png). |
| [Carry variant 1](../scenes/police-react/carry-1.json) | First shot: 212 | [Sheet](../scenes/police-react/captures/carry-1/sheet.jpg): other officer id/gait and uniform tint; same idle/walk/run/aim/shoot coverage and attached forward-facing pistol, with no sideways barrel or weapon behind the head. [Aim f211](../scenes/police-react/captures/carry-1/shot-0211.png), [shoot f212](../scenes/police-react/captures/carry-1/shot-0212.png). |
| [Bitten](../scenes/police-react/bitten.json) | Scripted infection, no attack timing gate | [Sheet](../scenes/police-react/captures/bitten/sheet.jpg): bite at f30, hurt/stagger f40–80, collapse f90–130 and infection reaction. This separate fixture shows the injury animation because the defence fixtures rescue before the bite finishes. |

One officer character asset exists (`npc.police-officer`); the two carry fixtures cover its two alternating crowd gait variants. The pistol solver is shared across uniform tints and officer roles. Raw reaction events are retained beside each sheet as `reaction.json`.

Reproduce: `SCENE_PORT=3388 sh tools/e2e-lock.sh npx tsx tools/scenelab/police-react.ts`.

## Validation

- Typecheck, lint and production build passed. **52 focused remote tests passed**, covering offscreen defence, pending strikes during regroup, retreat movement, colleague rescue, four ally roles hearing behind at 1.8 m / wall rejection, live L3 grabs, gate timeout, gun pose and hurt presentation.
- Full remote unit suite: **817 passed / 4 failed (821 tests)**; four pre-existing static bake failures (clinic-annex LOD1/LOD2 and police-station LOD1/LOD2). The same four fail on clean base `5a9d2682`; unrelated baked assets were left untouched. Full unit green is therefore unavailable on this base.
- Browser smoke: **12 passed** (Chromium, phone portrait/landscape, WebKit); remote simulation smoke: **6 passed**. L3 browser level spec: **4 passed** (Commerce, Boulevard, Oak and L4 handoff); every route had **0 player deaths**. The first rerun reached the endpoint but hit asset 404s during a concurrent rebuild; the stable-build rerun passed all checks. [Route results](police-react/validation.json).
- Single-seed L3 complete bot (seed 1): complete in **226.35 s**, **0 player deaths**, checkpoint reached. [Result](police-react/L3-complete-seed1.json). This pass preceded the final yard-gate guard and stale-target cleanup; the final browser routes and regressions exercise those changes. No additional complete-bot balance runs were used as a gate.
- Full `verify -- E21` was not used: it runs additional complete/newbie/forced-route bot balance assertions beyond the requested single complete-bot pass. This report does not claim the epic's historical squad-loss/balance criteria have been revalidated.

No spec edits, merge or deployment.
