# E03 mouse controls and unified unarmed style

Implemented the product owner's October 6 updates: explicit ground click/hold movement;
LMB targets/approaches infected with the active action; Shift+LMB always swings in place,
locks locomotion through the swing, and cancels pending destinations; RMB cycles unique
carried actions. Saved pre-update mouse bindings migrate RMB to cycling. Wheel zoom,
keyboard side controls and mobile LEFT/RIGHT/ACTION remain available.

Unarmed retains the `weapon.fists` identifier for saves/fixtures and chains seven distinct
moves at equal damage, with slight kick knockback and a spinning backfist once per seven
attacks. The authoring script, Blender export and compiled runtime library are committed
together. Living adults hit by an in-place melee swing stagger backward, emit “Hey!”, and
pause briefly in an annoyed state. This path never invokes damage, kill or infection logic;
children/pets are excluded. Optional item drops are not implemented.

E03-AC02/05/08/15/16/17 replace obsolete RMB/right-action and selector wording to match
specs/00 §5.3's newer PO decisions, preserving IDs. AC19–21 add civilian safety, unarmed
animation/variety, and active/next HUD checks. L1's “LEFT weapon, RIGHT kick” text is gone.

Integration fixes for main's gait: planted-foot baking now uses the same chibi leg-length
stride ratio as runtime; the crossfade test accounts for that ratio. Retargeting preserves
initial rest transforms when a new clip is compiled after a previous clip was sampled.
No locomotion acceptance tolerances are weakened.

Validation in progress. Final counts and game-camera review will be recorded after the
shared headless-test lock is available. All browser runs use E2E_PORT=3348, ANGLE Metal,
headless Chromium and at most two workers. No WebGPU claim is made.
