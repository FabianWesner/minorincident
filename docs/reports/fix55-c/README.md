# fix55-c — L7–L10 acceptance work and frozen L7 follower

## Outcome

The bounded lane is complete; acceptance remains **NO-GO**. The frozen L7 corgi is fixed. Ten previously NOT CHECKED rows now have complete current machine coverage: **L7-03, L8-05, L8-07, L10-02/03/04/05/06/09/11**. Four current rows fail: **L7-09, L9-03, L10-07, L10-08**. Whole G-13 follower pace still fails. The 47 level rows finish at **21 PASS, 4 FAIL, 22 NOT CHECKED**. PASS means current implemented coverage; historical PO findings remain separately open.

Work started from `48f6bc647` on `lane/fix55-c`. Each row has its own commit and a [source-bound decision](rows/) with exact checks, evidence SHA256, observed scope and remaining work. All 47 rows have a snapshot. The fresh level reports are [L7](../fix51-verify/L7.json), [L8](../fix51-verify/L8.json), [L9](../fix51-verify/L9.json), [L10](../fix51-verify/L10.json). This README and those files describe this lane; scoped acceptance generation drops unrelated stale-source levels from the shared index, so the global index/tracker were restored instead of committing that unrelated loss. No performance result was rewritten.

## Game change and G-13

Only `src/sim/npc/Npcs.ts` changed in game source (`f90bdfe7b`). L7 actor20 is the corgi, excluded from the human-follower acceptance sample. Extra route clearance and full-speed tiny waypoints made it circle behind the final corridor. L7 companions now reuse the existing L3 body-clear route/escape behavior and bounded waypoint velocity. Existing L3 behavior is preserved. Main's fix54-b work was checked before editing; it did not own this movement branch. No teleport, population/cap/timer, protection or acceptance-target change was made.

[Final trace](G-13-L7-final.json): low/high corgi departure median speed 4.4822/4.4977 m/s against about4.6 m/s group pace; ratios0.9744/0.978. Max lag13.73/10.20m; longest far stationary interval4/60 and5/60s. Canonical controls match. Human pace still misses95%: low actor58 ratio0.835516, high actor54 ratio0.942937. Cap-only, lead, side-offset and human-route trials were rejected and recorded; the failed trials were not adopted. L7-09 additionally needs bar/pose/pressing-crowd visual qualification. G-13 is not closed by fixing the frozen corgi alone.

## L10-11

[Current decision](rows/L10-11.json), [arrival boundary proof](L10-11-boundaries.json), [hold proof](../fix51-r10c/l10-hold-proof.json): all26 current native clauses PASS. Full hold240s, active peaks95/190, bounded reach100%, competent windups16.37/25.99 per minute. The same persistent Mega walks into the arena after142.2667/139.9667s; zero scheduled replacements/relocations. Inclusive120–160s was already authorized in the source criterion;119.99/160.01 fail,120/160 pass, missing arrival remains NOT CHECKED on both tiers. No target was relaxed here.

Historical PO failure remains open. Actual inherited-Resume physical continuation reaches charge, kills Mega, releases cure and finishes, but photographed postcharge objective distances are767m low/830m high. Those inherited saves do not establish the canonical walking-arrival clause or justify physical PO closure. The high continuation also has no visible corgi body despite its HUD. The top-level `L10-11.json` is an earlier pre-fix receipt; use `rows/L10-11.json` and the final hold proof for current decisions.

## Newly qualified coverage

| Row | Result and scope |
| --- | --- |
| L7-03 | Actual Shift+LMB rockets on both tiers:25tick cadence=2.4/s, overlapping flight, clicked empty ground hit within0.1m,24/24 ordinary60HP targets killed by one rocket, three-metre gap traversed. Pointblank peak13/14/16/18tick images retain ground/courier without whiteout. Controlled horde arena, frozen AI, protected courier; no normal-route pressure claim. Six faulty receipts rejected. |
| L8-05 | Real canonical bites/combat cover victim categories; explicit breach fixture bites all4 staff and all5 animal species, preserving same ID/species and2.5–3.5s conversion. Alpha/cap clauses also pass. The earlier zero-staff-hit FAIL was a checker error: production `outbreak.bite` had been omitted. [Correction](L8-05-checker-correction.json) preserves the rejected result; six fault controls reject missing bite, wrong species/ID and timing violations. Targets/caps unchanged. |
| L8-07 | Every enclosure has distinct north/south body-clear paths at1.25m radius (2.5m width), constrained interior approach, actual6m gate crossing and outside route to fixed APC marker, both tiers. Full gate-slab negative invalidates crossing. Any occupied centre adjustment≤3m is recorded. |
| L10-02 | Introduction90s, roar+impact on same persistent ID,119m separation,154m complete body-clear route with full colliders. Explicit six-clause negative controls. Resident navigation alone had excluded the distant boss; independent full-source query is recorded, not presented as an unchanged resident query. |
| L10-03 | All regional population/species/Alpha/group clauses pass86 checks. Fresh native dog-fringe proof: pistol3497, first dog4950, zero premature births. |
| L10-04 | All7 regions both tiers: actual player windups meet2/4 per minute and bounded reach≥90%; source-bound control matches. Historical PO FAIL remains. |
| L10-05 | Four exact ordinary checkpoint acquisitions; inventory-only Resume forks create no extra population or birth differences over4s. |
| L10-06 | Eight mechanics plus four reviewed visual clauses pass.43 captures show living tan slim-legged infected dog distinct from orange/white backpack corgi at zoom0.5/1.5 both tiers. Some high frames overlap crowds; no all-frames unobstructed visibility or wound detail claim. |
| L10-09 | Two actual research/cure continuations,68 reviewed captures: subtitles state airborne, not vaccine, healthy-safe, kills infected humans/animals, never reverses, regional dispersal; attached backpack canister uses no weapon slot. Native unchanged-racks/cardinal movement/death-and-cure restore checks complete8 clauses. Low truck/fire frame fully occludes courier; high inherited save has corgi far behind. |
| L10-11 | Native full assault/arrival coverage as above; PO closure remains. |

## Measured failures

| Row | Evidence and next action |
| --- | --- |
| L7-09 / G-13 | Human minima83.55% low and94.29% high against95%. Corgi fix is valid; human pace needs a separately qualified movement fix and bar/pose review. |
| L9-03 | Six actual physical drives completed. Low road at zoom1.5 has127.9833s without visible threat (target≤60s); low country43.2667, shortcut24.4167; high road17.5333, country38.3, shortcut24.2833. Low road zoom0.5 extra run32.8 passes. Preserve the max-zoom failure; route stalled at(82,-329.3) then recovered. Completed qualified gaps now correctly FAIL, unfinished runs stay NOT CHECKED; boundary proof59.99/60 PASS,60.01 FAIL. |
| L10-07 | [Continuous actual pursuit trace](L10-pursuit.json): ordinary far/coarse cruise median0.805×run low/0.777 high, beyond0.7±2%; detailed cruise0.7. Explicit far-hidden multipliers1.15/1.11 cause the excess. Same ID, no relocation,1830/1988 moving no-LOS samples and cue intervals20–34.1s pass. Removing the boost is coupled to the newly passing arena-arrival timing and needs both routes requalified. |
| L10-08 | [Production View capability](L10-camera.json): road base1.3×rocket zoom2=2.6, exceeds2.0; pistol max1.95 and finale/corridor2 pass. Actual renderer camera methods, both quality labels; represents permitted backtracking with the later rocket, not a physically executed backtrack. Fix combined camera clamp and review scene framing; no target change. |

## Rows still NOT CHECKED

The native/physical parts executed are retained even when a whole row cannot pass. No still photo is treated as a timing, latency or motion proof.

| Row | Executed evidence; remaining work |
| --- | --- |
| L7-01 | Native3m launcher placement and physical approach/pickup; pickup/first-shot≤50ms gate intentionally excluded by no-perf brief. |
| L7-06 | Physical guided road traversal both tiers; independent second route, wrong-turn bounds and misleading slab survey incomplete. P: PO specifically assess “This street feels like a trap” on both routes. |
| L7-08 | Native initial60/120 regulars+2 Alphas and real blast28/25; high24 native survivors cross previously blasted area, low physical human300 crosses corridor. Exact blast-opened gap linkage/full blocked cross-section not qualified. |
| L7-11 | Actual low departure15977→16517=9s and passenger proxy moves117.95m; native bus duration/displacement pass. Need uninterrupted both-tier bus/skyline/truck/gore/map-edge review. P: truck is lit, gore reads as blood, skyline shrinks, no map edge. |
| L7-12 | Charred street/wreck/fire and humanoid Alpha photos reviewed; numeric3:1 contrast unmeasured. P: “worst destruction so far” and human Alpha silhouettes. |
| L8-01 | Actual low carried L7 roster13humans+corgi, fullHP, six weapons, selected rocket and no pickup pass. Two high APC destruction attempts hit bounded600s context limit; no successful high handover audit. |
| L8-02 | Native3599tick calm both policies/tiers; physical low full60s no objective/pin/combat. Failed high attempt lacks flushed calm ledger. |
| L8-03 | Census4staff and all human/animal minima measured. Long translation pauses do not prove animation idle; outside-wall penetration and animation-routine challenge not completed. |
| L8-04 | Four outlets,≥20m pair spacing,6/3 initial packets, start3600tick pass. Last visible admission46/77ticks is not a proven breach-start violation; need rendered pop-in review. |
| L8-08 | Actual sanctuary/battle photos reviewed; lion snarl/wounds, clean zebra legs at PO zooms and numeric player readability not qualified. P: visible infection/wounds and zebra legs at0.5/1.5. |
| L8-09 | Native all living IDs seated; actual high boarding fails earlier. Missing-survivor guidance and no-gun rendered APC review incomplete. |
| L8-10 | Actual low L9 loading only; high handover failed. Same APC durability/identity and≤6s loading not qualified. Existing handover wrapper invokes tools/perf, excluded by brief. |
| L8-11 | Sanctuary and mixed battle images seen. P: exact PO “is it stunning?” judgment remains. |
| L9-01 | Native first drive tick0/first motion2ticks pass; carried roster/durability and physical corgi/rider geometry incomplete. Side-cab knee/foot photos need geometry review. |
| L9-02 | Eleven authored main group censuses and25–40m detour clearance pass; actual camera route population not fully counted. Nearby wanderers are separate from main-group detour criterion. |
| L9-04 | Native unique contact-onset−10 billing, road1000HP vs shortcut830/810 and damage checks; physical surround windup trajectory/HUD not qualified. |
| L9-05 | Explicit production maxHP-damage fixture drives1498m at0HP, smoke policy set, native road0.6/rough0.4 composed cap. Actual terminal speed and heavy rendered smoke not qualified. |
| L9-06 | Native routes finish; actual low road20s turn stall recovers. Exhaustive off-road wedge challenge, no giant arrow and durability HUD match remain. |
| L9-07 | Full and zeroHP native crashes exactly once; wreck objective on impact tick. Actual whole hull/wheels/fire stills reviewed, uninterrupted fall not established. |
| L9-09 | Native detailed chunks9/25 caps pass. Actual driving photos inspected;≤2cm seams and no input freeze not measured. |
| L10-12 | Direct9/10 rocket and90% conventional floor native fixtures pass. Actual both-tier fights kill boss;70 captures show readable purple Mega during combat; two source-bound physical clauses are now ingested into the level report. Three high hit/navigation warnings recover. Attack-range trajectories, creature-shaped corpse and≤200ms frame gate remain; no perf work. |
| L10-14 | Actual both-tier endings finish with title/closing sentence, camera pullback, mist patches and start menu. High whole epilogue9000ticks=150s; low resumes at91s then3513ticks. Four partial ending/counter clauses are ingested into the level report; the whole row remains unchecked. Native species mortality/healthy immunity and10m/s front checks pass separately. Physical per-species one-tick ledger, epilogue movement challenge and numeric pullback-start remain; protected courier survival is not immunity. High corgi body missing; low visibly alive. |

## Evidence and validation

Headless shared-pool Metal WebGL2 only,≤2 owned contexts, bounded reservations, unique preview ports; no3300 server, push, deploy or performance timing. Resume seeds and exact compressed logs are retained. All516 generated captures were personally viewed in unscaled labelled sheets; per-capture `seen` notes describe the scene and limits. Raw owned images were SHA256-checked then deleted; `capture-cleanup-*.json` records deletions. Earlier unsuccessful rocket iterations remain reviewed historical evidence, not current qualification. Actual L10 slices use inherited saves and a protected courier; they do not prove ordinary survivability.

Final game source `2965448be995b55a14a860818a00166d2b245ea20cb1582109735b797dca8ef3`; observer `d670b5f6ea8dfd19759dbac228488c9fe988422b1866480ea8f6eef07dbd0c71`; browser `4d66b85d78be7ce4b6381e3fe16b85c932f184fa102d0afe4a773aefa9d002f9`. All16 native L7–L10 tier/policy cells, fixtures and checkpoints were remeasured after the game change. Final scoped `qa:accept -- --level L7|L8|L9|L10 --reuse --skip-browser` completed; each exit1 preserves current/historical FAIL, rather than indicating a crashed check. No receipt was admitted by changing a target.

Final gates and evidence audit are in [validation.json](validation.json). TypeScript, lint,107 unit tests and E29/E30/E31/E32 verification passed. `qa:threat` ran alone on the final game source:389.3s audit,391.4s budget accounting, **zero fail flags**. It predates the last QA-only receipt tools; final TypeScript/lint/unit gates were rerun after those edits. Specs, protected references and performance sources/results were not changed.
