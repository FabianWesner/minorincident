# r12-vehicles — screen steering, complete APC cab, movable props

## Current state

Game changes are committed. Final pooled visual review and `scene:gate` are waiting for browser admission after the Mac restart. The goal remains open.

## Changes

1. **Screen-relative keyboard driving.** WASD/arrows request a heading derived from the camera. All driven vehicles turn through their existing wheel physics. Lateral requests remain forward turns; the rear 90° cone selects reverse, with normal brake-before-reverse behavior. The original 90° switch initially made Left back toward screen-right before the APC aligned with screen-up; the rear-cone boundary fixes that real-keyboard case. Logical local-axis bot/recording frames retain their contract. The driving hint explains the rule.
2. **Complete APC cab.** An opaque armor roof spans the cab width, with a full-width front pane and finished posts/sill. It meets the doors and front armor instead of leaving a floating narrow roof. Glazing retains the seated driver. Native L2 crew-cab presentation is preserved.
3. **Movable props and parked vehicles.** All 64 positive-mass, non-fixed environment/vehicle asset types enter the sleeping-prop system, including wrecks, parked cars, chairs, cones and heavy drum stacks. Concrete jersey walls, authored fixed/structural fixtures and mission-fixed placements stay solid. Hull contact applies an impulse based on closing speed and both masses, including reverse contact. Escaping props get no extra impulse. Distant props are culled before Rapier queries. The existing 12-body cap and deterministic order remain; navigation blockers follow displaced props, including reviewed oriented car footprints. L2's pavement-only furniture rule no longer relocates parked road cars. Vehicle-only props retain authored on-foot restrictions.

No GLB/generated metadata edits are retained; existing authored masses and collider geometry are used.

## Verification after restart

- Typecheck and lint pass. E09 verification also passed these stages (37.6 s / 135.4 s under host contention).
- `npm test -- --maxWorkers=4`: **107/107 pass**, 27 files, 31.3 s; inventory stays **150/150**. Later E09 and single-worker full-suite attempts exhausted the 240 s process budget under severe host contention. These are timeouts, not green reruns.
- Focused vehicle tests pass after final prop changes: screen direction, lateral turn before full alignment, reverse braking, APC/wreck/barrel contact, reverse parked-car shove, cones/chairs, no pre-contact or escaping-prop impulse, exact repeated prop snapshots and awake cap. Bicycle mount/exit and L8→L9 transfer pass. The oriented-navigation regression passed with the vehicle file (6/6); a later rerun timed out in its 30 s A* case.
- Real keyboard: **all eight definitions pass** arrows/WASD screen-vector checks while initially facing map north, actual left/right screen travel, and movement. Native L1 bike and L2 boarding/ride checks also complete. That run then hit a macOS Chromium Mach-port bootstrap failure when opening L9. [Keyboard evidence](checks.json).
- Completed targeted browser run: L9 APC low/high, zoom 1/1.5, real direction keys and native wreck/parked-car ramming. Displacements: **18.343 m** low (`veh.wreck`), **17.498 m** high (`veh.pickup-white`); one prop awake each. I opened the [review sheet](review.jpg).
- **Bike exception:** E19-AC16 remains vehicle-relative WASD. Native W+D increased heading from 0 to 0.215 rad. Its separate local heading integrator is retained; it does not adopt the cars' screen-heading rule.
- Native parked-car audit, seed 1: L1 **24/24**, L2 **41/41**, L9 **92/92** cars movable; none frozen by embedded-geometry detection.
- `qa:accept -- --level L9 --skip-browser`: four native policies complete; both tiers' five fixture clauses and two checkpoint clauses pass, including identical controls. **0 fresh failing rows; 8 incomplete rows.** [Native summary](native-checks.json).
- `qa:threat -- --levels L9`: skilled route completes in 128.13 simulated seconds; zero level/passive flags. Exit 1 is solely `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`. [Native summary](native-checks.json).
- `verify -- E09`: typecheck/lint pass; full-suite stage times out. Host load reached ~94 with 10.6 GB swap during verification.
- `scene:gate`: final post-restart rerun pending.

Unrelated shared `fix51-verify`/acceptance-status rewrites were restored after saving the compact native summary.

## Retained sheet

The sheet is the completed targeted APC/native-level run. `checks.json` capture labels describe the separate later all-vehicle run.

| Cells | View |
| --- | --- |
| f1–f2 | Finished APC cab, close views |
| f3–f4 | Native L1 bike and L2 fire-engine ride |
| f5–f7 | L9 low: zoom 1, zoom 1.5, wreck ram |
| f8–f10 | L9 high: zoom 1, zoom 1.5, parked-car ram |

## Browser recovery and cleanup

The review runner retains captures in memory and writes one compact sheet at phase boundaries. It uses a private Vite dev port without creating another build/worktree. `E2E_SERIAL=1` requests exclusive pooled admission without FPS quiet preconditions; its active batch budget starts after admission. One browser/context is used at a time.

Reviewed raw captures/receipts are removed. Only linked compact evidence and one sheet will be retained. No deploy/push.
