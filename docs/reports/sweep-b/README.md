# sweep-b — L5 corgi P1 and L4–L6 acceptance

Base: `1ae35ca575aa5c7a450695c99ccaf270eaffe91f`. Current game-source SHA-256: `aec13daf090fd1d27a23e0e5ca5469729cc461885d10a55fafa2feeb4c937f2d`.

**P1 fixed and qualified. Of the 37 assigned acceptance rows, 30 have current verdicts: 16 PASS and 14 measured FAIL. Seven remain open. The full sweep goal is incomplete.** The original [work list](work-list.json) and [current row summary](row-summary.json) preserve the exact scope. PASS rows with a P prompt still require the stated PO taste review.

## Corgi P1

- `3c2522b`: discard obsolete solid-contact history when courage hiding ends. The fault control reproduces a 10 m rollback; the production recovery moves about 0.000222 m. A historical physical trace independently shows a 22.14 m hide→follow jump. [Recovery proof](corgi/recovery-proof.json).
- `c8b0484`: use the existing follower motion response for L5 corgi travel/braking; use the actual actor footprint for braking. An ordinary response reversing an 8 m/s dog carries it 5.70 m in the old direction; the existing follower response reduces this to 2.70 m. No movement-speed, population, timer, cap or acceptance target changed.
- `4321c37`: qualify the final eight physical cells and native controls. A speculative fixed-destination flow explanation was rejected and reverted: the shared field normally tracks the courier.

All eight physical cells satisfy the unchanged ≥95% within-6 m proximity check over both the fixed first 180 simulated seconds and the whole observed route. No sustained >10 m run occurs. Five routes complete; the three unfinished driver diagnostics remain explicitly unfinished. Both qualities have completed physical routes. These runs use physical WASD/mouse/E, progressed saves, a protected courier and mortal followers; they do not establish a mortal human protection benchmark.

| Backend | Tier | Zoom | Within 6 m, full | First 180 s | Maximum | Completed |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Metal WebGL2 | high | 0.5 | 100% | 100% | 5.465 m | no |
| Metal WebGL2 | high | 1.5 | 97.92% | 96.67% | 9.333 m | yes |
| Metal WebGL2 | low | 0.5 | 97.65% | 97.78% | 8.420 m | no |
| Metal WebGL2 | low | 1.5 | 100% | 100% | 4.285 m | yes |
| WebGPU | high | 0.5 | 99.04% | 98.61% | 7.875 m | no |
| WebGPU | high | 1.5 | 100% | 100% | 5.555 m | yes |
| WebGPU | low | 0.5 | 100% | 100% | 5.954 m | yes |
| WebGPU | low | 1.5 | 99.66% | 99.44% | 7.151 m | yes |

[Physical matrix](corgi/physical-matrix.json), [260-frame final capture review](corgi/physical-capture-review.json), [native routes](corgi/native-routes.json). Native final-state hashes equal the fresh canonical receipts: low `41e92b1f`, high `5493dad2`. Native low/high first-180 proximity is 99.17%/100% and maximum separation 8.02/4.70 m.

Rejected intermediates remain distinct: diagnostic A fails low at 93.15%; recovery-only B still fails low at 93.87%. All 147 intermediate captures were inspected and deleted after hashing: [A](corgi/diagnostic-a-capture-review.json), [B](corgi/recovery-b-capture-review.json). The intermediate B metro heap is historical evidence, not a current-source verdict.

## Rows with current verdicts

Each row has its own verdict commit and exact-criterion review in `docs/qa/reviews/`. A numeric counterexample closes FAIL without qualifying its unmeasured clauses. The three level reports were regenerated through `qa:accept`; shared all-level indexes were restored because a single-level invocation truncates them.

| Row | Verdict | Verdict commit | Evidence / observation |
| --- | --- | --- | --- |
| L4-02 | PASS | `838cde8` | [Reception](L4-02-proof.json): actual low32/high64 civilians, calm routines, no combat/infected/decals, ≥0.7 m separation. Existing corrected target low30/high40 retained. |
| L4-03 | PASS | `bfea27a` | [Pickup/alarm](L4-03-proof.json): four physical cells, actual positive-gain klaxon and turn/admission ticks; 28 missing/delayed controls reject PASS. |
| L4-05 | FAIL | `c041d83` | [Street cohorts](L4-05-proof.json): actual one-body same-source admissions at both tiers, below 2–5; canonical native hashes unchanged. |
| L4-06 | FAIL | `c588315` | [Review](../../qa/reviews/L4-06.json): low first breach at52.72 s has58 living infected, below60. Sustained post45 s plaza count passes. |
| L4-07 | FAIL | `e68096d` | [Review](../../qa/reviews/L4-07.json): high complete bounded-path minimum89.19%, below90%; passive pressure clocks pass. |
| L4-08 | PASS | `eaf9203` | [Alphas](L4-08-proof.json): six/eight actual staggered offscreen admissions, ≥6 directions, three/six actual line attackers. |
| L4-11 | FAIL | `3c715f7` | [Live duels](L4-11-proof.json): courier survives all12 duels, but frontal first-damage→incapacitation takes9.4 s at20 m and12.7 s at26 m, above6 s. |
| L4-12 | FAIL | `4836e53` | [Review](../../qa/reviews/L4-12.json): actual nearest20 high-tier sample at tick5820 has only three infected looks. |
| L4-13 | FAIL | `1b2195c` | [Actual admissions](L4-13-proof.json): first nine-second collapse interval admits low0/0/0 against2/edge, high1/1/1 against3/edge; both canonical hashes unchanged. Escape-window and pursuer identities retained without blanket qualification. |
| L4-14 | PASS | `c8cb782` | [Live damage](L4-14-proof.json): actual cellar entry has4 fires,3 burning/burned vehicle IDs,14 windows and21 renderer scorch instances at both tiers. Legacy controller scorch0 is not the renderer census. |
| L4-15 | PASS | `6e755c8` | [Solidity/camera](L4-15-proof.json): all60 wall segments block actual capsule sweeps at each tier; positive diagonal camera offsets bound all blends to36–41.85°. Reviewed textured/readable structures and continuing terrain. |
| L4-16 | FAIL | `6d7f068` | [Review](../../qa/reviews/L4-16.json): low zoom1.5 decoded filtered battle is audible for5.55 simulated seconds, below6; the other physical cells exceed6. Same-cellar handover and entrants recorded. |
| L4-17 | FAIL | `ce20555` | [Corpse layout](L4-17-proof.json): actual render-layout root lifts reach1.76 m low /2.86 m high, exceeding the ~1 m pile limit before body thickness. |
| L4-18 | PASS + P | `f5a14d6` | [Frames](L4-18-proof.json): clean living plaza and readable battle courier reviewed. Huge mixed war remains a PO question. |
| L5-02 | PASS | `bbd9c21` | [Opening](L5-02-proof.json): emergence99→objective699 is10 s; actual running score starts after first rescue; no allied fighters/shots or moving vehicles in first60 s. Unarmed rescued Mia is allowed by E23-AC04. |
| L5-03 | PASS | `7fd82bc` | [Census](L5-census.json): actual100/150 initial IDs and transforms, max accepted cohort2, all8 row and11 column street bands populated. `5203fa9` adds explicit producer types. |
| L5-05 | PASS + P | `3bc507a` | [Measured clauses](rows/L5-05.json): full-path100%,4.588/7.758 encounters per40 m,3.166/4.188 player windups/min. Rescue-pressure feel remains P. |
| L5-08 | FAIL | `25165a0` | [Review](../../qa/reviews/L5-08.json): follower28 in-band94.70% low /91.57% high, below95%; low also fails pace. Combat pace/all bar pixels remain unqualified. |
| L5-11 | PASS | `68a6f4a` | [Fog/bus](L5-11-proof.json): coloured opaque heroine and readable zoom1.5 bus shell/caption at both tiers; no caption-only discovery claim. |
| L5-12 | FAIL | `63aabdf` | [Metro view](L5-12-proof.json): at most19 of24 station residents submitted during the intended view, below20; every reviewed second remains exterior stairs/canopy. |
| L5-14 | PASS + P | `b3d44e1` | [Pairs/sunset](L5-14-proof.json): four exact matched L4/L5 pairs per tier; actual renderer sun drops44.90%, above30%. Same place, fallen remains P. |
| L6-01 | FAIL | `7ca5022` | [Actual handover](L6-01-proof.json): real physical L5 saves carry24 identical/full-HP residents, but all retain idle/gesture clips and stand on tracks outside the furnished shelter. Preset-only review misses this defect. |
| L6-02 | PASS | `c8689cd` | [Headlamp](L6-02-proof.json): fixed until approach, E-free collection, no new weapons; drawn head and beam agree under opposed movement/aim. |
| L6-04 | PASS | `f277744` | [Breach/power](L6-04-proof.json): second breach21.02 s later, ten actual arrivals/two accesses; main off/emergency on at the same tick; abandon14.9 s later with three bitten/lost. |
| L6-05 | PASS | `9771a75` | [Trajectories](L6-trajectory-proof.json): actual floor admissions/path100%, first attacks1.62/6.27 s after breaches,5.01 competent windups/min. Nominal rail Y is not a floating-spawn failure. |
| L6-06 | FAIL | `f322429` | [Trajectories](L6-trajectory-proof.json): three actual bodies from each six side entries, target two. All18 reach track floor; no target/count changed. |
| L6-07 | PASS | `dfafd90` | [Review](../../qa/reviews/L6-07.json): full retreat51.07 player windups/min,120 HP lost, peak18 within cap. |
| L6-09 | PASS | `bfbf482` | [Gates](L6-09-proof.json): all six tier/gate cells block closed movement/sight, hold five runners9.82 s; actual2 m refusal and persistent fixed ring/prompt boundaries exercised. |
| L6-11 | FAIL | `0dbc9a9` | [Matched policies](protection.json): ordinary mortal complete saves1/29=3.45%, below60%; evade-only times out, not an invented result. |
| L6-12 | FAIL | `7d5bce4` | [Northgate](L6-12-proof.json): actual closed blocker spans y0–2.5 below raised exit; production Rapier courier capsule crosses all6 m. Closed visual leaf/night caption separately inspected. |

The `7f0a5c5` report fix has an actual [before/after receipt](review-fail-proof.json): fresh measured FAIL reviews on plain S rows were previously ignored. PASS still requires complete objective evidence; no blanket manual-PASS route was introduced. No specs or acceptance targets changed.

## Seven rows still open

| Row | What is established | Remaining NEXT |
| --- | --- | --- |
| L4-10 | Two actual HMG shooters; tank enters+22 s, actual intervals8–12 s; protected soldier/armed-ally impact clearance≥15 m; helicopter orbit/withdraw ledger. | Observe actual rendered tank muzzle/tracer endpoints against the current barrier wall, not a guessed 2D ray or a fallback muzzle. |
| L5-06 | Physical caption/edge-call/radar examples; authored/native cue range≤25 m. | Complete no-hidden-ring/arrow/pin inspection and synchronize actual audible call windows with ♪ visibility at both tiers, including >30 m exclusion. |
| L5-07 | Authored-map tours complete some routes. | Genuine muted screenshot-only discovery, recording every cue read; no coordinates, minimap targets or authored destinations. Existing tours explicitly do not qualify. |
| L5-09 | Mortal native complete rescues5; [extended contact ledger](L5-09-contact-partial.json) records1,200 s per tier without a terminal evade result; observed uninterrupted bites fit1.5 s. | First actual reach→bite timestamps, a valid evade-only result, and a mortal human-like protection route. Timeouts are not rescue percentages. |
| L5-10 | Source guards keep survivor-only street firearms in place; limited armed-follower images exist. | All relevant gun-in-hand poses plus a source-bound full-route pickup-ID/no-respawn ledger and actual corgi street-weapon refusal controls. |
| L6-08 | [58 individual walks](rows/L6-08-partial.json), all29 IDs at both tiers including injured: settled2.1995157–2.2000000 m/s. | Unoccluded-head controls and actual pixels for every missing bar, plus ordinary group pace. Reviewed batches still include geometric/courier occlusion; neither blanket PASS nor a false bar FAIL is claimed. |
| L6-14 | Underground courier/eye visibility reviewed qualitatively. | Actual courier/background luminance≥3:1 with defined masks and positive identification of brightest infected-eye pixels at both tiers. No subjective score substitutes for these measurements. |

These gaps remain work, not a human-only blocker. The original ~3-hour handoff was incomplete; the active goal explicitly resumed work afterward.

## PO questions retained exactly

- **L4-11:** PO: does firing at a riot infected feel effective? Review the perceived hit feedback only; HP chips, recoil, TTK, bars and the full-health duel retain objective checks.
- **L4-18:** PO: do the war frames read as a huge mixed war? Use the reviewed battle captures; player readability remains an objective inspection.
- **L5-05:** PO: can a competent player still just walk, pick up the survivors and walk away? Review perceived rescue pressure only.
- **L5-14:** PO: do matched L4/L5 views read as the same place, fallen? Sun intensity reduction remains a numeric clause.

## Capture and method audit

All1,011 captures generated by this lane were inspected, hashed and deleted after review. Numbered sheets remain only under ignored `test-results/`; no evidence images are committed. Digests and explicit observations are retained in the capture-review JSONs, including rejected setups. A final search finds zero own raw JPEGs under capture directories.

Physical sweep reviews: [L4:151](L4-capture-review.json), [L5:126](L5-capture-review.json), [L6:185](L6-capture-review.json). Supplements: [L4 current render](L4-render-capture-review.json), [L5 current render](L5-render-capture-review.json), [L6 current render](L6-render-capture-review.json), [actual carried L6 opening](L6-carry-capture-review.json), [matched city pairs](pairs-capture-review.json). Initial Scene Lab setups with unverified initial tier/inherited protection or suspended/muted audio were rejected, inspected and retained separately; corrected L5 opening assertions verify actual100/150 census, protection=false and running/unmuted/unlocked audio. Executed producer source archives preserve exact pre-type-annotation SHA-256 where later optional-field/type-only corrections were needed.

The later L5 low zoom1.5 physical sweep hits an observer race after the production L6 handover: a stale L5 read accesses missing `phase`. Its prefix is retained as partial, not a game crash or full-route console PASS. Of that later matrix, only high zoom1.5 supplies an intact completed receipt; zoom0.5 drivers remain unfinished. This is separate from the completed P1 matrix.

All browser work is headless through the shared pool, at most two owned contexts, leases under10 minutes, private ports, and no3300 server. No performance work, push or deployment. The requested slim-worktree step succeeded after unrestricted execution became available. No reference/spec/art edits or dependency additions.

## Final validation

- `npx tsc --noEmit`: **PASS**, final log has no diagnostics.
- `npm run lint`: **PASS**, zero diagnostics.
- `npm test -- --maxWorkers=1`: **107 passed /27 files**,135.5 s including collection, unchanged150/150-case and43/45-file budget. The worker cap is1. Earlier concurrent four-worker timeout evidence is retained; isolated and repeated full one-worker runs pass.
- `npm run qa:accept -- --level L4|L5|L6 --reuse --skip-browser`: whole group refreshed at both tiers on the current source, reusing the fresh canonical native/fixture/checkpoint receipts and current scoped browser evidence. Nonzero exits reflect the retained measured FAIL/NOT CHECKED rows; checkpoint controls agree and fixture errors are zero.
- `npm run qa:threat`: **FAIL — full gate not qualified**. Two unchanged zero-flag attempts ran alone within this lane. Attempt1 returned watchdog exit124 at601.6 s during L4 high-tier hold; attempt2 returned exit124 at601.0 s. Unrelated lanes continued native acceptance/browser jobs; no quiet-machine or contention-causality claim is made. No flags, budgets or criteria were changed.

All69 file references in the30 current verdict reviews match their recorded SHA-256: [evidence audit](review-evidence-audit.json). Final commands, outcomes, native control hashes and original log digests are retained in [validation manifest](validation.json) and its [compressed log archive](validation-logs.json.gz). No owned check remains running at handoff. The original gate receipts describe the time-box handoff; the continuation below records later work. The seven open rows above remain unqualified.

## Goal continuation

L4-13 closed FAIL after the original handoff using actual per-edge admissions and two canonical-hash controls. No game changes. Typecheck and lint pass for the new producer; refreshed L4 acceptance reports8 FAIL/1 NOT CHECKED with fixture/checkpoint errors0. [Continuation receipt](continuation-L4-13.json) retains original logs and SHA-256 digests. Previous threat timeout remains unqualified; it was not rerun concurrently with row work.
