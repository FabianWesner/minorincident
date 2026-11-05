# fix51-r10c — L7–L10 acceptance lane

Base: `e851b81cd`. Work is confined to acceptance tools, the opt-in physical L7 escort driver, and evidence. No game source, specifications, performance targets, or dependencies changed. No deploy or push.

## Results

Use each level JSON's `currentStatus` for the fresh measurement. Historical PO failures remain in `status` until the PO explicitly closes them.

| Level | Fresh PASS rows | Fresh FAIL rows | Still NOT CHECKED |
| --- | --- | --- | --- |
| [L7](../fix51-verify/L7.json) | 02, 04, 05, 07, 10 | — | 01, 03, 06, 08, 09, 11, 12 |
| [L8](../fix51-verify/L8.json) | 01, 02 | 06 | 03, 04, 05, 07, 08, 09, 10, 11 |
| [L9](../fix51-verify/L9.json) | 03, 08 | — | 01, 02, 04, 05, 06, 07, 09 |
| [L10](../fix51-verify/L10.json) | 01, 03, 04, 05, 06, 09, 10, 13, 15 | 07, 11 | 02, 08, 12, 14 |

L7-04, L9-08, L10-10 and L10-13 were already covered; their matching native evidence was refreshed or retained. Newly complete measurements are L7-02/05/07/10, L8-01/02, L9-03, and L10-01/03/04/05/06/09/15. Across the assigned 47 rows: **18 fresh PASS, 3 fresh FAIL, 26 NOT CHECKED**. Fourteen rows gained complete fresh coverage in this lane. L7-05, L9-03 and L10-04 still have historical FAIL status despite current PASS. This report does not grant PO closure.

### Measured failures

- **L8-06:** complete-route player/group windups are **3.4901/min low**, **3.1115/min high**, below the unchanged **4/min** requirement. The evaluator previously omitted the complete-policy L8 rate. It now checks both policies and all hard-rule clauses. The 3.99/4.00 boundary is retained in the evaluator proof. This is a measured game pacing failure, not a reason to lower the target.
- **L10-07 and L10-11:** the same persistent Mega is moved by `mega.rally`: **1,135.197 m low** at tick 65640, **745.518 m high** at tick 68310. E32-AC21 forbids scheduled replacement/teleport even though the shorter row text omits it. The full 240-second assault reaches the numeric caps/rate/reach targets, but the teleport fails both rows. Removing it is not a small proven fix: the pursuit/timing relationship needs a separate game change.
- Mega arena arrival was **140.0333 s low / 140.8333 s high** after activation. The checker retains those measurements without inventing a ±1-second acceptance tolerance for “~140 s.” The timing clause stays for review; the teleport independently makes the row FAIL.

### What the completed checks establish

- **L7-02:** actual mortal native L5/L6 completions produce nonempty carried rosters, **28 low / 27 high**, with exact IDs/full HP at L7. Every first-ten-second relative motion segment clears the actual body radii (minimum clearance **0.03349 / 0.05856 m**), and all six story weapons are present after the ordinary rocket pickup. Independent controls end in the same state.
- **L7-05:** complete and stationary low/high threat clocks/rates/body-clear reach qualify against current native receipts. The historical failure remains visible separately.
- **L7-07:** **4,544 low / 4,426 high** active corridor ticks have zero mismatches between production HUD text and an independent living-human/18 m census. The corridor marker never changes identity. Final native state matches the canonical control.
- **L7-10:** nonempty native cohorts (**15 / 24**) all board. Controlled physical entry tests separately check the 15-tick spacing, living infected remaining elsewhere, and 1,200-tick stall recovery.
- **L8-01:** physical L7→L8 handovers carry **6 low / 8 high** actual escaped IDs. Humans start at their own full HP, including 60-HP named survivors. Exact carried racks and selected rocket persist; native L8 routes contain no weapon pickup transactions. Read-only production L8 construction from those saved physical L7 results confirms human/corgi full HP and rack/selection state, with an identical independent constructor control.
- **L8-02:** physical DOM samples start at tick 0, remain objective/pin/world-marker free before tick 3600, and show the breach/objective exactly at tick 3600. The every-tick native calm ledger independently requires 3,600 ticks ±1 with zero combat events and zero markers.
- **L9-03:** full physical authored **road, countryside and shortcut** drives at both tiers meet the unchanged ≤60 active-sim-second visibility limit. The bound includes the maximum sampling interval. Counts use living submitted bodies with LOS/on-screen chest, not minimap dots. All fresh captures were inspected. The failed initial high road and high countryside attempts remain archived; the driver stopped at roadside objects, which does not establish an inescapable game wedge.
- **L10-01/03:** actual admitted regional peaks, species and regular group sizes, the complete first minute, and actual handgun-before-residential-dog timing qualify. The first admitted R2 dog is tick 4950 after pickup tick 3497, with zero premature dog ticks.
- **L10-04:** every geographic region has a nonempty observed window, actual player windups above its floor, and body-clear reach samples. All living infected within 30 m are considered; pending admissions count blocked. Every sampled region is 100% reachable under the ≤2.5× direct path bound. Observation leaves the canonical state unchanged.
- **L10-05:** all four actual weapon acquisitions occur within their named 2 m checkpoint anchor, on approach interaction, with the acquired weapon already present in the same-tick checkpoint. At each naturally reached pre-pickup Resume snapshot, inventory-only additions of the named weapon or all four weapons produce zero births and exactly the same every-tick infected census as the unchanged baseline for four seconds.
- **L10-06:** native dog speed, actual bite damage/reach, telegraph and cooldown fixtures pass. Naturally reached native production Resume encounters put living infected dogs and the corgi in the same actual browser scene. Physical sidestep captures at low/high and both observed zooms show the lean tan/brown, long-legged animal below the human torso, distinct from the stockier orange/white short-legged packed corgi. All twelve single-clause omissions prevent whole-row PASS.
- **L10-09:** the ordinary canister grant leaves both racks exactly unchanged. A separate canister-only intervention replays the same naturally reached production Resume with/without the item/flag, preserving actors, positions, objective, time and RNG. All four 120-tick cardinal-input trajectories match exactly at both tiers, with 8.7498–8.7551 m displacement. Actual subtitle/backpack photos at both zooms and tiers were reviewed; a controlled mortal death restores the carried canister at `cure-research`. Each of eight individual clause omissions prevents whole-row PASS. Route medians remain diagnostic, not the basis for no-slowdown qualification.
- **L10-15:** controlled mortal deaths at all nine naturally reached checkpoint boundaries restore loadout, cure, boss HP/death and regional respawn state; **27 clauses/tier** pass with identical independent controls.

## Browser method and visual review

Shared headless browser pool only; Metal WebGL2, unique owned preview ports, at most two owned contexts, no 3300, no objective skips or actor relocation. The courier is protected in physical input runs, explicitly recorded; these are not mortal difficulty proofs. Photo capture pauses simulation and restores camera/quality. No performance frame timing was collected.

The debug L7 diagnostic starts with **15 low / 24 high** humans. It does **not** start empty. The low default driver stalls in the opening fight and loses all 15 before getting the rocket; high brings eight humans into L8. An opt-in L7 moving-cover driver uses physical WASD/mouse to advance toward the actual ring. The carried-save repeats then start with 28/27 and bring six/eight into L8. The default behavior of other levels is preserved.

Every retained review records a capture SHA-256 and what was visible. Contact sheets and compressed logs/ledgers have their own hashes. Stills establish sampled appearance, not continuous motion or every intervening frame. The independent ledgers provide the temporal/identity measurements.

- [Carried low review](L7-L8-carried-low/review.json), [carried high review](L7-L8-carried-high/review.json): green-bar formations, later combat losses, full-health arrivals, quiet L8 HUD, evacuation and boarding. Burning trucks are lit, blood and corpses are visible. A circular facade cutout is not treated as proof of a walk-through wall.
- [Debug low review](L7-L8-low/review.json), [debug high review](L7-L8-high/review.json): opening crowd, red Alpha ground effects and corpse accumulation; low empty-group departure; high eight-person arrival; calm HUD and lit APC surrounded by red-bar infected.
- L9 per-cell `L9-*-reviewed.json`: working headlights and intact APC at start; living red-bar infected beside routes/in headlight cones; some empty sampled stretches; tight 0.5 photos sometimes crop nearby bodies. Bridge stills show a wreck under orange flame and get-clear text, not the entire fall animation. Cab pose/leg clipping remains unqualified.
- [Earlier L9 diagnostics](diagnostic-L9-history/review.json), [initial high road failure](initial-high-road/review.json), [initial high countryside failure](initial-high-countryside/review.json) are retained separately from the current matrix.
- [Initial L10 harness error](L10-initial-harness-error/review.json): the run reached research approach but its wrapper wrongly enabled an L8-only calm assertion at shutdown. That diagnostic is not an L10 acceptance result. The wrapper now enables the audit only when L8 is requested.
- [L10 low first slice](L10-low/review.json), [high first slice](L10-high/review.json): axe-only crash opening, handgun/shotgun/machinegun checkpoint progression, the roar subtitle and distant Mega ring, suit-infected fights beside houses, lit service/checkpoint props and fields. Both yield before the finale. The high-tier following HUD is not treated as proof of a nearby visible corgi. Audio scheduling is retained with browser output muted; no audible-quality verdict is claimed.

- [L10 low research/delivery](L10-low-batch-2/review.json), [high research/delivery](L10-high-batch-2/review.json): full research text explains the airborne agent, healthy safety, immediate infected death, no reversal and regional dispersal. White/green canister visibly attaches to the backpack; rocket receives its own ordinary slot. Several later delivery frames show nearly featureless dark ground/road. These samples do not qualify overall route readability.
- [L10 low finale](L10-low-batch-3/review.json), [high finale](L10-high-batch-3/review.json): rocket/Mega fight, overlapping orange explosions and smoke, lit console, large human/dog/Alpha-shaped corpse field, mist, late camera pullout and title/tagline. Low finishes normally to the main menu. High reaches epilogue/title but the wrapper times out saving pause settings during the ending; its final result is diagnostic, not a clean run PASS. Both title photos show the title overlay, not the automatic credits list. Player control throughout the 150-second epilogue is unqualified. Navigation assists are logged physical WASD toward actual map/ring locations; no actor relocation or objective skips.
- [Resume provenance](L10-resume-provenance.json) links the exact physical campaign exports and compressed completion logs used between bounded slices. Production Resume resets the local tick epoch; ticks from separate slices must not be added as one continuous clock.
- [Corgi position observation](L10-corgi-distance-observation.json): actual saved high-tier corgi positions are 1,040 m behind at the first yield and 2,613 m behind at the second; low is 356 m behind at its second yield. All saved corgi HP is 100/100. The following HUD alone does not establish keep-pace or visible-body coverage. This is a diagnostic observation, not a causal diagnosis or a newly assigned row verdict.

- Living-dog reviews: [low 0.5](L10-low-dog-z0.5/review.json), [low 1.5](L10-low-dog-z1.5/review.json), [high 0.5](L10-high-dog-z0.5/review.json), [high 1.5](L10-high-dog-z1.5/review.json). These short physical encounters use exact naturally reached native production Resume actors; only the saved photo camera field changes. Three close-contact captures/cell show the live dog/corgi distinction. Ordinary native mechanics remain independently required. Courier protection starts after normal run initialization, so initial contact can show damage. [Initial low 0.5](dog-initial-low-z0.5/review.json) and [initial low 1.5](dog-initial-low-z1.5/review.json) are retained as manual/default-zoom diagnostics: requested framing was bypassed and the stationary courier died before run initialization. They do not qualify either matrix cell or establish a difficulty failure.

## Still open: exact missing work

| Row | Why it stays open / next action |
| --- | --- |
| L7-01 | Pickup distance is observed; pickup/first-shot max-frame clause was not measured. Performance work is excluded from this lane. |
| L7-03 | Full rocket cadence, clicked-point/first-hit/range detonation, ≥20/24 kills in 3 m, ≥3 m usable gap and point-blank visual sequence need one controlled real-input proof. |
| L7-06 | Native completion and a street route do not prove two connected routes or adversarial wrong-way/dead-end/wall behavior. **P:** PO inspect whether “This street feels like a trap.” |
| L7-08 | Need exact initial final-corridor regular/Alpha census and an identified living survivor using the player-opened gap. |
| L7-09 | Native sampled follower pace passes, and green bars/formations are visible; continuous keep-pace and adversarial crowd-orientation coverage are incomplete. Do not infer no tipping from sparse stills. |
| L7-11 | Native cinematic time/displacement are measured; full burning-skyline shrink, final shot/map edge and complete bus-motion sequence are not reviewed. |
| L7-12 | Contrast ≥3:1 is unmeasured. **P:** PO compare destruction to all prior levels and inspect whether Alpha silhouettes remain human at both zooms. |
| L8-03 | Native basic census exists; staff count, full five-species tour, outside-wall exclusion and nobody-idle>3 s need a dedicated enclosure audit. |
| L8-04 | Native breach clock/outlet count exists; outlet separation, within-one-second 6/3-per-outlet admission and continuous no-pop-in require the event/position/frame burst. |
| L8-05 | Need attacks on every civilian/soldier/staff/animal cohort and same-ID/species 2.5–3.5 s animal turns; native Alpha/cap numbers alone are insufficient. |
| L8-07 | Need two ≥2.5 m escape paths from every enclosure and fixed APC destination throughout. The driver only traversed one service-building route. |
| L8-08 | Need infected-lion snarl/wound review and clean zebra legs at both PO zooms. Night courier readability is sampled only. |
| L8-09 | Boarding counter/green followers visible; need every living ID boarded, missing survivors continuously visible/marked, and no-gun APC proof. |
| L8-10 | Need measured ≤6 s playable handover plus same APC identity/durability across L8→L9; loading-card stills do not establish it. |
| L8-11 | **P:** PO inspect sanctuary then mixed battle and explicitly answer “is it stunning?” The captured direct escape misses the complete enclosure tour. |
| L9-01 | Need ≤0.5 s actual input availability, carried passenger/durability census and continuous corgi/cab-leg geometry, especially turning/collision poses. |
| L9-02 | Need every authored route-group census and physical ≥20 m detour around each; mere route completion is insufficient. |
| L9-04 | Need controlled collision onset versus sustained contact, stopped-surrounded windup/damage and matched safe/shortcut durability comparison. |
| L9-05 | Need physical zero-HP drive, 60%±2% speed, heavy smoke, steering and continuation to forced crash. No breakdown target changed. |
| L9-06 | No giant arrow appears in reviewed frames. Failed roadside drives require adversarial steering/recovery tests to distinguish driver limitation from a true wedge; HUD/durability trace remains incomplete. |
| L9-07 | Native one-crash/objective order exists; need full/zero-HP controlled crossing and complete wheel/hull fall frame burst. |
| L9-09 | Native chunk caps are measured (9/25). Need ≤2 cm seam geometry and uninterrupted physical input on all streaming boundaries. |
| L10-02 | Native introduction at 90 s, ≥80 m distance and actual same-ID roar/impact events by tick 7200 pass. The own-clearance query is null while the boss is outside the resident streaming window. That is inconclusive, not a path failure; actual reachable pursuit-route proof remains. |
| L10-08 | Need actual ×1.3 road camera framing/max≤2.0 and finale exception, suit-crowd readability and slam-ground-effect sequence. |
| L10-12 | Native HP/special fixtures exist; complete creature-corpse sequence and frame-time clause remain unqualified. Performance work excluded. |
| L10-14 | Native species mortality/healthy immunity fixture passes. Real-input low run completes; both tiers show 150-second epilogue samples, late pullout and title. Need every-kind wavefront touch/death ticks, continuous playable control, exact last-30–45-second camera trajectory and automatic credits interval. **P:** PO inspect the ending and title/credits transition. |

## Validation and completion

The timeboxed lane is complete. All requested prior-FAIL rows were remeasured; fourteen assigned rows gained full fresh coverage. Remaining rows are explicitly open above, including performance exclusions and exact PO review prompts. This is not an all-level acceptance sign-off.

Validated tool commit: `7b26a0a98`. Game source hash: `710a965e75362a3a634730b032b1d68d1f840cb9dd52f4d6fd039fa9dfeb0a23`; browser harness hash: `25fffe3d49af2b6223fd5ff8c1bc85dade26b1646973a42217fbb432c6bcb630`. Later commits contain report/evidence only.

| Gate | Final result | Evidence |
| --- | --- | --- |
| `npx tsc --noEmit` | PASS, exit 0 | [log](gates/typecheck.log) |
| `npm run lint` | PASS, exit 0 | [log](gates/lint.log) |
| `npm test` | PASS, 107 tests / 27 files, exit 0 | [log](gates/test.log) |
| `npm run qa:threat` | PASS, zero fail flags, exit 0, 366.3 s | [log](gates/threat.log), [compressed receipts](gates/threat-artifacts.json) |
| L7–L10 `qa:accept -- --level L<N> --reuse --skip-browser` | Completed for all four levels, zero fixture errors, matching canonical checkpoint controls; each exits 1 for measured/historical FAILs | [L7](gates/L7-accept.log), [L8](gates/L8-accept.log), [L9](gates/L9-accept.log), [L10](gates/L10-accept.log) |

The four required gates ran sequentially. `qa:threat` used zero flags and ran alone: no other owned browser, build, native, lint or test work was active. See [command timestamps/results](gates/results.json) and [log hashes](gates/log-hashes.json). The default threat gate's zero flags do not override the stricter acceptance measurements: L8 complete-route pacing and the L10 scheduled teleport remain FAIL.

All **612 raw JPEG captures** were inspected, matched to per-capture SHA-256/seen entries, and deleted. There are **610 unique image hashes** because two captured files duplicate previously seen pixels. All retained contact-sheet and compressed-log hashes were verified; [cleanup manifest](capture-cleanup.json) retains every raw path/hash/review reference. No owned browser or check remains running.

Whole-group acceptance reused only exact matching game/observer receipts. Shared all-level indexes (`docs/qa/acceptance-status.md`, `fix51-verify/README.md`, `fix51-verify/global.json`) are restored to the base rather than committing a truncated four-level index. The four level JSONs and this lane report carry the results; the coordinator should regenerate the all-level indexes after merging the lanes. No protected source/reference directories changed.
