# s108 leftovers — report only

Target game source: current-main snapshot `dac01c9174b643ace2e67924047a199ffc75f376` (batch 97+). Optimized production QA bundle; headless Chromium/ANGLE Metal WebGL2, 1280×720, one pooled browser at a time, ports 4981/4982, reservations ≤600 s. [Full evidence and attempt history](evidence.json).

| Requested item | Verdict | Evidence |
|---|---|---|
| L7 HIGH zoom-1 bus departure | **FAIL: static wreck in departure lane** | Opened timed captures at 0.7 s/3.4 s show seated passengers and following camera in the Scene Lab fixture. Actual-level inspection reveals legacy school-bus wreck at (-45,46.3), rendered LOD0 on the evacuation lane z47. Its baked hull intersects the swept evacuation bus path. Fixture omits this legacy dressing and cannot clear actual-level prop clipping. |
| L10 corridor/complex roads and crops, HIGH/LOW, zoom 1/1.5 | **INCOMPLETE visual acceptance** | Route/entry/complex captures at every tier/zoom were gathered and selected originals opened. No floating crop patch or void established. Native full R6/R7 audit: 1368 route samples per tier, 410 corn blocks, minimum crop clearance 4.5191 m, finite ground at every sample. Short eight-tick entry bursts have stable road/paving first/last pairs at both tiers/zooms. Continuous full-route temporal z-fighting review remains unproven. |
| Shotgun and nail gun vs hunting Mega, HIGH/LOW | **PASS** | Real combat InputFrames produce `combat.hit` damage; nail 20 HP/hit, close full shotgun 240 HP, partial/range shotgun hits lower (18/24 HP initial examples). Both reach 1050/3000 HP floor. Recovery starts 61 ticks (1.017 s) after last positive hit; zero-damage floor hits do not reset it. Both have magazine0/bottomless campaign ammo, so finite per-magazine damage is N/A. Opened paired captures show shrinking overhead HP bar. Dedicated boss HUD panel is intentionally hidden before cure installation. |
| L10 key 0 with progressed save | **PASS: harmless dead shortcut in sampled arsenal** | Physical 0 leaves machine gun selected. Opened visible hotbar has 16 entries, no crowbar icon or 0 badge. Global shortcut10 maps to absent crowbar; other extended weapons show Q-cycle badges. No mapping patch proposed. |

## L7 reproducer

Load L7 seed2 HIGH and board normally. Around 3.2 s into departure the evacuation bus crosses x−45,z47, where `l5-bus-68` is centred at (−45,46.3). Actual-level opened capture `test-results/s108-leftovers/l7-schoolbus-probe.jpg` confirms the full-sized wreck occupies the lane. Static inspection teleported only the courier to observe the location; no bus/mission state was changed. The native conservative AABB candidate audit also identifies the alley APC and a 1.95 cm belongings-edge overlap; those remain candidates, not additional confirmed mesh findings.

## Road review and limitations

Opened captures show authored dark open ground beside corn margins, gray road slabs, tiled complex paving, dark paving insets and puddles. Empty-looking ground is supported ground, consistent with the native audit. Crop exclusion is deliberate: authored road and crossing clearance removes corn tiles that reach the walking lane. No field-density design change is inferred from sparse open ground.

Early LOW captures were washed out because the harness advanced simulation while freezing the VFX render clock. Weather and fog diagnostics did not fix that artifact. Synchronizing `vfx.stepRender(1/60)` with each sim tick removes the gray wash and frozen projectile strings without changing production weather/look. Those corrected captures supersede the washout views for ground inspection. Short temporal entry bursts support local stability; they do not prove every route surface across all intervening frames. Road acceptance therefore remains open.

## Method and validation

Fresh native complete-policy HIGH then LOW routes generated progressed corridor/complex/finale resumes retaining actors, corpses, mission, weapons and Mega state. Diagnostic movement/aim/fire use ordinary InputFrames; courier god mode is disclosed. No enemy stats, health, positions or mission flags were edited for weapon tests. Driver waypoint18 prevents restarting completed exploration during forward road sweeps. Matched entry runs resume a genuine checkpoint snapshot. UI was initialized for hotbar observation. No game/spec/assets were edited, and no deploy, push or main movement occurred.

Production QA build, typecheck, lint, JSON parse and diff checks PASS. Unchanged prescribed remote `npm test` PASS on 46.225.66.90: 27 files, 106 passed /1 skipped, 222.7 s within240 s, 150/150 budget collection. No check remains running. Initial sandbox/pool/runner failures are historical and retained in JSON.

**Open:** complete continuous temporal road-surface review over the whole corridor/complex at both tiers and zooms. This report does not claim the full goal is finished.
