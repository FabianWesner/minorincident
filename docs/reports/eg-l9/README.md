# E31 / L9 driving rebuild

Lane: `eg-l9` · PO 2026-11-08. Timeboxed implementation handoff; full native and browser qualification is not yet complete.

## Main integration — eg-l9-m

Main `78219de9` is merged at `4ca5ee13`; the merged API assertions are committed at `27727701`.

- Dialogue retains every key from both parents, with no duplicate keys. L8/L10 follow their story reconception, and L9 retains the exact script lines; the unused old roar caption now uses the script’s “Something is following you.”
- Actor protection combines L8 Private Reyes / Major Hale, L9 armored crew and the thrown research companion, and L10 hangar actors.
- `Vehicles.scriptPose` retains departure speed and wheel rotation alongside the full crash quaternion and attached actors. L8 passes speed; L9 passes the crash rotation explicitly. Existing unit coverage now asserts both features together without adding a test case.
- SimWorld retains L9 hatch weapons and controlled crawl, L10 corn slowdown and destruction, and both levels’ lifecycle behavior.
- Native receipt provenance retains the revision override and manifest-only fallback through main’s existing `sourceRevision` helper.
- L10’s saved-Sam lookup now consumes L9’s separate `researchCompanion`; evacuated survivors retain their separate northbound-truck roster.

The first remote batch on `27727701` passed typecheck, lint and the full unit suite (106 passed, one skipped, 27 files; 190.2 seconds within the 240-second budget). The unprotected low-tier road run failed at 211.98 seconds: the courier died after evacuation, pinned near the stopped bus. Collision invariants and admission checks had zero violations. This is a failing completion result.

`fabcef57` addresses the observed causes: carried hatch rounds now pitch down to visible ground enemies using the existing deck-gun pattern, and that pitch is retained through projectile motion and destruction rays. The ordinary input bot defends exposed civilians, leaves camp toward the bridge rather than returning to the old approach bend, and reads the stopped bus as an obstacle. The existing vehicle test now asserts actual hatch damage as well as the merged speed/roll API. A fresh remote rerun of the same four checks is queued. See [merge-verification.json](merge-verification.json). No browser is used. The earlier build qualification below remains historical evidence, not qualification of this merge.

## Done: implementation

- Mixed route packs and patrols enter more than 100 m from the APC, then move toward its engine while the driver is hidden. This uses authored scripted travel rather than human targeting, which correctly excludes a seated courier.
- Six hull slots (eight at low durability), a three-second climb and 10 HP bites every second. Actual yaw rate, braking or a physical scrape releases boarders. Heavy infected stop momentum and cost 40/80 durability; bloated contacts cost 60 and clear boarders. Damage progressively lowers the speed cap to the existing 60% floor.
- Reusable light barricades and solid concrete blockers, with matching models and collider sizes. The road has a tanker fuse and optional overpass ramp; the countryside has a timed fire wall and detour; the shortcut has mixed escaped zoo infected and a ditch ramp. The ramps use native Rapier contact and suspension.
- A thirty-second rail restart with carried-weapon hatch defense, plus an optional marked repair bay. Holding E/ACTION adds up to 300 durability over twenty seconds; releasing it pauses progress. Armed passengers use the existing ally weapon logic from their hatch positions.
- A native school bus pursues, rams for 40 durability, and releases its pre-existing infected passengers when slowed. Solid collisions or destruction end its pursuit.
- The sixty-second evacuation gate has a breakable side fence. Survivors visibly leave the APC and walk to the trucks. Rosa holds the corgi; the dog returns aboard, Sam stays, and the trucks receive the actual living roster. Guard fire and reinforcements remain active during the stop.
- The finale starts on the bridge deck after evacuation. The Mega lands on the hull, spans drop behind the APC, and the scripted fall begins with the vehicle's real transform and velocity heading. The full hull rolls onto its side. The weapon rack and launcher tumble into the river, with a two-second view and burning fuel. Sam is thrown toward the far bank and limps away.
- The arsenal becomes axe-only at its visible loss. The crawl advances only with movement input, the axe is drawn on her back, the corgi remains safe, and the wreck explodes after she clears it. The exact closing caption plays before completion.
- Checkpoints retain driving phase, encounters, passengers, timers and native obstacles. The handover stores only visibly evacuated people in `shelteredPassengers`; Sam/Private Reyes is carried separately as `crossingHandover.researchCompanion` for the L10 story lane.
- L9 acceptance rows are updated and numbered through L9-18. Story lines are copied from `docs/design/story-script.md`.

## Verification

The final gameplay pin is `3d1785b2`; the sequential remote harness is `e8720e57`. Fresh qualification of that version is pending. The final rerun was cancelled at 20:03 UTC on 2026-11-08 after about ten minutes in FIFO, before remote admission, to obey the orchestrator’s wrap-up instruction. No check was left running. Heavy commands run exclusively on Hetzner, one at a time, with local fallback disabled. No browser was opened.

- A prior committed remote full unit run passed: 106 passed, one skipped across 27 files, with `--maxWorkers=1` (211.6 seconds including the budget wrapper). The registered test inventory remains within the existing 150-case cap. The long story scenario now runs as a standalone native probe rather than extending the suite past its time budget. No test cases were added.
- The standalone story mechanics probe passed on the earlier `290d000b` gameplay version: held/released repair, hatch fire, rail restart, actual truck arrivals and losses, fresh checkpoint reconstruction, Sam remaining, forward-only bridge entry, continuous crash pose, input-only crawl, one explosion, axe-only arsenal, safe corgi and campaign handover. Its explicit phase placements and courier HP refill qualify mechanics, not route difficulty.
- Both native ramp fixtures repeatedly passed: high speed clears each gap while low speed fails. The overpass reached 3.698 m with 49 airborne ticks; the ditch reached 3.468 m with 34 airborne ticks. These are explicit initial speed fixtures using ordinary native contact afterward.
- Earlier unprotected route runs exposed repeated attachment after shake-off, fork blockers, independently sleeping seated passengers, competing companion controllers, and evacuation access problems. Those causes are fixed. The most recent road and zero-durability runs reached evacuation alive but did not finish the corgi transfer; they remain failures. The final version clears the goodbye space, uses the authored rear entry for visible transitions and gives the longer companion body an appropriate boarding reach. A subsequent story fixture exposed personal-space collision preventing the approach; `3d1785b2` extends the existing Rosa/corgi paired exemption through their approach.
- Last completed batch on `49a6d414`: **typecheck passed; lint passed; all four ramp fixtures passed; story probe failed at the goodbye approach**. Its source hash is recorded in [verification.json](verification.json). This failure motivated `3d1785b2`.
- **Not run on final `3d1785b2`:** typecheck, lint, story and course probes; low-tier road, countryside and shortcut; high-tier road; initial-zero-durability road; full unit suite; `qa:accept -- --level L9 --skip-browser`; `qa:threat -- --levels L9 --maxWorkers 1`. The cancelled queued batch produced no qualification for this source.
- Raw output is under `test-results/eg-l9/`; each probe records its source hash and fixture method. Earlier logs there are not qualification for the final pin. The final batch was cancelled while queued, so no earlier result is promoted to a pass for its source.
- Native first-visible admission is only a conservative 45 m distance proxy. Rendered max-zoom admission and device performance remain browser QA work.

## Open / follow-up lanes

1. **Native completion gate:** obtain passing unprotected low-tier runs on all three routes, high-tier road, and initial-zero-durability road. Previous runs that reached camp but timed out are failures. Rerun the native story fixture and ordinary route matrix before claiming the `3d1785b2` goodbye/boarding fix works.
2. **Fresh required checks:** resolve every fresh unit, acceptance or threat failure against the pinned source. Acceptance rows with rendered, device-performance or manual conditions must retain their unqualified status until QA supplies that evidence.
3. **Browser QA:** inspect the full level in both quality tiers, including the visual crash and handover, with the checklist below. This lane was explicitly forbidden to open a browser.
4. **Cross-level continuity:** the L10 story lane and its `crossingHandover.researchCompanion` consumer are now merged. Verify living Sam and fallback Private Reyes campaigns separately. The producer retains actual evacuated identities separately from the research companion.

The original “real driving level, verified” goal is not closed by this handoff. The orchestrator requested wrap-up after the three-hour timebox; remaining qualification and any failures belong to follow-up lanes.

## Browser QA needed

No browser was opened in this lane, as instructed. QA should inspect both quality tiers:

- Max zoom admission: mixed packs already moving, no first-frame idle formations.
- Boarder climb and real turn/scrape/brake release; driver HP and hatch shooting.
- Breakable versus solid obstacles; both ramp jumps and low-speed failures/detours; tanker fuse and countryside fire closure.
- Bus pursuit, wheel motion, ram readability and passenger spill.
- Gate deadline and late fence entry; truck transfer, Rosa/corgi goodbye, Sam remaining.
- Mega landing, dropping spans, whole APC roll, readable burning rack/launcher loss, controlled crawl with the axe on her back, safe dog and final explosion.
- L10 receives four evacuated named survivors when alive, the separate research companion, a safe corgi and exactly the axe.
- Draws, triangles, frames and streaming budgets from E18/E31; only native CPU counters can be checked by this lane.

## Resume validation

Use the existing sequential batch, exclusively on a remote runner:

```sh
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --pull test-results/eg-l9 -- sh tools/qa/l9-validation.sh
```

The batch runs typecheck, lint, story, ramps, five driving profiles, the complete unit suite (one worker), browser-skipped acceptance and threat audit. It records every stage’s exit code in `checks.tsv` and continues through functional failures. It creates an ordinary Git HEAD only inside its disposable remote snapshot for existing source-freshness checks.

## Integration

The earlier sandbox prevented Git metadata writes. Permissions are now fixed: the initial progress is committed as `9f79fedd`, and `main` through `a7b70c78` is merged. Its story script is authoritative. The main implementation is committed as `74cd1db6`; subsequent native integration fixes are being validated. Native follow-up fixes and the sequential remote validation batch are committed through `e8720e57`; the final gameplay change is `3d1785b2`. The report and compact evidence are committed separately. No deploy or push was performed.

## Criterion corrections

The explicitly authorized 2026-11-08 lane brief and concept require hatch fire, repair and differentiated heavy contacts. The earlier E31 AC01/03/06/08 prohibited those behaviors, so those four wrong criteria were corrected and dated to the PO direction. Their old prose defaults are superseded by the dated rows. The 2026-10-13 permanent 0-HP driveable floor is retained. The acceptance damage checker now checks the exact new archetype costs instead of rejecting every heavy contact as a ten-point billing regression.
