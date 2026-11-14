# s112 — L4 horde browser QA

**HIGH: GO for the tested desktop hold. LOW: NO-GO for PROD under the existing L4 LOW headroom gate.** The horde presentation works at both tiers and both zooms: this is visibly a sustained mixed fight, with many ordinary infected reaching the plaza, rather than only two Alphas. LOW pays a substantial frame-time cost and changes from passing to failing the existing 11 ms L4 desktop headroom budget. No gameplay changes were made.

Candidate: `cdc046eb89127e1cdd53426e51903080eeadc795` (s110+s111). Baseline: `7b70ff4118b456b62c8a1d47aa65e6d895a61bf2` (pre-s110). Machine: Apple M4, Mac16,10, 10 cores; Chrome 157.0.8103.51, headless native WebGPU/Metal. [Compact evidence and reproducible drivers](evidence.json); [contact sheet](contact-sheet.jpg).

## Frame time

All times below are **RAF frame intervals in milliseconds**, not simulation CPU time. One full hold per revision/tier; same seed 3, driver, 1280×720, DPR 1, zoom 1, unthrottled CPU, uncapped rendering. HIGH precedes LOW for each revision. Timing uses `tools/perf/quiet-run.sh`, exclusive browser admission, admission timeout 1,200 s and reservations ≤600 s. No second lane browser was opened by this job. Quiet preflight required load <3 and no foreign headless Chrome/build/local unit test process. Baseline HIGH+LOW finished in one reservation; candidate runs used separate reservations.

| Tier / revision | p50 | p95 | p99 | Worst ≥1 s window, mean ms/frame | Window fps | Max single frame | Sampled peak living |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| HIGH pre-s110 | 9.6 | 11.6 | 13.0 | 11.33 | 88.3 | 33.3 | 59 |
| HIGH current | 11.5 | 13.5 | 15.5 | 13.67 | 73.1 | 35.3 | 83 |
| LOW pre-s110 | 7.6 | 10.1 | 11.2 | 9.47 | 105.6 | 29.8 | 52 |
| LOW current | 10.7 | 14.1 | 15.4 | 14.32 | 69.8 | 36.8 | 126 |

HIGH p95 increases **1.9 ms / 16.4%**, with peak living **+24 / 40.7%**. LOW p95 increases **4.0 ms / 39.6%**, with peak living **+74 / 142.3%**. LOW’s worst one-second mean increases 51.3%. These are single-run, same-host observations, without confidence intervals. The seed-2 simulation peaks of 91 HIGH / 107 LOW in s110 are different experiments; LOW’s seed-3 browser peak is 126, not bounded by 107.

“Worst ≥1 s window” scans every contiguous frame-aligned window, taking frames until accumulated time first reaches 1,000 ms and maximizing mean frame duration. Actual worst windows cover 1,008.0 / 1,011.9 / 1,003.6 / 1,017.0 ms in table order. Their approximate wall-clock starts after resume are 142.28 / 72.00 / 172.67 / 171.90 s. A single-frame maximum is reported separately. All RAF intervals after the first 3 s are included: 20,181 / 17,100 / 24,361 / 18,821 frames respectively. All four runs reached the actual `collapse` phase after line break, at approximately 190 s; none hit the observation timeout.

The existing `l4-storyline.ts` runs **LOW** and defines an **11 ms** desktop headroom gate. Baseline LOW passes at 10.1; current LOW fails at 14.1 (+28.2% over budget). This is the reason for LOW’s NO-GO. HIGH meets the general E18 desktop p95 ≤16.7 ms target, hence its scoped GO with P2s. Applying the storyline’s 11 ms comparison to HIGH would fail both baseline 11.6 and current 13.5; HIGH is not presented as an 11 ms pass. Both tiers are below 16.7 ms on this M4, but this is **not a phone measurement or mobile approval**.

### Living infected over time

Nearest one-second census to the stated simulation time after alarm; exact ticks and every census are in the JSON. Counts exclude hidden entities and require positive health. Values are living counts, not cap slots or queued arrivals.

| Alarm +seconds | HIGH baseline | HIGH current | LOW baseline | LOW current |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 33 | 50 | 32 | 50 |
| 15 | 49 | 83 | 48 | 73 |
| 30 | 22 | 42 | 32 | 93 |
| 45 | 22 | 42 | 19 | 85 |
| 60 | 25 | 46 | 23 | 83 |
| 90 | 26 | 47 | 34 | 74 |
| 120 | 15 | 53 | 32 | 76 |
| 150 | 44 | 62 | 46 | 97 |
| 180 | 28 | 53 | 44 | 113 |
| 190 | 32 | 64 | 51 | 126 |

At the final phase-change census, HIGH current has **64 living / 63 inside the perimeter** versus baseline **28 / 26**; LOW current **126 / 126** versus baseline **51 / 49**. Final census ticks differ slightly because phase polling is once per wall-clock second. The one-second sampled peaks may miss a shorter peak between censuses.

## Visual review

I personally reviewed all **36 hold captures** (9 per tier/zoom) and **8 exterior diagnostic captures**, through temporal review sheets, the committed contact sheet, and the initial full-size HIGH frame. Captures cover alarm +10, +30, +60, +90, +120, +150, +180, +190 and +191 s. All four visual runs reach line break. The contact sheet shows +30/+90/+180 at HIGH zoom 1, HIGH zoom 1.5, LOW zoom 1, LOW zoom 1.5, in that order.

- **HIGH, zoom 1:** the immediate courier area is relatively empty at +10 s, with attackers at the upper edge. By +30 there are many ordinary infected mixed with the large Alphas, soldiers firing from the sides, and bodies on the paving. At +90–180 the plaza is densely occupied and combat surrounds the courier. This reads as a horde fight. Horde score **8/10**; courier readability **6/10** in this protected stationary swarm.
- **HIGH, zoom 1.5:** the wider view makes the flanking approaches and allied firing ring easier to read. Ordinary infected are visible at the upper, side and lower edges and inside the camp. Bodies remain across successive frames; the line-break frame remains crowded. Horde **8/10**, courier readability **7/10**.
- **LOW, zoom 1:** the crowd grows markedly larger through the later hold. Numerous ordinary infected reach the plaza; it is not an Alpha-only encounter. Muzzle flashes and blood/body accumulation show continued fighting. The courier becomes difficult to pick out behind silhouettes and stacked health bars. Horde **8/10**, courier readability **5/10**.
- **LOW, zoom 1.5:** the wider shot still contains a dense horde, incoming figures from several screen directions, allied fire, and persistent bodies. The wider camera improves context but the courier is still swallowed by the late crowd. Horde **8/10**, courier readability **6/10**.

These are subjective scene scores for the requested horde/readability questions, not a complete E22 visual acceptance audit. The courier has god protection and receives no movement/firing input, so late engulfment is a stress scene rather than proof of normal skilled-play visibility.

### Pop, invisibility, bodies and wire

| Tier / zoom | Peak living in visual run | Peak drawn living | Permanent corpse identities retained | Live release calls | On-screen live release calls | Missing native figure samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| HIGH / 1 | 83 | 58 | 18 / 18 | 0 | 0 | 0 |
| HIGH / 1.5 | 89 | 72 | 12 / 12 | 1 | 0 | 0 |
| LOW / 1 | 126 | 114 | 16 / 16 | 2 | 0 | 0 |
| LOW / 1.5 | 124 | 111 | 19 / 19 | 3 | 0 | 0 |

The live-release hook records projected coordinates **at the actual call**, including admission rejects as well as retirement. All five LOW calls are outside the screen; the ordinary late LOW releases occur around alarm +131.5–143.5 s. This supports the new retirement staying off-screen in these holds. Two HIGH/1.5 dead-entity release calls occur on-screen but become same-ID permanent corpses; they are **not disappearing bodies**. All permanent corpse identities remain present and visible as entities through the end census, with zero missing identities. Recoverable downed infected can stand again and are not counted as permanent corpses.

I saw no unexplained pop-in/pop-out in the reviewed captures. These are stepped stills, not continuous video: they cannot exclude every transient rendering artifact. Every one-second native-figure census reports zero missing infected in the interior 80% of the camera frustum; appearance-based converted civilians and emergence/rise animations are excluded from that machine check. Their appearance was visually reviewed, without claiming exhaustive automated visibility proof.

Some exterior actors linger. Across 31 consecutive snapshots, the peak counts remaining outside the authored plaza and within 0.5 m of their first position are **2 / 3 / 18 / 9**, in the table’s order. These counts are spread around the exterior, not one 18-zombie pile. Frozen camera inspections at +65 and +95 s show a small LOW cluster outside the west wire and several figures near the northwest corner; HIGH has only a few stragglers. Main-horde penetration is clearly successful. This is a **P2 routing/targeting follow-up**, not an isolated navigation root cause or a proven s110 regression. Diagnostic camera movement happens while paused; it is restored before more simulation steps.

## Priorities and verdict

**P1:** none established by this QA lane. No visible live retirement, invisible native horde, or disappearing permanent corpse was found in the measured scope.

**P2:** LOW’s L4 11 ms headroom gate regression (release blocker for the LOW verdict); HIGH’s +16.4% frame p95 regression; dense silhouettes/health bars obscuring the courier, especially LOW/zoom 1; small exterior clusters lingering at the west/northwest wire. The horde complaint itself is resolved in the reviewed hold views.

**HIGH GO** is scoped to this seed-3 desktop L4 hold and the general desktop frame target. **LOW NO-GO** requires restoring its existing headroom gate or an explicit product decision to accept the measured loss of headroom. Overall this is **not an unconditional PROD approval**.

## Reproduction and validation

The timing driver reuses `tools/perf/l4-storyline.ts`, starting at the real L4 `turn` checkpoint, protecting the courier, using the harness’s initial position (x −22.85, z 0.7), and allowing natural mission progression and allied combat through line break. This is a controlled stationary hold, not mortal full-route completion. The courier can be pushed by collision. No zombie stats, weapons, spawn data, caps, recovery timers or corpses were edited. The diagnostic pass advances one simulation second at a time with actual renderer refreshes; its timings are not used as frame-time evidence.

Current build: `MI_BUILD_CACHE=off npm run build:qa`. Baseline: `VITE_QA_HOOKS=1 NODE_ENV=production node tools/perf/build-revision.mjs 7b70ff41 test-results/s112-l4qa/baseline`. The revision builder verifies matching dependency/build contracts and uses baseline source from Git; its manifest records zero public overlays. No baseline worktree was created. Temporary driver sources, their hashes, commands, analysis definitions, capture hashes and exact census ticks are preserved in `evidence.json`. Raw captures and full samples remain ignored under `test-results/s112-l4qa/`; they are not committed. The first HIGH summary inherited wrong quality/zoom labels; those derived metadata labels were corrected to the observed HIGH quality and driver zoom 1, with frame samples unchanged.

- Remote unchanged `MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" -- npm test`: **PASS**, exit 0, manifest **150/150**, **27 files / 106 tests passed / 1 skipped**, **218.2 s / 240 s**. Job `/srv/mi/jobs/s112-l4qa-b313fd-76000-1794669085`. No timeout, rerun or trimmed suite.
- `npm run typecheck`: **PASS** (both TypeScript targets).
- `npm run lint`: **PASS**.
- Timing numeric gate exits: candidate HIGH/LOW both 1 at the inherited 11 ms comparison; baseline HIGH 1 / LOW 0. These exits are preserved as budget failures, not hidden as harness errors. All four timing validity checks passed (WebGPU, actual tier, enough frames, completed hold, no page errors/missing native samples).

Delivery contains only this README, compact JSON (<200 KB) and one 960×816 contact sheet (229 KB). No deployment, push, main movement, spec edits, or gameplay changes.
