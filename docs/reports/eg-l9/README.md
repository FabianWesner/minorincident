# E31 / L9 driving rebuild

Lane: `eg-l9` · PO 2026-11-08. Work in progress; native validation is pending.

## Implemented

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

- Earlier local typecheck and lint passed before the remote-only direction.
- Earlier full unit suite: 106 passed, one `gate-tools.test.ts` freshness assertion failed (`FRESH` versus `STALE`). The working source tree was dirty; a clean committed rerun is required before assigning a cause.
- Current remote typecheck and lint passed. The native vehicle test caught an evacuation guard spawned on blocked navigation; guard posts now snap to clear body-sized cells. The rerun is queued. Earlier typecheck findings (event guards, render matrix field and model typing) are fixed.
- New native assertions extend the existing vehicle case: climb timer/unique slots, cab versus hatch fire, timed restart, held repair/release, actual truck arrival, Sam staying, checkpoint restore, no crash transform jump, no automatic crawl, one post-escape explosion, and axe-only handover.
- Required final remote checks: typecheck, lint, full `npm test -- --maxWorkers=1`, `qa:accept --level L9 --skip-browser`, `qa:threat --levels L9`. Results are not claimed until run against the current files.

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

## Integration

The earlier sandbox prevented Git metadata writes. Permissions are now fixed: the initial progress is committed as `9f79fedd`, and `main` through `a7b70c78` is merged. Its story script is authoritative. The main implementation is committed as `74cd1db6`; subsequent native integration fixes are being validated. No deploy or push was performed.

## Criterion corrections

The explicitly authorized 2026-11-08 lane brief and concept require hatch fire, repair and differentiated heavy contacts. The earlier E31 AC01/03/06/08 prohibited those behaviors, so those four wrong criteria were corrected and dated to the PO direction. Their old prose defaults are superseded by the dated rows. The 2026-10-13 permanent 0-HP driveable floor is retained. The acceptance damage checker now checks the exact new archetype costs instead of rejecting every heavy contact as a ten-point billing regression.
