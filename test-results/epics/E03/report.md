# E03 mouse controls and unified unarmed style

Integration with main `bc7e801` preserves its infection stagger/collapse/rise
clips, independently rising infected lifecycle, survivor assets, look controls
and rig-local stride/world-scale handling. Civilian rendering selects the
harmless annoyed stagger alongside the infection states; both state-machine
updates survive. The latest main mobile policy (far LOD beyond 16 m and
LOD2 for props) supersedes the earlier 18 m correction below. The GLB and
runtime tracks are regenerated from the merged Blender script. Merge-specific
validation is recorded in `merge-checks.json`: typecheck, lint, 181 unit tests
and build pass; browser smoke and the focused unarmed test are queued.

Implemented the product owner's October 6 updates: explicit ground click/hold movement;
LMB targets/approaches infected with the active action; Shift+LMB always swings in place,
locks locomotion through the swing, and cancels pending destinations; RMB cycles unique
carried actions. Saved pre-update mouse bindings migrate RMB to cycling. Wheel zoom,
mouse-mode 1/2/3 select the same unarmed-first carried list, while keyboard-only
side controls and mobile LEFT/RIGHT/ACTION remain available. L1 retains unarmed
in the other rack after weapon pickup, respecting its one-slot rack capacity.

Unarmed retains the `weapon.fists` identifier for saves/fixtures and chains seven distinct
moves at equal damage, with slight kick knockback and a spinning backfist once per seven
attacks. The authoring script, Blender export and compiled runtime library are committed
together. Living adults hit by an in-place melee swing stagger backward, emit “Hey!”, and
pause briefly in an annoyed state. This path never invokes damage, kill or infection logic;
children/pets are excluded. In-place melee also returns before the finishing
path for a civilian already in the glowing-eye state. Optional item drops are
not implemented.

E03-AC02/05/08/15/16/17 replace obsolete RMB/right-action and selector wording to match
specs/00 §5.3's newer PO decisions, preserving IDs. AC19–21 add civilian safety, unarmed
animation/variety, and active/next HUD checks. L1's “LEFT weapon, RIGHT kick” text is gone. E19-AC04's obsolete separate
fists/kick criterion is corrected to the newer PO unified-unarmed decision;
its empty morning loadout and weapon-pickup requirements are retained.

Integration fixes for main's gait: planted-foot baking now uses the same chibi leg-length
stride ratio as runtime; the crossfade test accounts for that ratio. Retargeting preserves
initial rest transforms when a new clip is compiled after a previous clip was sampled.
No locomotion acceptance tolerances are weakened.

Two inherited E19 click-navigation failures reproduced with main's original
ControlIntent. Routed input now uses the existing NavGrid.move corner slide,
reconnects via the safe starting cell when required, and keeps acceleration along
the routed step. All eight world collision/navigation assertions pass unchanged;
AI navigation was not modified. Foundation scenarios guard the absent Player
before touching velocity. The real-input world fixture approaches above the
hedge before testing its side; the previous waypoint was inside nav clearance.
Desktop/touch world traversal, audio focus handling and a real desktop L1
start-to-end run pass (four focused browser checks). Experiments that did not solve both routes were
removed. The verifier follows the orchestrator's browser-only lock policy: plain
build/typecheck/lint/unit commands run directly.

Integrated m1-nav-fix's atomic hedge-bench relocation and low-quality distant
LOD adjustment, plus its E19 wall-clock timeout increase for shared-machine
fixed-tick seed checks. The seed counts, collision assertions, arrival
tolerances and mobile triangle budget remain unchanged. The peer's 24 m cutoff
missed visible costly house/car batches at 18–20 m. Low quality now uses their
authored LOD2 beyond 18 m, with high quality unchanged at 30 m. All seven
iPhone camera spots pass; the connection view falls from 512,458 to 408,015
triangles. Its game-camera capture was reviewed for preserved silhouettes.

Final resumed validation (m1-controls3-2): typecheck and lint pass; the full
unit suite passes 158 tests in 56 files. Smoke passes 3 selected simulation
checks and all 22 browser checks. The one requested focused browser test passes:
all seven unarmed moves play through real Shift+LMB with no planar movement,
no missing clips, and the expected combo order. Commands and exit codes are
recorded in `resumed-checks.json`; logs and browser results are retained.

Earlier complete E03 verification passed 20 selected unit checks and all 132
browser checks. Its retained browser results, later passing selected simulation
results and `acceptance.json` cover all 21 criteria; this is historical coverage,
not a claim that the final full E03 verifier was rerun. Focused combat safety
checks passed 4 tests, including the glowing-eye civilian case.

E19 selected simulation checks passed 34 tests, including both 20-seed groups.
Desktop, portrait and landscape real-input L1 routes completed with zero deaths;
world traversal and mobile GPU budgets passed. Full E19 verification was
interrupted after the known weapon-animation fixture failures (no recorded hit
within eight attempts). The orchestrator explicitly assigned those baseline
failures elsewhere and requested only the resumed checks above, so no final
full E19 pass is claimed. No assertions or budgets were relaxed.

All browser runs used E2E_PORT=3348, ANGLE Metal, headless browsers and at most
two workers per run; the focused run used one. WebGPU was not checked.

Game-camera evidence: `review.md`, `unarmed-review.png` (all 35 authored-action
frames) and `civilian-gag.png`. Full original frame sequences are reproducibly
written to `unarmed/` by the real Shift+LMB Playwright test.
