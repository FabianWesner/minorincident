# PKG-07 / PKG-08 — two-handed long guns

Scope: FIX-06 support hand and FIX-07 carry. Baseline is untouched `83969f51`; after captures use this worktree's rendering changes. See [six-line report](report.md) and [capture manifest](captures.json).

## Changes

The selected long gun has a fitted trigger-relative fore-end contact and size. The torso takes a bladed stance; both arms solve to the trigger and fore-end, including recoil. A stable barrel roll prevents the left palm flipping away when turning backwards. Spine/chest/clavicle gait rotations are overridden while holding the rigid weapon; hip and foot movement remain animated. Carry uses a shallow downward barrel angle and shoulder clearance. Crowd rifle/HMG props use the same solver with their existing +Z barrel convention. Gun selection retains the existing single selected attachment, so the bat appears only when selected.

## Reviewed visual evidence

All retained files are enumerated in `captures.json`. Each case has a before/after `sheet.jpg`, a full-resolution firing/recoil frame (`shot-0080.png` for couriers, `shot-0114.png` for allies), and finite-magazine close cases have `reload.png`. Both the normal game camera and the unchanged radius-6 Scene Lab camera were inspected. Sheets include the entire sequence, including idle, locomotion, turning and switching. Only this acceptance set is retained.

| Cases (each in `captures/{before,after}/<case>-{game,close}/`) | Before observation | After observation |
| --- | --- | --- |
| `female-assault-rifle`, `male-assault-rifle` | Extended right arm; left hand hangs near the belt during shooting. | Bent firing elbow, stock at shoulder, left palm under fore-end; contact follows firing and the reverse turn. |
| Both variants: `hunting-rifle`, `shotgun` | Long muzzle drops beside the leg in carry; unsupported gun while aiming. | Forward low ready clears floor and hip through the stride; both hands stay on grip/fore-end during aim and recoil. |
| Both variants: `machine-gun`, `army-mg` | Oversized gun/ammunition box sits beside the legs; left hand does not support it. | Fitted gun and box clear chest/legs, supported fore-end, level firing barrel. Army MG has no campaign reload. |
| Both variants: `rocket-launcher` | Tube is a one-handed carry and descends toward the road. | Tube rides beside the shoulder, both grips supported, rear tube clears head/chest and front clears floor through walking, running and turning. |
| Both variants: `smg` | Support hand is detached while firing. | Left palm stays under fore-end, including reverse heading; no head collision in the reviewed turn. |
| `civilian-rifle`, `civilian-hmg`, `civilian-hunting-rifle` | Free left arm and low unsupported carry. | Both palms follow the held prop during idle, walk, run, aim and firing; the muzzle remains forward and clear of the ground. |
| `soldier-rifle`, `soldier-hmg`, `soldier-hunting-rifle`, `officer-rifle` | Same unsupported crowd hold. | Shared correction supports the selected prop during locomotion/combat. Officer hit reaction still plays, with grip contact preserved. |

Courier timeline: idle f0, walk f16–39, run f40–63, aim f64, firing f72–95, turn/aim f96, moving fire f112, gun/bat/gun switch f192/208/224. Snapshot scheduling places the bat transition in the f208 sheet cell. Real continuous fire then reaches reload for each finite magazine. Ally timeline: idle f0, walk f20, run f60, idle f100, ally combat activation/target spawn f110, firing/recoil f114/116 onwards. Ally weapons do not have magazine/reload simulation; no reload animation was fabricated.

The soldier's baked secondary weapon (FIX-28) and the crowd rifle/HMG prop shape (FIX-29) remain separate QA findings outside these packages. Their geometry was not removed. These captures assess the held prop's support/carry.

## Reproduce

```sh
LONG_GUN_PHASE=after SCENE_PORT=3387 E2E_SLOTS=4 sh tools/e2e-lock.sh npx tsx tools/scenelab/long-guns.ts
```

The runner is headless Chromium/WebGL2 with ANGLE Metal on macOS, uses existing Scene Lab APIs, and releases the browser lock on exit. `LONG_GUN_CASE` filters the matrix. `before.json` / `after.json` contain checks; each case has sampled joints, attachments and clipping metrics. The new rig unit tests use actual GLB joints for both couriers and civilian/police/soldier crowd palettes across three gait phases, three headings, carry/aim and recoil. They assert fore-end contact, barrel alignment and unchanged feet.

## Validation

See [validation](validation.md) for commands, outcomes and baseline comparisons. No test, tolerance, golden, camera or simulation criterion was changed.
