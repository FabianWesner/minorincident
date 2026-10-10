# Civilian prop grips (cup-hand)

The PO's L1 start bench civilian held a sideways coffee cup around the wrist pivot: the fingers passed through the cup body. Routine props now attach to the displayed, blended hand pose, with the native fingers curled around the grip and an upright wrist for everyday props. Cup, phone, bag, cane, watering can and parcel have matching grip positions. The elderly model's baked cane is removed before the routine supplies its visible cane. Weapons retain their combat orientation.

The cup body keeps its original dimensions. The change uses native hand geometry, with no hidden prop or removed civilian pose. Hand triangles are subdivided before curling so a broad triangle cannot bridge the handle opening; LOD simplification also considers that shape. The shader derives the bent normals and stores the grip flag in the existing instance data. Phone placement uses the submitted hand's fingertip reach, with a 1 mm clearance, so different native hand lengths cannot leave a visible gap. The parcel's teal packing strap supplies a carrying loop; the original box dimensions are preserved.

Scene Lab now samples the actual indexed native hand triangles against the instanced prop's triangles every third frame. `heldPropIntersectionsMax: 0` and `clippingMax: 0` reject any crossing. `heldPropSamplesMin` rejects a missing prop, and visibility/close-LOD gates keep the person drawn. The unit regression tests all five everyday civilian models and also prove that the old cup placement trips the check.

## Reproduce

```sh
E2E_SLOTS=1 SCENE_PORT=3378 npm run scene -- tests/scenes/civilian-grips/*.json --out test-results/cup-hand/scenes
E2E_SLOTS=1 SCENE_PORT=3379 sh tools/e2e-lock.sh npx tsx tools/scenelab/civilian-grip-l1.ts
sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit --maxWorkers=1
E2E_SLOTS=1 E2E_PORT=39395 npm run verify -- E08
E2E_SLOTS=2 E2E_PORT=39396 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels --project=chromium --workers=1
```

The twelve scenes cover each everyday prop, seated and standing. Captures at frames 60, 120 and 180 use the game's lens and polar angle, at PO azimuth 45°, front 90°, and side 0°. The L1 probe selects the orange-hoodie coffee sitter nearest the shipped start, without spawning a replacement, and captures the PO angle plus the standard game-camera radius.

## Vision review and validation

Reviewed all 36 captures (PO angle, front and side for both poses). Each of the twelve scenes records 60 hand/prop samples over 180 frames: **720 samples, zero intersections**, with zero static/actor clipping, console errors, undrawn frames or close-camera far LODs. Contact sheets preserve all three views; full-size side captures supplement the small grip details.

| Prop | Seated and standing capture review |
| --- | --- |
| [Coffee](cup-hand/coffee.jpg) | Cup upright; fingers surround the top handle bar. The front view shows the open handle, and the [side view](cup-hand/coffee-side.png) keeps skin outside the cup wall. |
| [Phone](cup-hand/phone.jpg) | Case meets the fingertips; screen visible from the front. The [side view](cup-hand/phone-side.png) shows the edge grip without a floating gap or fingers crossing the case. |
| [Bag](cup-hand/bag.jpg) | Fingers curl under the dark carry handle; bag body hangs below the hand in all three views. |
| [Cane](cup-hand/cane.jpg) | Fingers hold the crossbar; the shaft remains upright beside the figure. |
| [Watering can](cup-hand/watering-can.jpg) | Fingers hold the top carry handle; body and spout remain outside the hand. |
| [Parcel](cup-hand/parcel.jpg) | Fingers hold the teal strap loop and the box hangs below it. The [side view](cup-hand/parcel-side.png) shows a supported grip. |

The shipped L1 capture finds entity **96**, the orange-hoodie/cap coffee sitter next to the start at **(-67.7055, 11.56)**, seed 1, tick 120. In the [PO close-up](cup-hand/l1-po-angle.png), the mug is upright and the fingers hold its handle outside the body; the [standard game-camera capture](cup-hand/l1-game-camera.png) includes the bench, courier and corgi at the same spot. No replacement civilian is spawned.

Typecheck, lint and build pass. E08 verification passes all 39 selected unit/simulation checks and 31 browser checks, including smoke on Chromium, phone portrait/landscape profiles and WebKit, plus real WebGL/WebGPU crowd visibility. The full remote unit suite passes 450 tests; the final five-model grip regression also passes remotely after the phone and parcel refinements.

The full levels gate is **outstanding**, deferred to the orchestrator at its deploy cutoff. The last completed full serial run was **29/31** (L4 WebGPU body probe and L5 escort failures); their focused rerun is now **3/3 green**. A subsequent full run was stopped after an assisted L1 routing failure; the aim-plane correction described below was made afterward. The initial two-worker run passed 27 of 31; four failures all passed on unchanged `main` with one worker. Serial validation exposed three harness issues, addressed without changing gameplay or acceptance assertions:

- L1's assisted route skipped combat in god mode, although invulnerability does not remove body collisions. Both routes now use the existing real-input fighting helper. Its aim projection now also uses the courier floor, matching `RayCursor` at the raised fire-station apron.
- L4's body pixel probe assumed an upright torso, missing a lunging infected despite a valid draw. It now follows the submitted head/hip joints and slopes its pixel strip along the torso. The minimum visible figure count and pixel coverage thresholds are unchanged.
- L5's driver ranked most threats by distance to the courier and only approached unseen follower threats after cover activated. It now prioritizes distance to the followers and approaches those threats earlier. The real-input interactions, all five survivor cues, group-photo survival and campaign handover assertions are unchanged.

The final L1 aim correction has not completed validation: its repeat run was interrupted at the orchestrator's request. No final green full-level result is claimed. Latest `main` was merged into this worktree before finishing; typecheck, lint and build were rerun after that merge. The orchestrator must run the final levels/deploy gate. No deployment or merge into `main` was performed.
