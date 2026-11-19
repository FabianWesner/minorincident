# s172-geom — L2-07, L7-04, L8-06: level-design fixes for the acceptance triage's open gameplay rows

Base: main `67ac4d1b` (the s168-failC merge). Scope verbatim from the triage reports: the three open
class-1 rows — L2-07 (the doors-stand pin, docs/reports/s166-failA), L7-04 and L8-06
(docs/reports/s168-failC). All fixes are level design only: placement, admission pacing and gate
state. No target, tolerance or measurement definition changed (docs/qa/level-acceptance.md is
untouched); no zombie stat, HP, cap, authored count or corpse rule changed (corpses persist); the
acceptance observer and its probe definitions are untouched.

## Row verdicts

| Row | Before (fresh sheet) | After (fresh remote re-measure) | State |
|---|---|---|---|
| L2-07 | low/stationary 88.89 % (2 wedged at the market forecourt, deterministic per runner) | complete 95.65/100, stationary 94.74/96.15 (both tiers ≥ 90, one residual worst-tick body at most, two-blocked headroom at the 26-strong nearby census) | **PASS** |
| L7-04 | 389 (sheet remote) / 384 (local probe) of the authored 400 high; low 200/200 | high 400/400 (residents 20 + runner births 380), alphas 5 (band 4–6), concurrent peak 199 ≤ 200; low 200/200, alphas 5, peak 98 ≤ 100 | **PASS** |
| L8-06 | 0 % windows: the closed-flamingo-pen census case plus the finale (east-tunnel pending walkers at the apron; the s168 residual window) | stationary 100/100 (was 97.44); the plaza-cell, east-apron and junction-stub 0 % windows are gone; the complete-policy still reads 0 on the residual zebra-leg straggler class below | **FAIL (residual documented)** |

## L2-07 — the doors-stand pin is the forecourt bike rack, not the parked truck

The s166 triage read the blocked pair (ids 211/125 at (−44.0, −36.7/−35.7), player at (−46.0, −36.8))
as "pressed against the parked fire truck". A geometry dump of the live world shows the actual pin:
the inherited depot bike rack's three thin hoop strips (x −44.85..−42.35, z −36.83..−35.57) straddle
the z ≈ −36.7 approach lane exactly at the authored doors stand. The horde converges on the
stationary courier along that lane, and bodies jam into the rack's 0.7 m hoop gaps with their
capsules overlapping the strips: their own nav cells are covered, `startCell` finds no visible
escape, and the bounded-path probe reads them unreachable. The truck hull (nav blob z −33.7..−30.3)
is 3 m north of the pair and crosses nobody's direct line. The worst-tick share is also
physics-build dependent (my local runs read 94.7–96.2 % on the same source the s166 remote sheet read
88.89 % on), so the row sat on the 90 % line from run to run.

Fix (`src/levels/L2/layout.ts`): the rack moves 2.8 m south (z −36.2 → −39.0). The forecourt keeps
its street furniture — the snowball headcounts and the street-admission cadence the L2-08/L2-11
letters are calibrated on depend on the rack's flow-spreading — but the doors approach now passes
clear north of it, and a body pressed against the rack's north face escapes straight into the open
lane instead of across the strips.

Fresh remote `qa:accept --level L2 --skip-browser` (runner total 854 s): **L2-07 PASS** —
complete 100 / 95.65, stationary 96.15 / 94.74, all four cells ≥ 90. L2-08 PASS (30/30 snowball at
both +60/+120 windows). L2-12 PASS. L2-15 NOT CHECKED (incomplete, no fresh failing clause).

Known trade: **L2-11 low FAIL** (high PASS: escapeArea 33, groupsOf4 4, 6 singles). The low tier's
street census now reads escapeArea 26 (≥ 25 ✓) and chasing 17.9 % (≤ 20 ✓) with the six route
singles admitted, but the street groups complete after the radio moment (groupsOf4 0 at the
reading). The rack's new position slightly slows the doors-fight slot recycling the street groups'
admission paces against; the follow-up lever is the street-group admission window in
`spawnEscape`/`emergePending` (a cadence re-tune, not a geometry move). This row was FAIL in the
last committed sheet (escapeArea 21) before the s166 fix; the geometry move trades its low-tier
letter for the L2-07 pin.

## L7-04 — the authored 400/200 delivered through the 200-slot queue

Diagnosis (local delivery ledger, seeded native runs): every authored pack arrives through the
director queue except the 20 residents, so delivery is deaths-gated — and the rear group (705) plus
the junction/corridor reinforcement ranks (712–714) were pressed once for twenty seconds on
admission, then stood mid-street holding their cap slots (712/713: 35 living each, zero kills,
100–250 m behind) while the last ~20 requests of pack 714 stayed queued behind the cap-saturated
boarding window: 384/400 delivered locally, 389 on the sheet.

Fix (`src/sim/missions/LevelSevenEncounters.ts`), two iterations:

1. First attempt also re-pressed the trailing packs on the corridor lane every 5 s so they stream
   into the fight. The fresh remote sheet showed this regressed L7-05 complete (100 → 66.7, wedges
   at the corridor's wreck line) and the follower-pace clause: ~100 extra street bodies pushed into
   the corridor. Reverted — the press was also unnecessary (2a0532fa).
2. Kept: beyond-approach straggler recycling — once the column is on the junction/corridor lane,
   street ranks left more than 80 m behind and offscreen free their slots for the queued tail (the
   same offscreen rule L2/L3 street encounters use; corpses, downed bodies, biters and the final
   horde's boarding stream are never touched; every authored request still admits exactly once).
   The recycling is gated on the authored queue being non-empty, so the encounter's own
   late-corridor flow is untouched once the 400/200 have arrived (ab2f5656).

Fresh remote `qa:accept --level L7 --skip-browser` (runner total 358 s): **L7-04 PASS** — high
400/400, alphas 5, concurrent 199 ≤ 200; low 200/200, alphas 5, concurrent 98 ≤ 100. The remaining
fresh L7 failures are the pre-existing s168 open items, not this lane's rows: L7-01 (stale
`fix72-c` browser receipts, native launcher clause passes) and L7-05 stationary 75 (the s168 open
item #2: turned civilians walled behind the rocket wreck beside the stationary courier). The
L7-05 complete clause passes again; L7-09 needs its follower-pace seeds re-collected (NOT CHECKED
on a loaded runner this pass; the follower ratios on the collected seeds read ≥ 0.978).

## L8-06 — three sealed one-way arms closed by design; the residual straggler class documented

Reproduced and fixed three deterministic multi-body 0 % windows; all level design:

1. **The east tunnel apron.** The east mouth (104.5, 32) opens into a permanently sealed service
   pocket — the always-on x = 99.1 path wall spans z −35..46 between its apron and the visitor lane,
   the maintenance corridor caps it south, the yard wall north — and the authored doorstep (98.5,
   32) lies inside that wall, so region-4 cohorts stalled at the apron unadmitted through the whole
   finale (four pending walkers at (99.7–101.8, 32) in the fresh windows; walk-route variants
   through the elephant entry still crossed the wall's z-span). Region 4 now admits no cohort from
   that outlet; the nightly census fixture expects zero east-tunnel admissions.
2. **The plaza cell.** The hold's surviving walkers (including ones knocked down that get up again,
   and cohorts still queued inside their mouths) were sealed in when the plaza doors shut, reading
   unreachable through the flamingo/monkey route at 18–20 m. The doors now shut on a cleared cell:
   the clear-down is fought to the end first (past a 150 s straggler deadline the leftovers are
   swept to the open north approach on the L2 gate-strip contract), and the plaza-camping hatch
   releases are now seal-gated so they cannot refill the cell while the clear-down runs.
3. **The zebra lane's east end.** The (63.1, 64) connector sealed the lane's east drain, so
   approach stragglers stood behind it 29 m from the boarding lane with no bounded path. The gate
   is gone: the drain now runs into the yard's west gate — exactly the evacuation's own opening —
   and dead-ends at the yard wall until the five enclosure fights clear.

Fresh remote `qa:accept --level L8 --skip-browser` (runner total 758 s): **L8-06 stationary PASS
(100/100, was 97.44)**; complete FAIL. The residual class, both tiers, is one body per window:

- high: a region-2 south-tunnel straggler milling the fenced field west of the yard (71.6–74.1,
  64–64.5) while the courier boards 8–23 m east;
- low: same class in the 1.4 m strip between the yard's west wall and the forecourt fence line
  (83.4, 71.9).

That field/strip maze between the zebra approach and the yard is entered by pursuit overshoot from
the zebra leg and has no bounded exit once the five-clear gate geometry is between the straggler
and the boarding lane: the direct distance (8–23 m) bounds any detour out of reach. This is the
same class the s168 report left open ("extend the 11-12 confinement ruling to sealed connector
arms, or change the walker release rule so no cohort is admitted into an arm the seal has already
closed") now narrowed to a single straggler family. The options for the orchestrator, in the order
I would recommend: (a) a west-apron drain for the zebra leg's stragglers (remove the crowd-fence
stretch at x 81.7–82.3, z 52.3–67 so the field drains through the yard's west gate, plus a strip
exit at the fence gap) — this is a layout-JSON edit plus a trap-corridor audit; (b) the 11-12
confinement ruling extended to sealed connector arms (the observer change my goal text excludes);
(c) accept the thin windows as the ruling's scope and re-class the row.

The other fresh L8 failures (L8-02/03/04/05) are the s168 class-3 rows (targets outdated by the PO's
L8 rework), unchanged by this lane.

## Validation

- `npm run typecheck`, `npm run lint`: clean.
- Remote `npm test`: 27 files / 105 passed | 1 skipped, exit 0 (176.7 s / 240 s budget).
- `npm run qa:threat` (sharded remote, both shards under the unchanged 600 s budget): **0 fail
  flags** — every level skilled complete, passive complete/tick-budget, 0 passive flags (the
  unsharded remote batch clipped at its fixed 600 s budget mid-batch on the loaded runner, the
  known s166 environment issue; the sharded run is the documented workaround and rebuilds the same
  audit).
- Fresh remote re-measures (one level per run, receipts regenerated and restored out of git):
  L2 (854 s), L7 (358 s), L8 (758 s) — values above.
- The nightly waves census fixture (`tests/qa/invariants/waves.test.ts`) was corrected with the
  east-tunnel change: the breach and east-region records now expect zero outlet-1 admissions and
  assert no cohort is ever admitted from the sealed service pocket (the fixture previously
  asserted the opposite release). The test's L8 section is currently masked by the pre-existing
  L6 hatch-drift throw (the s168 open item #5); it runs clean once that throw is fixed.

## Commits

- `22d9caaf` L2-07: the depot bike rack moves 2.8 m south of the doors approach.
- `17eeead8` L7-04: trailing street packs re-acquire + beyond-approach stragglers recycle (the
  delivery fix).
- `399919de` L8-06: the three sealed one-way arm rules (plaza clear-down seal, east tunnel closed,
  zebra lane east drain open) + the waves fixture correction.
- `2a0532fa` L7-05/L7-09 regression fix: the trailing-pack press extension reverted — the recycling
  alone delivers the authored queue.
- `ab2f5656` L7-04 recycling gated on the authored queue: the late-corridor flow untouched once the
  400/200 have arrived.

## Open items

1. **L8-06 complete-policy residual** (above): the zebra-leg straggler family in the west-of-yard
   fence maze. One body per window, both tiers; needs the west-apron drain design pass (option a)
   or the orchestrator's ruling decision (options b/c).
2. **L2-11 low street-group cadence**: the rack move slows the doors-fight slot recycling the
   street groups pace against; the lever is the street-group admission window in
   `spawnEscape`/`emergePending`.
3. Pre-existing, unchanged by this lane: L7-01 (stale browser receipts), L7-05 stationary 75 (the
   s168 open #2), the L6 nightly hatch drift (the s168 open #5), the s166/L168 class-3 target rows.
