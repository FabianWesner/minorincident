# s192-l7harder — L7 encounter pressure

PO 2026-11-19: “L7 is too easy, add more Zombies and let them attack from multiple sides at once.”

## Current result

- The authored regular population is **560 HIGH / 280 LOW**, up 40% from 400/200. The retained concurrent caps are **200/100**; the shared director halves the HIGH input for LOW. Zombie stats are unchanged.
- Each of the four street anchors has a seed-1 native skilled-route window with at least three distinct infected attackers in different cardinal sectors within five seconds on both tiers. The trace requires a navigable path to the nearby target and records source and target positions. [LOW events](directions-low.json), [HIGH events](directions-high.json); producer: `tools/qa/l7-windups.ts`.
- A fresh native census completed both tiers with 560/280 regular admissions, five Alphas each, and empty queues. Both saved 24/24 survivors with zero courier deaths. The earlier comparable HIGH baseline completed with 14/24 saved, zero courier deaths, zero survivor deaths and ten turns. The final run has zero survivor deaths or turns: deaths did **not** rise despite the higher population. Four additional ordinary mortal rifle guards cover the HIGH boarding approach.
- The full `npm run qa:threat` run on the final gameplay revision passed with **0 flags**. Typecheck and lint passed. Remote `npm test` passed: 105 tests passed and one skipped in 27 files.

## Performance

The cap increase was not enabled. On the final gameplay revision, a local native proxy (`node --import tsx/esm tools/qa/l7-native-perf.ts`) timed `world.update` with the ordinary skilled route, without rendering:

| Tier / cap | Peak infected | p50 | p95 | p99 | Ticks |
|---|---:|---:|---:|---:|---:|
| HIGH / 200 | 200 | 3.98 ms | 13.13 ms | 22.40 ms | 6,118 |
| HIGH / 240 trial | 240 | 4.59 ms | 13.06 ms | 16.93 ms | 6,146 |
| LOW / 100 | 100 | 2.48 ms | 7.39 ms | 15.04 ms | 6,133 |

A repeat under a lighter local load measured HIGH p95 5.69 ms at cap 200 and 5.20 ms at cap 240, and LOW p95 2.20 ms at cap 100. HIGH remains over its 4 ms target in both repeats; LOW varied from above to below its 6 ms target. These are load-sensitive proxy measurements; **real-device peak-horde frame timing remains pending**. A CPU profile of the ordinary HIGH route attributed the largest sampled costs to spatial queries, event dispatch, outbreak updates and navigation clearance; it did not isolate a safe L7-only optimization. All three proxy routes completed with full authored admissions and 24/24 saved.

## Acceptance and visual evidence

Separate remote `qa:accept -- --level L7 --skip-browser` runs completed for HIGH and LOW. Each reported **0 fresh failing rows**, with the native route, eight fixtures and three checkpoints passing. Both exited 2: all 12 L7 rows still contain incomplete clauses. L7-04 counted 560 HIGH and 280 LOW; the direction-trace clause passed on both tiers, but L7-04 and L7-05 remain **not checked overall**. The pulled `fix51-verify` files were restored.

The acceptance evaluator now gates regular admissions at 560/280; boundary checks reject 559/279 and accept 560/280. L7-04 retains the previous street/flank and one-rocket separation wording. L7-05 requires the new direction evidence rather than silently omitting it. Epic 29 AC08 and AC19 were updated for the PO's population and conditional cap change; no unrelated target was intentionally relaxed.

The current [HIGH zoom-1 junction frame](junction-high-z1.jpg) was captured headlessly with Metal WebGL2 under the browser lock and inspected. At tick 1224 it shows living infected at the left, upper and upper-right edges while the column fires; I inspected the image. The still does not establish three timed directions; the native windup trace supplies that timing evidence. A live, unpaused HIGH WebGL2 run at zoom 1 observed all 536 subsequent queued regular/Alpha admissions with the real camera frustum active; all were offscreen at admission, with no occlusion-only cases. Together with 29 opening residents already present at load, this covers the 560 regulars and five Alphas in that run. [Admission log](visibility-high.json). A matching live LOW seed-1 run observed 256 queued admissions (252 regulars and four Alphas), all offscreen with the frustum active and no occlusion-only cases; it reached the result screen. [LOW admission log](visibility-low.json); reproducible probe: `tools/qa/l7-visibility.mjs`. These zoom-1 runs do not qualify all camera positions; broader visual review remains incomplete.

A separate current physical launcher probe used real input and native L5→L6 carried saves. LOW pickup / first-shot frame maxima were 16.8 / 16.8 ms; HIGH maxima were 33.4 / 16.8 ms, with at least 21 samples per window and no errors. [LOW receipt](pickup-low.json), [HIGH receipt](pickup-high.json). The acceptance adapter verifies their source, producer, frame probe and archived seed hashes. Both physical pickup/frame clauses pass; the separate reviewed launcher-captures clause remains not checked.

## Remaining

- Finish the incomplete acceptance evidence, including broader camera offscreen/LOS coverage and separate visual reviews. The acceptance commands did not fully pass.
- Recheck the peak-horde performance budget under a suitable quiet measurement and report real-device timing. The current native proxy exceeds the stated sim budget.
- The screenshot shows pressure from several sides but does not visually prove all three timed directions. The direction trace is one native seed and does not establish every possible play style.

Epic correction: the earlier edit inadvertently described the entire newly authored final horde (168/84) as the initial admitted minimum. The pre-existing L7-08 minimum is 120/60, and the director queues the excess. Epic 29 §5.3 and the corridor receipt now distinguish the authored group size from that unchanged initial minimum; the L7-08 target itself was not relaxed.

The live admission probe was repeated at zoom 0.5 on both tiers. HIGH observed 536 queued admissions and LOW 256; every admission was offscreen with the camera frustum active and actual zoom within 0.02 of 0.5, with no occlusion-only cases, and both runs reached the result screen. The probe now exits unsuccessfully on incomplete admission counts, visible admissions, missing frustum, zoom mismatch or incomplete route. Logs: `visibility-high-z0.5.json` and `visibility-low-z0.5.json`. This is seed-1 coverage at zoom 0.5, not proof for every camera movement.

A native seed-1 rocket observation found that the first rocket near street 1 left 31 of 38 living members of that street group on each tier; the first near street 2 left 29 of 32 LOW and 29 of 37 HIGH. This confirms those individual rockets did not clear the entire live group, but the first street-1 survivors were all in the same player-relative cardinal sector at the next tick. It does not prove that every distinct approach survived one rocket; the full L7-04 separation clause remains open.

`npm run verify -- E29` runs the repository per-change gate rather than retired epic-specific tests. The local unit stage timed out at 240 s; the remote attempt also timed out under load, and an unchanged remote retry passed typecheck, lint and the unit suite (105 passed, one skipped, 27 files, 226.4 s). The separate L7 acceptance limitations above remain.
