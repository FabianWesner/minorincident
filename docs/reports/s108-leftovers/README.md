# s108 leftovers — report only

Target game source: current-main snapshot `dac01c9174b643ace2e67924047a199ffc75f376` (batch 97+). Optimized production QA bundle; headless Chromium/ANGLE Metal WebGL2, 1280×720, one pooled browser at a time, ports 4981/4982, reservations ≤600 s. [Full evidence and attempt history](evidence.json).

| Requested item | Verdict | Evidence |
|---|---|---|
| L7 HIGH zoom-1 bus departure | **FAIL: static wreck in departure lane** | Opened timed captures at 0.7 s/3.4 s show seated passengers and following camera in the Scene Lab fixture. Actual-level inspection reveals legacy school-bus wreck at (-45,46.3), rendered LOD0 on the evacuation lane z47. Its baked hull intersects the swept evacuation bus path. Fixture omits this legacy dressing and cannot clear actual-level prop clipping. |
| L10 corridor/complex roads and crops, HIGH/LOW, zoom 1/1.5 | **PASS in observed sweep** | Route/entry/complex captures at every tier/zoom were gathered and selected originals opened. No floating crop patch or void established. Native full R6/R7 audit: 1368 route samples per tier, 410 corn blocks, minimum crop clearance 4.5191 m, finite ground at every sample. Short eight-tick entry bursts have stable road/paving first/last pairs at both tiers/zooms. Opened 32-cell route sheet plus original views show no missing/floating patch or void; consecutive entry pairs show no observed z-fighting. Scope is the sampled walked sweep on this renderer. |
| Shotgun and nail gun vs hunting Mega, HIGH/LOW | **PASS** | Real combat InputFrames produce `combat.hit` damage; nail 20 HP/hit, close full shotgun 240 HP, partial/range shotgun hits lower (18/24 HP initial examples). Both reach 1050/3000 HP floor. Recovery starts 61 ticks (1.017 s) after last positive hit; zero-damage floor hits do not reset it. Both have magazine0/bottomless campaign ammo, so finite per-magazine damage is N/A. Opened paired captures show shrinking overhead HP bar. Dedicated boss HUD panel is intentionally hidden before cure installation. |
| L10 key 0 with progressed save | **PASS: harmless dead shortcut in sampled arsenal** | Physical 0 leaves machine gun selected. Opened visible hotbar has 16 entries, no crowbar icon or 0 badge. Global shortcut10 maps to absent crowbar; other extended weapons show Q-cycle badges. No mapping patch proposed. |

## L7 reproducer

Load L7 seed2 HIGH and board normally. Around 3.2 s into departure the evacuation bus crosses x−45,z47, where `l5-bus-68` is centred at (−45,46.3). Actual-level opened capture `test-results/s108-leftovers/l7-schoolbus-probe.jpg` confirms the full-sized wreck occupies the lane. Static inspection teleported only the courier to observe the location; no bus/mission state was changed. The native conservative AABB candidate audit also identifies the alley APC and a 1.95 cm belongings-edge overlap; those remain candidates, not additional confirmed mesh findings.

## Road review and limitations

Opened captures show authored dark open ground beside corn margins, gray road slabs, tiled complex paving, dark paving insets and puddles. Empty-looking ground is supported ground, consistent with the native audit. Crop exclusion is deliberate: authored road and crossing clearance removes corn tiles that reach the walking lane. No field-density design change is inferred from sparse open ground.

Early LOW captures were washed out because the harness advanced simulation while freezing the VFX render clock. Weather and fog diagnostics did not fix that artifact. Synchronizing `vfx.stepRender(1/60)` with each sim tick removes the gray wash and frozen projectile strings without changing production weather/look. Those corrected captures supersede the washout views for ground inspection. Short temporal entry bursts support local stability. Together with the opened route sheet and original route captures, no gaps, floating crop patches or z-fighting were observed along the sampled walk. This is a bounded browser verification, not an exhaustive all-frames or all-hardware guarantee.

## Method and validation

Fresh native complete-policy HIGH then LOW routes generated progressed corridor/complex/finale resumes retaining actors, corpses, mission, weapons and Mega state. Diagnostic movement/aim/fire use ordinary InputFrames; courier god mode is disclosed. No enemy stats, health, positions or mission flags were edited for weapon tests. Driver waypoint18 prevents restarting completed exploration during forward road sweeps. Matched entry runs resume a genuine checkpoint snapshot. UI was initialized for hotbar observation. No game/spec/assets were edited, and no deploy, push or main movement occurred.

Production QA build, typecheck, lint, JSON parse and diff checks PASS. Unchanged prescribed remote `npm test` PASS on 46.225.66.90: 27 files, 106 passed /1 skipped, 222.7 s within240 s, 150/150 budget collection. No check remains running. Initial sandbox/pool/runner failures are historical and retained in JSON.

**Verification complete:** L7 FAIL; L10 road/crop observed sweep PASS; shotgun/nail gun PASS; key 0 harmless. The report-only goal is complete; the L7 gameplay defect is deliberately left unfixed.

## Reproduction artifacts

`evidence.json` embeds 14 temporary harness sources with SHA-256 hashes, plus a manifest of 1098 local PNG/JPEG captures. Restore harnesses under `/private/tmp` and replace the recorded worktree prefix if needed. Browser commands use `SCENE_SERVER=preview SCENE_PORT=4982 E2E_PORT=4981 E2E_UNITS=1 E2E_RESERVATION_SECONDS=600 sh tools/e2e-lock.sh node --import tsx /private/tmp/<harness>.mts`. Build first with `MI_BUILD_CACHE=off npm run build:qa`. `s108-fixtures.mts` generates genuine native resumes; `s108-clock.mts` advances presentation time alongside simulation. `S108_TIER=low` selects LOW. The retained history includes rejected/inconclusive attempts; use the corrected-clock evidence for LOW ground review. Captures remain local and their hashes establish which files were reviewed; they are not additional committed report artifacts.

## Final opened route sheet

[contact-sheet.jpg](contact-sheet.jpg) is the sole committed image (32 cells, approximately344 KiB). It was opened at original resolution and spans entry paving, corridor roadside/open ground, corn margins, breach and complex apron at HIGH/LOW and zoom1/1.5. No floating patch or void is visible. The apparently blank corridor is authored supported open ground; dark complex insets and puddles are intentional surface changes. Source filenames, hashes and review scope are in `finalRoadReview`. WebGPU and exhaustive all-frame coverage are not claimed.
