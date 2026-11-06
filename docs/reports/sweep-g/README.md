# sweep-g — global acceptance sweep

**Continuation:** G-25 persistence fix implemented after the first handoff; native browser quota/Settings/reload proof now passes with zero errors, and fresh whole-group qualification is in progress. The status table and gate archive below describe the prior `9ac18b3e…` source until the new matrix completes. [Lossless failing-save proof](G-25-save-codec-proof.json) preserves both snapshots and all entities/seams.

**NO-GO: open failures and incomplete coverage remain.** This is the bounded sweep requested for G-06–G-26, based on `f807c966c610489eb1f8fb4182f164485bd5dc87`. Every assigned row was investigated; a partial fixture is never a whole-row PASS. G-01–G-05 performance and G-27 are outside this brief. Nothing was pushed or deployed.

The unchanged starting criteria and concrete NEXT actions are preserved in [scope.json](scope.json). The canonical final statuses are in [the acceptance tracker](../../qa/acceptance-status.md) and [global.json](../fix51-verify/global.json). Individual row commits retain the progression and rejected evidence.

## Results

| Row | Result | Evidence and remaining work |
|---|---|---|
| G-06 | NOT CHECKED | [Physical figure/vehicle audit](G-06-route-coverage.json). All saved frames reviewed; suspected fence, fire-engine, corgi and APC views reopened at original size. Requested zoom differs from actual zoom during scripted transitions; two L6 low exit frames are black. Every vehicle transition and occluder pose is not covered. PO items below. |
| G-07 | NOT CHECKED | [Critical fixtures](G-07-critical.json), [12 reviewed frames](G-07-critical-captures.json): L7 perimeter, L2 fire engine and L8 canopy, low/high, zoom0.5/1.5, WebGPU. Heroine visible in every fixture. Physical near-camera fence/horde/corpse coverage across all critical poses remains incomplete. |
| G-08 | NOT CHECKED; game fix | [Diagnosis and before/after proof](G-08-diagnosis.json), [route observations](G-08-route-observations.json). Removed the active L4 cellar route pin and routed distance; low/high now display actual destination 79m instead of 315–318m. Other sampled marker/HUD discrepancies need same-frame comparison with authored action points and cinematic clocks. |
| G-09 | FAIL | [Review](../../qa/reviews/G-09.json), [marker fixture](G-09-marker.json). L4 hold explicitly suppresses its ring (`waypoint=false`), beyond 2s at low/high and zoom1/1.5. Confirmed in the physical hold route. Authored suppression needs reconciliation before changing guidance. Other objective starts remain incomplete. |
| G-10 | PASS retained | [Fresh fixture archive](G-10-native-refresh.json.gz): 22 passing checks in 20 level/quality fixture receipts. Baseline was already PASS; this is a refresh, not a new visual closure. |
| G-11 | PASS | [Review](../../qa/reviews/G-11.json): four backend/quality pickup fixtures, eight full-size frames. Survivor-only handgun has no ring; one collection,5.796m away and return, no respawn. Whole-group native duplicate and persistence checks refreshed. |
| G-12 | PASS | [Review](../../qa/reviews/G-12.json):140 group-size/identity samples across1–35 followers and four backend/quality cells,17 inspected captures including a negative control. Compact pips at35/6; full bars at5/1. Native L7 fixture refreshed. |
| G-13 | FAIL | [Diagnosis](G-13-diagnosis.json), [review](../../qa/reviews/G-13.json). High Dale search pace93.59%, metro94.58%; low passes. Exact intentional far-follower waiting0.748% low,0% high. A pace-floor trial worsened high to88.43% and caused Mia to turn in both tiers; [trial reverted](G13-after/REJECTED.json). Final-source native rerun confirms original medians. Requires coupled escort tuning. |
| G-14 | FAIL | [Review](../../qa/reviews/G-14.json), [lifetime intervals](G-14-route-observations.json). No sampled permanent-corpse ID loss, including sleeping chunks; interval totals are not globally unique body counts. Controlled pile/persistence frames show raised floating bodies and detached geometry. Actual physical L10 cure epilogue confirms pointed/folded corpse geometry. Root layout metrics do not qualify rendered support. Requires renderer/asset diagnosis. |
| G-15 | FAIL | [Review](../../qa/reviews/G-15.json): six physical WASD/mouse bat/handgun/rocket cells,30 inspected frames. No click-to-move; attack aim correct. Pointer grace ends, yet rendered facing remains71.1° off travel0.767s after release. Native heading and rendered bounded turn differ; no speculative turn-rate change. Invalid fixture attempts are retained separately. |
| G-16 | PASS retained | [Fresh loadout archive](G-16-native-refresh.json.gz): all 10 level reports, both qualities and native policies; L10 offers exactly axe. Baseline was already PASS. |
| G-17 | FAIL | [Summary](G-17-summary.json), [review](../../qa/reviews/G-17.json).110 strips/880 frames inspected: identity-matched aftermath civilian-woman-b wander shows splayed near-horizontal legs. All seven actual L10 runner variants captured in wander/chase after correcting fixture identity; original substitutions/rejections retained and excluded. Crawler42° exemption and missing variants remain open. No asset/bake guess committed. |
| G-18 | FAIL (continuation) | [520 controlled contact cases](G-18-summary.json): all interrupt scripted travel,430 actual attack windups within240 fixture ticks. Nurse/screamer support behavior and some L9 escorts are scoped explicitly. [300 added party/focus cases](G-18-party-summary.json) expose eight paired finite-focus counterexamples: ordinary complete-rush attacks the nearby escort, while courier focus ignores it and walks away. A fresh exact-criterion FAIL review records this without changing AI. Corgi notice redirects to courier, preserving dog immunity; four Alpha notice cases and broader armed-ally coverage remain explicitly unqualified. |
| G-19 | NOT CHECKED | [Summary](G-19-summary.json):44 initial and14 corrected APC frames inspected. Dog has no HP bar, remains HP100, is inside shutter, hides aboard APC, emerges/rejoins outside. Corrected fixture uses actual rear entry; failed driver-door setup retained. Whole-campaign closure and vehicle hull-clearance coverage remains incomplete. |
| G-20 | FAIL | [Review](../../qa/reviews/G-20.json):14 controlled final edges give300 protected ticks; L7/L9 in both tiers transition immediately with a live chaser and no protection. Source has explicit exceptions. L5 fixture cap rejection retained. Natural completion at every edge remains incomplete; changing endings requires contract review. |
| G-21 | NOT CHECKED | [96 checkpoint deaths and20 controls](G-21-checkpoints.json): all pass authored restoration contracts, control hashes match, zero errors. Global snapshot wording conflicts with explicit L1/E19 live-world preservation and L4/E22-AC17 live-battlefield exceptions. Specs untouched; wording needs reconciliation, not a fabricated game failure. |
| G-22 | FAIL | [Review](../../qa/reviews/G-22.json): final-source L3 low station0 first attack24.983s; low/high station2 no attack. High stationary station1 first30.983s. Historical read-only trace matches native state/medians;92/92 bounded path samples≤2.5×direct. Attack competition/recovery and late cohorts explain why a bounded path alone does not meet20s. Encounter tuning remains open. |
| G-23 | NOT CHECKED | [Boundary summary](G-23-bounds-summary.json): production pedestrian/sedan collision approaches across all 10 levels, zero fixture failures. Physical wrong-way traversal and screenshot-only route clarity at both qualities/zooms remain incomplete. L7 outer ground and L10 sparse road stretches are PO presentation items. |
| G-24 | PASS | [Review](../../qa/reviews/G-24.json): four backend/quality cells×five states,20 inspected captures. Alpha and five zoo species have full nearby bars, no far healthy bars, half bars when damaged far away, none dead; normal animals have none. Native L8 fixture refreshed. |
| G-25 | OPEN (current NOT CHECKED; historical FAIL retained) | [20-cell matrix](G-25-console-matrix.json):19 complete clean routes; L10 high retry reached cure release and 137s epilogue, then [production-save restore exceeded storage quota](G-25-L10-high-quota.json). Original L4 mortal/settings crash not reproduced. No save trimming or quota override. |
| G-26 | FAIL | [Review](../../qa/reviews/G-26.json):141 baked LOD height rows match adult heroine1.454m, but low/high coffee-holder close view separates cap above head. Zoo bag-holder has pointed body/arm triangles.28 frames inspected; full every-body/routine visual matrix remains incomplete. Requires accessory/pose diagnosis. |

**First-handoff totals (before the G-18 continuation finding):** evidence qualified 5 PASS, 8 FAIL and 8 NOT CHECKED rows. The tracker shows 5 PASS, 9 FAIL and 7 NOT CHECKED because it correctly retains the historical G-25 FAIL until complete requalification. Newly qualified passes are G-11/G-12/G-24; G-10/G-16 were already PASS.

PASS means the current acceptance tooling qualifies the row; a FAIL counterexample remains valid even when broader coverage is unfinished. NOT CHECKED identifies the specific missing evidence or contract decision. Counts, timers, caps, source criteria and targets were not reduced.

## Console qualification and game change

The original priority was L4 mortal high: destroyed `ShadowDepthTexture` submission, renderer clear before initialization and a frozen world. Current-source physical L4 low/high completed through the cellar into L5 with zero console/page errors and no objective skips. [Mortal high](G-25-L4-high-mortal.json) completed with 10 deaths/respawns and zero errors; that is driver telemetry, not a difficulty sign-off. [Ordinary settings switches](G-25-quality-verified.json) repeatedly changed high→low→high, verified2048/1024 shadow maps and advancing simulation/render, with zero errors. No crash fix was invented when current production lighting already safely recreates its shadow maps.

The sole game change is [Hud.ts](../../../src/ui/Hud.ts), commit `ff10a70`: active L4 cellar guidance displays the destination without a route pin. Original console probes used source `095bc361d821ac6fdee29abb0e98d7a28b49c3a4e4d7e5ce335ae5d622099944`; final whole-group receipts use source `9ac18b3e82399d0b44afa2b2f506dd2d483a8dee4f4a91fc5ea4830e34b8410c`. [Build manifests](build-final.json) record actual source identity; their revision predates the later commit and is not relabelled.

Final physical matrix: headless WebGL2, low/high, all 10 levels, real WASD/mouse, no objective skips, no performance timing. These full routes use survival protection, explicitly reported as `immortal:true`. L10 uses real production checkpoint saves and ordinary Resume across bounded browser reservations; merge validation requires matching source/browser/tier and exact save-hash continuity. Completion does not certify mortal difficulty or every zoom/pose.

The first L10 high branch stopped at research campus with90s no progress, dense enemies, continuing simulation/render and zero console errors. It remains [incomplete evidence](G-25-audited-L10-high-webgl2.json). One unchanged-driver retry continued the same successful first production-save interval; it is kept separately and never erases the failed branch. It reached cure release and 137s of the 150s epilogue. The next context could not restore the unmodified 6,152,854-byte production campaign (`QuotaExceededError`). Both current/checkpoint snapshots retain large entity and seam records. `SaveStore.write` catches storage failure and returns false; the browser worker encountered the same capacity boundary while restoring that exact JSON. This setup error is not mislabeled a page-console error, and G-25 remains open. A persistence-capacity fix must preserve required state and corpse history; none was guessed in this sweep.

## Reporting corrections and evidence preservation

A fresh exact-criterion manual FAIL was ignored for unregistered rows and left NOT CHECKED. [Before proof](review-report-before.json) and [after proof](review-report-after.json) support the small `report.ts` fix, commit `5668a7e`. It propagates an exact matching FAIL; PASS coverage gates remain unchanged. G-11 manual PASS without automated coverage still stays NOT CHECKED in the proof.

Whole-group reruns overwrite canonical receipts. Eleven historical evidence files referenced by existing L7/L8/L10 reviews were therefore archived byte-for-byte under [inherited-review-evidence](inherited-review-evidence). Their original SHA256 values were verified before compressing. Only evidence paths/hashes/descriptions changed; inherited reviewer decisions and commit provenance were preserved.

Read-only corpse/route observers do not write game state, inputs or RNG. Rejected fixture identities, input-harness attempts and failed route branches are retained with their limitations. No speculative game refactor, dependency or asset modification was introduced.

## PO presentation items

- **P — APC exit:** `G-19-apc/high-f320.png`, hashed in [APC capture observations](G-19-apc-captures.json): raised dark driver-door panel crosses the courier silhouette after exit. Native driver is null and courier is outside at(.71,-2.025). Judge presentation versus actual clipping.
- **P — L6 shelter:** low wide `accept-L6-shelter-t627-low-z1-5.jpg`: strong gold foreground contour makes the courier pale. Source `courierDepth` intentionally adds that contour; judge against the original pale-in-fog complaint. See [G-06 audit](G-06-route-coverage.json).
- **P — environment:** L7 dark purple ground outside the concrete wall and long sparse L10 green/blue road sections. See [critical fixture captures](G-07-critical-captures.json) and L10 capture manifests. These are not automatically placeholder-geometry failures.
- **Contract decisions:** global G-21 snapshot wording versus authored L1/L4 exceptions; G-18 companion engagement versus G-19 corgi never-targeted; literal G-17 upright lean rule versus authored crawler; G-09 survival-step guidance suppression; G-20 immediate ending exceptions.

## Validation and cleanup

[Validation receipt](validation.json) and [gate logs](gates) record the final results.

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS —107/107 tests,27 files |
| `npm run qa:threat` (zero flags, run alone) | PASS —10 levels, zero fail flags,357.9s command time |
| Whole-group acceptance consolidation | Exit1 — measured row failures and incomplete high L10; NO-GO |

A passing repository gate does not clear the separate acceptance failures. All 1,924 raw captures were inspected, hashed and deleted. The full native low/high complete/stationary, controlled fixture and checkpoint matrix was refreshed after the game change:40 native policy receipts,20 fixture cells and20 checkpoint controls/96 individual deaths, with matching source identities. Final `qa:accept -- --level all --reuse --skip-browser` consolidates these and all 20 browser cells; its exit1 is expected from measured failures and the incomplete high L10 route. Acceptance exit1 is not relabelled PASS.

Every saved raw capture was visually inspected, hashed with its observation and deleted; derived review sheets stay only in `test-results/`. [Cleanup ledger](capture-cleanup.json) and per-row capture manifests preserve provenance. No raw images are committed. No protected reference/specification directories were edited. The owned 4981 preview is stopped at handoff; foreign services are left alone.

## Handoff priorities

1. Preserve and diagnose the high L10 campaign storage-capacity failure; finish the final physical console cell afterward.
2. Fix the identity-matched corpse/leg/accessory counterexamples with renderer and bake evidence; do not infer a shared cause solely from similar triangles.
3. Tune high follower pace and announcement contact using retained individual/identity clocks, without changing targets or population.
4. Reconcile the explicit PO contract conflicts, then finish the named missing physical/visual matrices for G-06/G-07/G-08/G-18/G-19/G-21/G-23.
