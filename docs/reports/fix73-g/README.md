# fix73-g — VQA4 gameplay findings

**Historical run:** the L7 high timeout and L10 dog regression below are superseded by [fix73-g2](../fix73-g2/README.md), which retains this run as evidence.

Base `5a7f84b`; final game commit `35d5042`. Work finished with measured failures retained below. No push, deployment, performance work, dependency changes or acceptance criteria changes.

## Findings

| Brief item | Change and result | Evidence |
|---|---|---|
| 1. L7 continue opening | `11555ca`, superseded by `35d5042`: clear the lead centre slot, move the close infected cluster 10 m west, and give the courier eight seconds of opening damage grace ending on normal pickup. **Partially fixed:** final low picks up at tick 67 with 100 HP and 24 followers; high takes 18.75 s, loses 80 HP and 3 followers before pickup. | [Exact final opening](L7-release-opening.json), [earlier successful repeat](L7-final-opening.json), [rejected spatial-only attempt](L7-opening-spatial-only.json) |
| 2. L7 bus boarding | `e8123c9` refined by `35d5042`: start within the original 6 m radius, then latch boarding while the courier covers the rear; courier returns within 6 m to depart last. Empty roster says “No survivors.” Improve existing local detours and corgi corner tracking. The native input driver stays with a straggler until the bus approach. **Unresolved survival:** final low saves 1/24, high does not reach the corridor. | [Final bus failure](L7-release-bus.json), [earlier boarding mechanics](L7-boarding.json), [pre-correction failure](L7-boarding-before-route-correction.json), [focused policy controls](L7-followup.json) |
| 3. L6 gate90 | `b1ba0e3`, `0906e73` (probe typing `4778a00`): use actual riot shields, retaining 600 HP, 0.5 m radius and 4.5 m/s speed. Both tiers physically demonstrate two 90-tick shield openings and defeat both fronts. Correct the debug driver's carried-shotgun selection. Earlier high physical E closes gate90. **Counter fixed; escort balance open:** fresh low saves 4/29. | [Gate](L6-gate.json), [final counter](L6-final-counter.json), [policy diagnosis](L6-policy-diagnostic.json), [final fresh route](L6-final-fresh.json) |
| 4. L9 quiet driving | `723e4a0`: admit safe runner trios within existing pool/cap and 720-tick cadence, including direct-ahead placements. Bounded physical drives encounter seven trios each; 10 low / 12 high contacts reduce APC armor to 890 / 880. No cap excess. | [Patrols](L9-patrol.json) |
| 5. L10 empty traversal | `739a504`: extend safe off-camera placement and release complex approaches earlier; retain counts, caps and wanderer cadence. Both physical runs meet all 17 new patrols. Conservative R6 visible within 40 m gaps: 26.5 s low / 15 s high. **Patrol interception fixed; local dog overlap regression remains open.** | [Corridor](L10-corridor.json) |
| 6. VQA4 tracked source | `50f6fa6`: load the current tree's versioned corridor checkpoint, including slim checkouts, and validate optional JSON/gz overrides. Both tiers physically load and advance. Default is the R6 entrance checkpoint. | [Tracked source](tracked-tool.json) |

## Remaining findings

- **L7 high continue pickup remains unreliable.** The exact-source repeat expires the eight-second grace before pickup, arms at tick 1125 with 20 HP and 21 living followers. Low arms at tick 67 with 100 HP, then loses followers during ordinary traversal. Earlier successful repeats are retained as history, not substituted for the final failure.
- Final high native L7 completion reaches its 1,200 simulated second budget without finishing. The focused low-tier threat controls do not establish high-tier route completion.
- Final bus results are recorded below. Earlier candidates saved 24/24 high and 23/24 low, but a later candidate saved 17 high (two lost after boarding starts) and stalled with 24 living before the bus at 233 s low. Those failures prompted the final route correction; they remain archived.
- Fresh physical L6 low finishes in 192.3 s with 4/29 survivors and no courier deaths. Readable strain/broken feedback accompanies 28 shield breaks, 25 on observed 600 HP fronts. The default physical driver passes gate90 without closing it; the earlier high manual E probe demonstrates closure. Controlled pair probes supplement the route and disclose their production-actor setup.
- The first L6 candidate regressed native completion to 1,200 s / 19 deaths because the driver switched to melee against shields. The carried-shotgun correction resolves that policy regression; failed receipts remain archived.
- **L10 local dog overlap increases from 5 at base to 6 in final low R6, above maximum 5 (`L10-03`).** Admission/movement diagnosis remains unfinished. Total infected caps hold in the physical corridor; no population/cap reduction or checker change was made.
- L9 evidence covers bounded default drives, not six-route qualification. L10 evidence covers R6→R7, not every region. Whole-row review metadata/clauses remain unchanged; appended notes state the narrower observations.

## Final L7 bus playtests

[Final receipt](L7-release-bus.json): fresh wide-camera runs, protected courier and ordinary follower damage. High default input ends at 237 simulated seconds with 11/24 living, about 200 m before the corridor; the planned retreat input is never issued because the bus is not reached. Low moving-cover completes in about 208 simulated seconds but saves only 1/24: 8 are alive when boarding starts and 7 die during boarding. All 15 captures were inspected and deleted. The zero-roster production-method fixture returns “Aboard 0/0 · No survivors”; it is explicitly separate from the browser route.

## Method and evidence

Physical runs use the shared headless browser pool, Metal WebGL2, unique preview ports, at most two contexts, no skips or frame timing. Opening uses a mortal courier. Escort/corridor probes disclose courier protection; follower and APC damage remain ordinary. Controlled input never forces pickup or mission progress.

Every generated capture is personally inspected. Receipts retain per-image SHA256 and concrete observations plus compressed input logs and ledgers. Raw captures are deleted; no images committed. Rejected attempts are identified. [Build identities](builds.json) bind L9/L10 to served bundles; [final L7 build](L7-final-build.json) binds the exact-source repeats. Focused native L7 diagnostics disclose their mandatory partial-selection flag; they are separate from the full gate.

## Final validation

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS.
- `npm test`: 27 files / 107 tests PASS, project worker cap retained.
- `qa:accept -- --level <level> --skip-browser`: final-source rerun for L6/L7/L9/L10, both tiers, complete and stationary policies. Seven of eight completion routes finish with no courier deaths; L7 high times out at 1,200 s. All 78 checkpoint checks PASS with identical controls; 74 fixture clauses report zero errors. These native runs are separate from physical evidence.
- `npm run qa:threat`: PASS, **0 flags**, exit 0, 301.4 s audit / 303.5 s command. Final standalone run admitted at host load 3.268 after every other owned check/browser finished. [Gate receipt](gates.json) includes admission, exact source, full audit and logs.

[Acceptance summary](acceptance.json) records exact checks, source identities and receipt hashes; [logs](acceptance-logs.json.gz) retain the final rerun and rejected L6 candidate. Shared aggregate acceptance indexes are restored after the rerun. Scoped observations are appended to L7-01, L7-10, L6-09, L9-03 and L10-04 without refreshing unmeasured compound clauses.

| Level | Fresh failing rows | Fresh failing globals | Incomplete rows |
|---|---|---|---:|
| L6 | — | G-22 | 10 |
| L7 | L7-01, L7-05 | — | 10 |
| L9 | — | — | 8 |
| L10 | L10-03 | — | 10 |

All four acceptance commands exit 1 with retained failures. L6 G-22 already fails at the base. L7-01 has no performance receipt valid for the changed source (performance was deliberately not rerun); L7-05 low records 0.823 attacks/min against 6 required. L10-03 retains the dog overlap 6 > 5 and stale simultaneous-census qualification. Counts, caps, timers, verdict logic and historical results were not relaxed.
