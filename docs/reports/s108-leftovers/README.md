# s108 leftovers — report only

Target: current `main` at `dac01c9174b643ace2e67924047a199ffc75f376`, after the batch 97 L6 QA merge. No game files were changed. The current-main head equals the local `main` ref.

## Current verification ledger

| Item | Verdict | Evidence and remaining scope |
|---|---|---|
| L7 HIGH zoom-1 departure | **FAIL: static wreck occupies lane** | Opened 0.7 s and 3.4 s captures show seated passengers and following camera. Existing 12-run native body-clearance audit has zero intersections. Swept clearance against static props remains unverified. |
| L10 HIGH/LOW zoom 1/1.5 roads/crops | INCOMPLETE | Both tiers/zooms reach complex installation area; opened endpoints show supported paving and retained bodies. Corridor bot restarts its route westward, so its samples do not cover the full intended corridor. No gaps/z-fighting/floating-patch PASS is asserted. |
| Shotgun/nail gun vs hunting Mega, HIGH/LOW | PASS | Normal combat pipeline deals damage, reaches 1050/3000 HP floor, and recovers 61 ticks after last positive hit. Nail 20 HP, full close shotgun 240 HP; partial shotgun hits lower. Both have bottomless campaign ammo, so finite per-magazine damage is N/A. Opened paired captures show shrinking overhead bar. |
| Key 0, progressed L10 save | PASS — harmless dead key in sampled arsenal | Physical 0 leaves machine gun selected; 16 visible carried entries contain no crowbar and no 0 badge. Global shortcut 10 points to absent crowbar. No incorrect icon was observed. |

## Browser attempt and reproduction

The requested current-main browser attempt used `SCENE_PORT=4981`, `E2E_PORT=4982`, `E2E_UNITS=1`, `tools/e2e-lock.sh`, and a `SceneSession` smoke open. It stopped before browser launch with exit 75. The pool log records `Error: listen EPERM: operation not permitted 127.0.0.1:4329`. No browser was launched outside the lock. Retry the same locked browser work after the managed pool can bind its loopback port; first capture the HIGH L7 bus departure, then do L10 HIGH road zoom 1/1.5, then HIGH shotgun/nail gun versus Mega, then LOW cells, and finally the progressed-save key-0 interaction.

## Disposition

This remains HOLD for L7 static-prop clearance and the full corridor road sweep. Weapon and key-0 checks now have runtime evidence. No patch is proposed from the current evidence: the key mapping is global and moving the tenth shortcut without runtime proof could disturb other levels. No deployment, push, main movement, gameplay tuning, zombie stat change, or corpse removal was performed.

## Validation

`npm run typecheck` PASS; `npm run lint` PASS; `python3 -m json.tool docs/reports/s108-leftovers/evidence.json` PASS; `git diff --check` PASS. The requested `sh tools/remote/run.sh "$PWD" -- npm test` could not start (exit 69): no healthy remote runner is provisioned, and the runner refused the local Mac slot. This was not a timeout, so no unchanged retry was triggered.

## Unrestricted continuation

The browser pool is now healthy (pid 59909, no holders at recheck). Fresh current-source HIGH then LOW native complete-policy runs finished and produced corridor, complex and finale resumes under `test-results/s108-leftovers/`, retaining progressed mission and entity state. Their peak counts and installation/arrival measurements are retained in `evidence.json`. Browser verification remains pending; the earlier sandbox failure is historical.

Current production QA bundle built successfully. HIGH zoom-1 L7 departure now captured and both originals opened at 0.7 s and 3.4 s. Seated passengers are visible through windows and the camera follows the bus. The first image places the front near a roadside generator/barrier and soldier; the later image places it beside parked trucks/APC. Prop clearance is not yet closed by these stills. The inherited fixture required a wider district crop and ordinary courier movement InputFrames; neither gameplay source nor departure state was edited. Full receipt is retained in `evidence.json`.

HIGH road continuation captured 12 walked samples per region/zoom (1 and 1.5), with no browser errors. Opened corridor z1 first image: dark open ground beside a crop patch; opened complex z1.5 last image: connected tiled paving with dark joints. These runs cover only x3604–3679 and x3724–3786 and therefore do not close the full route. SceneSession hides the weapon rack, so its empty DOM query cannot establish key-0 hotbar behavior. Full traces are retained in `evidence.json`.

Native weapon continuation: both HIGH and LOW shotgun/nail-gun runs dealt real `combat.hit` damage and reached the **1050/3000 HP floor**. Nail hits deal **20 HP**; shotgun reaches **240 HP per close full hit**, with lower partial/range hits (first HIGH hit 18 HP, first LOW 24 HP). Both weapons have campaign magazine size **0 (bottomless)**, so finite per-magazine damage is not applicable. Traces include post-fire recovery; browser HUD movement remains unverified. Ordinary combat InputFrames drove the test from progressed corridor resumes; courier invulnerability was enabled, enemy state/stats were not edited. Complete hit/health traces and exact recovery delays are retained in `evidence.json`.

Recovery analysis corrected: measured from the last **positive-damage hit**, all four weapon/tier runs recover at **61 ticks (1.017 s)**. Zero-damage hits at the floor do not reset recovery; measuring from the last hit event produced misleading shorter delays. HIGH progressed-save key 0 was physically pressed with the HUD visible: 16 carried entries, machine gun (5) remains highlighted, no crowbar icon and no 0 badge. The opened capture confirms a harmless dead shortcut for this arsenal. Full before/after DOM and loadout state are retained in `evidence.json`.

Further HIGH optimized-bundle bot sweeps cover corridor x3585→3043/3046 and complex x3730→4000 at both zooms. The corridor bot retraces its initialized route westward, so this still lacks a complete connected forward sweep. Opened middle corridor and complex endpoint captures; corridor shows dark open ground, projectile trail and retained bodies, complex shows tiled apron and structures. No floating patch is established in these samples. Traces are retained in `evidence.json`.

Rendered weapon checks now completed HIGH then LOW. Eight original captures were opened: the Mega overhead bar visibly shortens under both shotgun and nail gun. LOW endpoint values are 1050 HP (35%) shotgun and 2080 HP (69.3%) nail gun; HIGH shotgun ends at 1134 HP (37.8%). The dedicated boss HUD panel is intentionally hidden before cure installation; the nearby overhead bar supplies hunting-phase feedback. Together with native floor/recovery traces, both weapons damage the Mega through the normal pipeline. Full runtime/render state is retained in `evidence.json`.

LOW route sampling is complete for both zooms, but corridor output retraces toward the research campus (x3047→2455), so it does not close the requested forward corridor. Complex sampling reaches x4005 at both zooms. Opened LOW campus/corridor diagnostic and complex endpoint originals; the out-of-scope samples are explicitly excluded from road acceptance.

HIGH forward follow-up now covers x3611→4003 at zoom 1 and 1.5 (31 samples each). Setting diagnostic bot waypoint 18 avoids its restarted exploration route; only driver state changes. Opened verge/road slab and tiled complex originals; visible dark areas are supported ground, with no floating patch demonstrated in these two views. Remaining corridor extent and complete image review remain open.

LOW forward follow-up covers x3073→4003 at both zooms (75 samples each). Opened corridor/breach views show dense gray fog that obscures ground detail; these images cannot conclusively clear gaps or z-fighting. Coverage advances, but a visual PASS still requires better-grounded review of the originals. See `lowForwardContinuation` in `evidence.json`.

Static-prop broad-phase audit identifies three conservative swept-bus AABB candidates: `l5-bus-68` school bus at (-45,46.3), `l7-corridor-alley-apc-2` at (-82.25,44.5), and dropped belongings with only 0.0195 m AABB overlap. These are candidates requiring render/mesh confirmation, not confirmed clipping findings; the school-bus candidate is particularly concerning because it lies on the departure lane. Native current-source placement details are retained in `evidence.json`.

**L7 confirmed static-prop failure:** actual L7 tier6 renders the legacy school-bus wreck `l5-bus-68` at **(-45,46.3)** in LOD0. The opened actual-level capture shows a full-sized wreck occupying the evacuation lane z47; its baked hull intersects the swept evacuation bus hull. Reproducer: HIGH L7 seed2, board normally; around 3.2 s into departure the evacuation bus crosses x−45,z47 through that wreck. Static diagnostic used courier teleport only to inspect the location; bus and mission state were untouched. The earlier SceneLab departure fixture omitted this legacy full-level dressing, so those captures do not clear actual-level prop clipping. Report only: no layout fix applied.

Current-source authored road audit samples **1368 points per tier** at approximately 1 m spacing across every R6/R7 route segment. Both tiers retain **410 corn blocks**, minimum crop-AABB clearance **4.5191 m**, and finite ground height at every sample. This confirms authored crop exclusion and simulation ground coverage, but does not alone prove rendered surface continuity or no z-fighting. Full numeric samples are in `evidence.json`.

The unchanged prescribed remote `npm test` now PASS on 46.225.66.90; full terminal output is retained in `validation.remoteNpmTest.log` in `evidence.json`. This supersedes the earlier unavailable-runner result. No check remains running.

Further original review: HIGH corridor z1 frame40 and z1.5 frame35 show supported dark roadside ground beside intact gray road slab. LOW forward z1 frame5 shows ground under a combat telegraph; z1.5 frame10 is almost fully fogged. No void is established, but LOW fog and temporal z-fighting coverage remain insufficient for a complete visual PASS.

LOW clear-weather diagnostic was attempted through the existing weather override and originals opened. Gray haze remains, so weather override does not solve ground visibility; these additional captures do not close the road clause. The likely remaining presentation source is authored distance fog, which needs direct inspection before further capture. No game source was edited.
