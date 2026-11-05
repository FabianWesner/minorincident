PKG-07/08: implemented shared two-arm long-gun grip, recoil, bladed stance and fitted carry presets for player/crowd.
Reviewed 42 paired game-camera/Scene Lab cases: dangling barrels/free left palms become supported holds with floor/body clearance; details in README.md and captures.json.
Idle/walk/run/turn/aim/fire, courier reloads and gun/bat/gun switching checked; both variants, civilian/police/soldier props; after matrix 42/42 passes.
Typecheck/lint/build pass; unit 155 files/793 tests pass (2 workers); T-E04-09/T-E06-08 and three zero-death L3 browser routes pass.
Rerun gates remain red: baseline T-E21-04 expects 40 HP but receives 60; known save/rack and baseline unload/golden failures; presentation pacing also fails (validation.md).
Committed rendering fix; only reported before/after images retained; existing tests/tolerances/goldens/cameras unchanged, no content removed or deployment/merge; FIX-28/29 remain outside scope.
