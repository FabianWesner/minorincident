Implemented L10-S8: explicit release starts a 10 m/s authored cure front, persists release/front/affected IDs in mission/chunk saves, and records campaign clearance once.
All infected species, Alphas, downed enemies and residual Mega die permanently; healthy people/animals, player and corgi are excluded. Pending grabs cancel, approaches continue without attacks, and corpses have no despawn timeout/removal cap.
Reused smoke/audio/rotor pools, fixed converted animal hip death binding and fresh-clock death age; [S9 integration](integration.md).
Typecheck, lint, build and 31 focused tests pass; E32 selected sim/unit/smoke passes 138. Full unit: 1443 pass plus one asset timeout that passed unchanged in isolation.
QA: 12 Scene Lab matrix cases pass on both backends/high/low/zoom 1.5, 1.0, 0.5; [reviewed captures](vision.md). Four native Metal runs retain 200/100 bodies within measured E18 caps: [performance](native-performance.json).
Wider gates remain non-green: HEAD-reproduced L3/timing failures and Node 26 JSON-import browser collection blocker; [validation](validation.json). Release hitch, full R7/pull-out and real-device FPS remain unmeasured.
