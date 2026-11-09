# Browser QA — qa-browser2

**In progress; release acceptance is FAIL.** Browser admission recovered. Source `8622b6d1` plus save fixes `bfd998ff`, then destruction fix `016ea78f`, has now been rendered headlessly through the shared browser pool. No deploy or push. This report distinguishes observed defects, successful observations and checks blocked or not yet exercised; an unobserved scene receives no visual pass.

## Method and evidence

One pooled GPU browser at a time, private Vite port 4351, reservations capped at 600 seconds, Metal WebGL2 and actual WebGPU (backend checked). Route fixtures use production bots and mortal campaign simulation, with paired zoom 1/1.5 photographs. Paused stepping accelerates simulation and advances presentation; those runs establish neither audio quality nor live frame budgets. `ending.ts` separately runs the L10 ending at natural time. Posed fixtures explicitly identify teleport/protection/setup and are not campaign completion evidence. Receipts retain ticks, positions, cameras, renderer, quality and screenshot hashes. Review sheets will retain selected evidence after raw image deletion.

## Small fixes made

- **L10 retained-find checkpoint save:** picking up the rifle changed the live rack but left the campaign ownership stale. Subsequent `cure-residential` checkpoint failed save validation at tick 3008, `(740.066,22.476)`, low WebGL2. Synchronize the retained find and rack with the campaign. Before receipt: `L10-pickup-save-before.json.gz`.
- **L10 mounted-gun checkpoint save:** mounted shots recorded `weapon.rotary-minigun` usage, rejected by the carried-only save validator. Repro tick 54082, `(3989.228,-32.888)`, y 3.78, low WebGL2. Accept known mounted action IDs in usage without granting carried ownership. Before receipt: `L10-minigun-save-before.json.gz`.
- Both have regression assertions in existing unit cases. `npm run verify -- E32` passes typecheck, lint and 107 tests (27 files), with four workers and unchanged 150/150 case budget; [receipt](E32-checks.json). Commit `bfd998ff`.

### Destruction chunk-lifetime fix

The normalized L9/L10 appearance fixtures exposed the same Rapier `RuntimeError: unreachable` on all eight quality/backend attempts when a burning car exploded after its chunk body had been freed. `Destruction` retained a stale prop body for its delayed torque, explosion impulse and collider reconciliation. **Fixed in `016ea78f`:** resolve a current live body before those operations, preserving the cached plain pose while unloaded and rebinding after reload. The existing world-systems case now unloads a burning/blasted car, lets its queued kick and explosion finish, reloads it and checks pose ownership. The assertion fails before the fix and all five focused cases pass afterward. The full E31 gate passes typecheck, lint and all 107 unit tests; [receipt](E31-checks.json). All eight corrected L9/L10 rollout appearance runs now finish without runtime errors. Four whole L10 routes rerun after the fix also finish; all observed tick/position/phase/find/charge/ending fields match the earlier save-fixed runs ([comparison](poststreamfix-parity.json)). This is sampled state parity, not a whole-world or performance comparison.

The first L9 inspection also revealed a harness limitation: teleporting the courier while the APC remained occupied let driving return her to the distant car. The follow-up moves the occupied native car/courier together as an explicitly labelled initial-pose fixture. Those first photographs are not accepted as target appearance review. Archived `*-rollout-*-before.json.gz` retain the errors; no ordinary-route crash is claimed from the posed fixture alone. The unit regression separately proves the production lifetime defect.

## Current findings

| Level | Observed result | Glitches | Is it stunning? |
| --- | --- | --- | --- |
| L3 | Actual weapon hits break glass, collapse a house and ignite/explode a car in all four quality/backend cells, both zooms. Other sampled buildings remain intact. Further PO corridor/evacuation checks pending. | Smoke/debris obscure the initial wreck inspection; later settled-state inspection pending. | Not established from this limited street fixture. Warm lighting and house silhouettes are coherent. |
| L4 | Four opening matrices reach Fall back; truck arrival/wreck geometry reviewed. [Verdicts and sheet](L4.md). | Canvas looks metallic; late crowd/corpse overlap. Far LOD appearance and tank/wall controls remain unverified. | **No**: late silhouettes merge into a heap. |
| L5 | All4routes collect/transfer five; shutter replay reviewed. [Review](L5.md). | Group silhouettes overlap at the narrow shutter/post/caption composition. | **No overall:** finale needs clearer spacing/framing. |
| L6 | All4routes reach result:27/29out after one retry. Counts and street framing pass. [Review](L6.md). | Long exit-stair bot wait followed by death/retry; ground runners remain below. | **No overall:** ordered procession and bright exit tread pattern dominate. |
| L7 | Pending | Pending | Pending |
| L8 | **FAIL to load**, low/high with both requested renderers. Story/arena/departure visuals blocked before Begin. | Low: missing required skinned monkey tier; high: skin semantic owner is not a weighted joint. | Cannot assess: neighborhood does not load. |
| L9 | Low WebGL2 production route completes. Four named evacuees, Sam and safe corgi transfer to L10 with exactly the axe as the carried weapon. High bot reaches repeated deaths near late evacuation gate; no impossible-route conclusion. | Bridge impact/crawl camera is occluded by huge orange/concrete structure. | **No** in the reviewed low route: bridge impact is unreadable. |
| L10 | Whole route through ending/menu completes in low/high WebGL2 and WebGPU after fixes. Actual L9-carried save also completes in low WebGPU. | Hangar roof hides cast/terminal at zoom 1.5; journey shots use isolated flat green stages; final panorama is blank fog. Long sparse farm/corridor stretches. | **No**: farm needs denser coherent storytelling; hangar and ending framing need repair. |

### L8 loading blocker

Low WebGL2 and requested WebGPU: `amb.monkey is required for the skinned crowd`. Integrated monkey GLBs exist at the normal paths, but their low texture tier paths do not exist. The asset registry selects `.low.glb` for these low-quality skinned assets; placeholders cannot satisfy the mandatory skinned crowd. High WebGL2 and requested WebGPU fail `Crowd semantic owner must be a weighted joint` in `packSkin → bakeInfectedSteps → CrowdView.loadBatch`. The initial stack did not identify the model; a temporary error-context wrapper now localizes it to `healthy.monkey`, asset `amb.monkey`, LOD2 ([diagnostic](L8-diagnostic.json)). The wrapper rethrows the unchanged error and makes no production source/asset change. [Reviewed loading-error contact sheet](L8-contact.jpg), with [cell metadata](L8-contact.json). All four attempts stop before Begin (tick 0); fallback photograph metadata records requested backend/zoom, not a gameplay backend assertion. Both are before gameplay; do not infer that any of the six arenas, Nadia tour, breach, K9, boarding, gate or departure was visually accepted. Every `eg-l8-story` and `eg-l8-bosses` browser item is **BLOCKED / QA acceptance FAIL** behind this startup defect, including audio, retries, markers, pillars, throws, survivors and departure. No stunning verdict is possible. Raw error captures were deleted after sheet review.

### L9 scope

Low route: seed 42 preset, final tick 14531, 242.18 simulation seconds, zero courier deaths, no runtime console errors. Both zooms show APC hull/wheels remaining together through the fall. The bot detours around the authored ramp jumps and tanker, so those set pieces remain untested. Impact/crawl framing fails around ticks 13872–13992; geometry fills the frame until camera recovery near tick 14052. High route stops after 11 deaths around `(450,8–11)` near evacuation; this is a failing completion policy, not proof of an unfinishable game. The actual low handover save is retained and used for a subsequent L10 route.

### L10 scope

Four matrix routes complete through credits/thanks/menu with no runtime errors; low/high final ticks are approximately 66781/67100. Six retained finds are collected. The raised gun is reached by actual stairs and the charge completes. This does not substitute for targeted cross-floor attack controls.

**Hangar FAIL:** low tick 31632 / high 31884 near `(2699.5,65.5)`, zoom 1.5, both renderers: a tiny circular hole shows the courier while the roof hides most of Voss/cast, console and canister. Zoom 1 is substantially more readable.

**Ending FAIL:** isolated flat green journey stages float against empty surroundings. Final pullback shows blank blue fog rather than the map in all four route cells. The separate natural-time low WebGL2 replay confirms the blank panorama at local ticks 3493/3801, cure elapsed 3300/3608 (~55–60 s), so the failure is not an accelerated-clock artifact. Original WebGL2 route photos used an over-broad HUD visibility override and cannot certify cinematic HUD hiding; clean WebGPU routes and natural-time replay preserve native HUD rules.

Actual-carried route preserves `dale`, `mia`, `rosa`, `okafor`, Sam and corgi in campaign data. Visual ending continuity still needs inspection; generic epilogue survivor IDs are not a reliable proxy for the named crew.

## Remaining checklist

All 17 merged handoffs named in the brief and `docs/qa/po-checklist.md` remain the scope. Outstanding checks include targeted remaining controls, L4 truck/camera and L5–L7 followers, L9 high completion and skipped set pieces, destruction rollout L9/L10, platform controls, audio audition, aspect ratio/skip/toy branches, cold load and real-input/performance budgets. No native-only receipt or old report is being recertified as current visual evidence. Production A/B from the PO checklist has not yet been performed.


### Shared rendering fixtures (all four quality/backend cells)

`fixtures-{low,high}-{webgl2,webgpu}.json`: 162 paired photographs per cell, no console errors. Supported empty L3 layout limits crowd prewarming to non-zoo models; generic Scene Lab without that restriction also fails on required zoo skins. These are controlled fixtures, not L3 or L10 completion claims.

- **PASS, sampled flame appearance:** f45/f75 shows a continuous orange jet from the carried weapon into the target, local warm spill and fire patch; f120 shows the stream released with patch remaining. Model silhouette and hose/cylinder details are too small in whole-frame sheets for all-LOD certification. Fuel exhaustion, moving nozzle and hitch budget remain open.
- **PASS, sampled Alpha visual vocabulary:** five looks differ; brute circular filled slam zone, throw landing ring, Screamer broad red disc, Leaper arrow lane and Armoured forward arc are readable at both zooms. Forced specials isolate presentation; normal interruption, counters, blocked sight, airborne/rolling missile kill and front/flank feedback are not approved from these images.
- **PASS, sampled G-24 bar eligibility:** undamaged Alpha at 16 m has no bar, at 10 m has a bar, damaged at 16 m has a bar, zero-HP has none, and healthy riot at 16 m retains its bar. Zero HP is an explicit eligibility fixture, not a certified corpse pose. Occluded and healthy-zoo controls remain open.
- **PASS, sampled height behavior:** platform courier y3.76–3.80, runner/dog/Alpha y0.7; HP stays 100 through f240. At f600 Alpha y3.78 reaches the deck by stairs and courier HP is 70. Flat control loses 11 HP by f60 and 22 by f120. This does not certify animal/grab variants or every L4/L6/vehicle-roof surface.
- **PASS, sampled Mega lope silhouette:** six-frame toward/away/across WebGL2 strips show low shoulders and long alternating strides without the earlier high elbow cycle; selected corresponding WebGPU frames retain it. No new sole-speed measurement or scripted 11/14 m/s L8 approval is claimed.
- **FAIL, APC cab appearance:** physical E entry succeeds at tick61, `(0,0)`. Game-camera zoom1/1.5 and front close inspection at azimuth80/110 show a largely open cab and an upright-looking courier with straight visible lower legs. The renderer reports `seated:true`; that flag does not make the pose read seated through closed glazing. Same appearance on all four cells. Body and six wheels remain visible; all LOD boundary transitions still need explicit review. Close views use their recorded fixed inspection camera rather than independent game-zoom projections.
- **PARTIAL, moving headlights:** selected moving headlight and one refreshed map at ticks21/51/120; visible white pools stay attached to the advancing APC. The f600 fixture has become wrecked and its lights turn off. That is an off-state observation, not a sustained undamaged-light or stronger-practical transition pass. Actual actor-shadow direction remains to be isolated.


### L9 manual hatch follow-up

From the unedited high-route checkpoint, physical mouse aim/LMB and Digit5 produce 18 army-MG discharges (4 kills) and, after weapon selection changes, 10 rocket discharges (10 kills). There are 43 rejected close-range rocket attempts; the courier dies at local tick1752 after 29.2 s. The sampled pictures show the stopped hatch, live targets and real driver damage. **PASS: actual hatch firing can hit/kill and the exposed driver takes damage. FAIL to complete this defense policy:** neither this attempt nor the earlier production bot clears the high route. Key5 is the army MG, not the rocket launcher; the bot's zero-kill run and this mouse run are different policies, so this is not a controlled single-variable weapon comparison.

### L10 closing composition

At carried-route tick59952, `(4004.2,-28.6)`, the readable “Delivered ✓” caption appears, but recovered people overlap tightly around the courier/console. The thanks close shot at tick66552 preserves the same clump. **FAIL:** closing cast spacing and seated-courier readability. The four saved named survivors are visible together in the earlier truck tableau; campaign data confirms their identities. Phone buzz/hymn remain unauditioned.


## Merged-lane verdict ledger

These are browser acceptance results, not a claim that every native requirement was rerun. “Open” is unverified coverage and never a visual PASS.

| Handoff | Browser verdict / evidence | Remaining requirement or failure |
| --- | --- | --- |
| `eg-l8-story` | **FAIL / BLOCKED**, four loading-error images | Nadia tour/animals, breach/K9/turn, Hale/Mega/keys, gate/group departure, captions, ambience, skip/retry and actual L8→L9 handover cannot be reached. |
| `eg-l8-bosses` | **FAIL / BLOCKED**, same startup failure | All six arenas, monkey leader/roof, throws/roll, pillars, elephant walls/truck/evacuees and full APC escape cannot be reached. Shared non-zoo Alpha/Mega/flame samples are separate fixtures. |
| `eg-l9` | **FAIL overall**, low road route completes and crash/APC images reviewed | Impact/crawl camera occludes action; high completion policy fails. Ramps/tanker/fire fixtures and current-source GPU routes in progress. Audio/live timing/touch coverage open. |
| `r15-l10pace` | **FAIL overall**, four full-route matrices and exact PO farm spot reviewed | Sparse farm/corridor views; roof, closing cast and panorama fail. Roof text/graves/find marker follow-up in progress; audio and optional toy branch open. |
| `eg-l10-story` | **FAIL overall**, route/hangar/arsenal/ending inspected | Hangar cutaway, isolated journey staging, closing spacing/framing and blank panorama. Recovery appearance is partially sampled; audio, aspect ratio/skip/toy and counter interactions remain open. |
| `eg-l10-vignettes` | **FAIL overall**, seven region samples + jam/helicopter/refuge, four render cells, no sampled console errors | Sparse real-route stretches remain. All-route fresh real input, complete atlas text/ground-contact review and load/frame gates are open. |
| `r15-farmassets` | **PARTIAL**, barn/house/machinery/corn silhouettes rendered, both tiers/backends sampled | Dry corn reads as stalks, high denser than low; actual farm night scene remains empty/low contrast. Damage appearance follow-up in progress. |
| `r15-megarun` | **PASS, sampled visual smoke**: six-frame toward/away/across WebGL2 strips, selected native WebGPU counterparts | Low carriage/long stride reads heavy. No new foot-speed metric, old-source A/B or L8 scripted sprint approval. |
| `r15-flamer` | **PASS, sampled firing appearance**, four render cells | Visible carried jet, impact patch and warm spill. All-LOD model-detail/icon inspection and fuel exhaustion not yet certified. |
| `r15-flamevfx` | **PARTIAL**, continuous jet at f45/75 and patch after release | Moving/turning nozzle follow-up in progress; quantitative flicker/spill, fuel and live hitch budget open. |
| `r16-destroll` | **FAIL found and fixed**: freed-body impulse regression `016ea78f`; E31 green | Repeat appearance matrices L3/L9/L10 in progress. First-hit allocation and all rollout district/weapon-family appearance combinations open. |
| `r13-destruction` | **PARTIAL**, L3 glass/collapse/burn/wreck pictures reviewed in four cells | Door-hole/settled state repeat, checkpoint appearance and first-hit/performance checks open. |
| `r14-alphas` | **PARTIAL**, five looks and all six forced move shapes rendered at night in four cells | Living missile/corpse landing samples observed, but walk-up pickup, kill in air/roll, sight/interruption, counters and front/flank feedback not certified. L8-specific throws blocked. |
| `r12-group` | **OPEN**, L5/L6/L7 route matrix queued; L8 blocked | Native comparison is not recertified as visual follower quality. |
| `r14-height` | **PASS, sampled L10 platform/flat control**, four cells | L4/L6/vehicle-roof and all grab/animal variants still open; zoo assets block animal controls. |
| `r15-qafix` | **FAIL overall**, APC physical entry and cab images across four cells | Open cab/upright-looking seat pose; G-24 five sampled states pass, occlusion/control follow-up in progress. Headlight long-drive/power controls in progress. |
| `r12-l4truck` | **PARTIAL**, four opening matrices through Fall back at zoom0.5/1/1.5 | No sampled highlight pan; radio/HUD remain. Geometry sampled PASS, canvas material FAIL; distance LOD appearance remains unverified. [L4 review](L4.md). |


### Source/criterion scope

The merged handoffs and this brief's newer PO story direction are the browser checklist: green dust/recovery, six optional discoveries, current Mega behavior and the staged ending. Older E31/E32 prose still describes superseded mass-only/no-repair rules, lethal-only cure and earlier timing/minimap defaults; those were not silently substituted for the newer handoff requirements. No specifications were edited.

### Asset warning

The repeated L10 route emits `[assets] haz.propane-tank fell back to a PLACEHOLDER BOX (status reference). Never ship this.` The manifest still marks that hazard as `reference`. Sampled district placeholder-draw probes return empty; those probes do not cover InteractionView hazards. **Open asset defect:** the warning is confirmed, but no particular visible tank is identified from that log alone. The inspected vignette/farm geometry is not labelled placeholder merely because this unrelated hazard preload warns.

### Focused follow-up observations

- **L10 find markers PASS, sampled:** each of the six optional pickup entities is present and has a conspicuous gold world ring at zoom1/1.5 in low/high and both renderers. The first environment photos advanced only one tick and cannot establish marker absence; delayed follow-ups advance 60 ticks outside the auto-collect radius. The route separately collects all six.
- **Barn text PASS at high, grave composition not accepted:** tick120, `(940,-18)`, zoom1.5, high WebGL2/WebGPU shows `HELP — 3 INSIDE` on the roof. Three graves are not readable in that composition. Low reframe remains separate coverage. Source grave anchors lie inside the rebuilt barn footprint, so this warrants layout review rather than treating the asset's intact roof as proof of successful storytelling.
- **L9 ramp/tanker/fire PASS, sampled high WebGL2:** native fast overpass/ditch launch reaches y3.70/y3.47 and records each authored jump; slow attempts reach the ramp, then fail back without a completed jump. Tanker proximity sets fuse deadline tick146 and explosion is photographed at tick156. Rural countdown reads 1s at tick900, then six fire entities and a visible wall at tick960. Initial low-course attempts used mouse-only input, which ignored drive throttle; they are invalid operator cases and receive no ramp/fuse verdict until repeated with keyboard input.
- **Flame movement PASS, sampled:** extras low/high WebGL2 and low WebGPU show the jet moving and turning with the nozzle at f35–100, a warm ground pool and persistent patches. Recorded jet origin equals the visible attachment muzzle. Fuel exhaustion and hitch measurement remain unverified.
- **Headlights PASS, sampled:** intact floor-supported APC at f21/51/120/600 retains the selected moving headlight and one refreshed shadow map. High WebGL2 and low WebGPU pictures show the pool advancing with the car. A separate stronger-right practical moves the shadow away to the left; turning its power groups off removes the selected practical. This is not an isolated moving-target shadow-direction or APC-to-lamp handoff test.
- **G-24 occlusion PASS, sampled:** healthy far Alpha placed inside a house has no visible bar in low/high WebGL2 and low WebGPU. Healthy-zoo control is blocked by the loading defects. Night corpses have no HP bars; dog/runner bodies lie flat, but the Mega corpse is a very dark lump at zoom1.5 without a practical (**FAIL Q-124 readability**).
- **L3 settled destruction PASS, sampled:** real handgun glass hit, normalized door contact, real rocket collapse and Molotov car burn are photographed across the matrix. At tick2035 the collapsed roof/debris has cleared and the interior remains open, neighboring houses intact. High WebGL2 and low WebGPU car follow-up genuinely advances to tick4286 (30s after wreck); initial low WebGL2 `car-wreck-settled` remained at2486 and is not an aged-wreck assertion.
- **L4 truck geometry PASS / canvas appearance FAIL, sampled:** arrival and wreck studies cover both qualities/backends at zoom0.5/1/1.5. Cab/bed/near tires remain complete, but intact canvas reflects as glossy metallic/chrome rather than fabric. Native distance probes cross tier LOD thresholds; some follow-camera frames put the truck offscreen, so metadata LOD changes alone do not certify far-tier panel appearance.

### Natural-time portrait ending and geometry budget

Low/high WebGL2 portrait720×1280 runs preserve the native HUD/UI, finish the ending and return to menu. Physical credit Pause holds phase ticks during a one-second wait; physical Resume advances them; physical Skip reaches thanks. The staged journey still consists of isolated objects on green planes; the panorama remains blank fog and the closing cast overlaps. Low/high paired portrait photographs were personally reviewed. WebGPU counterparts are separately recorded.

**E18 geometry FAIL:** low WebGL2 portrait localtick3942 / cureelapsed3749, `(4001.8,-28.5)`, full-map pullback renders about778 draws /1,108,821 triangles versus low300/500,000 budgets. High WebGL2 credits tick4458, `(4003.3,-28.0)`, renders933 draws /3,292,983 triangles versus high600/1,500,000. Excluding reported shadow draws/triangles still exceeds the respective geometry budgets (low741/1.084M; high782/1.969M). These are actual native render counters, without a quiet timing admission: no FPS, p95 or first-hit hitch PASS is claimed.

### L7 current route outcomes

All four sampled routes reach actual departure, then fail during the automatic L8 load (the same monkey/skin errors). Low saves24 after two retries; high departs with0saved because the24followers have died in this policy. These are policy outcomes, not a guarantee that a successful high rescue is impossible. The low bus's actual boarding/departure and high empty departure were personally reviewed. Initial wrecked-truck night body reads very dark despite the courier's warm lantern pool (tick0, `(273,15)`, both zooms/tiers/backends; **FAIL Q-142 readability**). The sampled departure has no top map edge/void, but crops much of the bus along the bottom as the shot opens (**framing FAIL**, exact cells follow in L7 report). Turquoise follower pips are visible in the full-size initial frame; small contact reductions are not sufficient to count every pip.

`npm run verify -- E07` also passes typecheck, lint and107/107unit tests,27files; [receipt](E07-checks.json). This is the shared per-change gate, not an epic-specific AC suite. Dedicated WebGL smoke is separately queued.
