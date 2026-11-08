# r12-l6 — rail pressure and a readable ending

**Implementation and native pressure checks complete; final full threat rerun blocked by runner DNS. Browser QA belongs to the dedicated QA lane after merge, per the latest PO instruction.** Baseline `1b4e89b1`. No push or deployment.

## Changes

- Recurring rail arrivals use cohorts of three every 40 seconds. Successive cohorts prefer a maintenance entry ahead of the leader and behind the tail, respectively, at least 18 m away where an eligible entry exists. The existing nearest-entry fallback, offscreen admission, navigation and infected caps remain in use. The admission log determines direction, so a cap-limited attempt does not flip direction merely because its timer fired.
- The original survivors now walk through Northgate into the night street. Crossing x=263 marks them rescued without hiding their actors. They continue toward their street slots at x=270–274.8, z=12–18. The controller waits until every rescued actor has cleared x=266 before closing the gate and starting the existing six-second ending shot. The HUD says **“The survivors are safe.”** during the procession; **“Night. Still alive.”** remains the authored night caption.
- Escaped survivors keep their prior safety after crossing the exit. The armed guard follows the same visible exit route. Before escape, ordinary outbreak and combat rules still apply.
- Only L6 acceptance rows 07, 11 and 12 changed, with **PO 2026-11-08**. No specs or other level gameplay changed.
- An existing mission test now checks rescued actors remain drawn, move clear of the exit, display the safe caption, and permit normal gate closure. It failed before the street-clearance wait and passed afterward. Registered test count stays within the 150-case cap.

Gameplay source is unchanged since `df4599e1`; its source hash is `d3ae91cee143e58a5e909b96e5de47d261f926e54bb6c2ee3fd7a6dfdff225b2`. Supporting QA changes correct breach-clock measurement after checkpoint restore, compare observer purity with the canonical route, follow the visible “Rejoin” cue in the input driver, add optional rail/exit capture points, and permit a bounded browser-pool request timeout on a busy host.

## Before/after native measurements

[Before](evidence/pressure-before.json) uses untouched baseline source extracted temporarily with `git archive`; the snapshot was deleted. [After](evidence/pressure-after.json) uses the final gameplay source. Each runs the ordinary mortal complete policy from `L6-default`, seeds 1–3, separately at low and high quality. The recorded actual tier matches the requested tier. These complete routes do not inject health, movement, objectives or inputs. The separate unit exit fixture deliberately stages actors and is not balance evidence.

Low and high outcomes were identical for each seed; **all six cells were run**. Rates below are per simulation minute. “Attacks” counts actual combat windup attempts, including attempts interrupted by shooting; it does not mean every attempt landed. Damage taken is recorded separately.

| Tier / seed | Arrivals/min before → after | Ahead / behind / near before → after | Player attacks/min before → after | Follower attacks/min before → after | Out / lost before → after | Deaths before → after | Peak infected before → after |
|---|---:|---|---:|---:|---|---:|---:|
| Low 1 | 4.70 → 4.51 | 3/14/1 → 12/15/0 | 12.48 → 18.13 | 3.64 → 6.97 | 25/4 → 22/7 | 0 → 2 | 20 → 30 |
| Low 2 | 5.10 → 4.50 | 7/10/6 → 12/12/0 | 9.37 → 11.25 | 6.04 → 7.03 | 25/4 → 25/4 | 1 → 1 | 24 → 28 |
| Low 3 | 4.92 → 4.49 | 35/36/23 → 23/18/0 | 32.17 → 15.70 | 18.05 → 5.92 | 0/9 → 26/3 | 14 → 3 | 30 → 26 |
| High 1 | 4.70 → 4.51 | 3/14/1 → 12/15/0 | 12.48 → 18.13 | 3.64 → 6.97 | 25/4 → 22/7 | 0 → 2 | 20 → 30 |
| High 2 | 5.10 → 4.50 | 7/10/6 → 12/12/0 | 9.37 → 11.25 | 6.04 → 7.03 | 25/4 → 25/4 | 1 → 1 | 24 → 28 |
| High 3 | 4.92 → 4.49 | 35/36/23 → 23/18/0 | 32.17 → 15.70 | 18.05 → 5.92 | 0/9 → 26/3 | 14 → 3 | 30 → 26 |

Raw arrivals/min decreased. Pressure increased through clustered opposing approaches: the two baseline seeds that completed have more attacks on both the courier and followers after the change. Baseline seed 3 timed out at 1,200 s with 20 survivors still following, nine lost and none out; its retry-heavy attack rates are not a like-for-like completed-route comparison. Final seed 3 completes at 614.48 s, with 26 out and three courier deaths.

| Seed (both tiers) | Complete time before → after | Courier damage before → after | Escaped actors still visible before → after |
|---|---|---:|---:|
| 1 | 289.93 → 441.37 s | 190 → 450 HP | 0 → 22 |
| 2 | 358.80 → 411.90 s | 210 → 239.10 HP | 0 → 25 |
| 3 | timeout 1,200 → 614.48 s | 1,680.27 → 455.80 HP | 0 → 26 |

Every after run meets the new numeric targets: ≥4.4 arrivals/min; both directions; ≥11 player and ≥5 follower attempts/min; ≥30 HP damage; ≥22/29 out; ≤3 courier deaths. Peak infected is 26–30, within both tier budgets. All rescued actors remain unhidden in the native end state; rendered framing still needs QA.

[Covering control](evidence/covering.json): ordinary `evade-only`, seed 1, low and high, rescues only 1/29 after 12 courier deaths, versus 22/29 with competent covering. Both controls complete in 569.73 s. This satisfies the ≤30% out control.

**Open timing gap:** legacy E24-AC02 asks for one complete seed in 180–300 s. None of the final seeds meets that band. This criterion was not edited or waived. Process-local probes at 45/50/60-second cadence and a 24 m rear offset did not restore it. The 60-second variant also reduced follower attack pressure below baseline and the new target; the other variants increased deaths or completion time. Production retains the six-seed-verified 40-second / 18 m tuning. Probe outcomes are in [verification](evidence/verification.json).

## Checks

| Check | Result |
|---|---|
| `npm run verify -- E24` | PASS on final gameplay: typecheck 39.59 s; lint 20.55 s; `npm test` 54.82 s. |
| Unit execution / budget | 107 executed tests, 27 files, all PASS. Budget collection: 150 registered cases across all projects, 43 files, within 150/45 limits. |
| Fresh `qa:accept -- --level L6 --skip-browser` | Exit 1; **zero fresh failing rows**, nine incomplete rows. Complete/stationary, both fixture tiers and seven checkpoint controls per tier ran. L6-07 has a fresh numeric PASS. Historical L6-05 FAIL remains even though current measured clauses pass; incomplete rows are 01/02/04/06/08/09/11/12/14. This is not a full L6 acceptance pass. |
| Full `qa:threat`, earlier source | All ten levels, zero flags, 304.25 s, exit 0 at `15058e42`, before the final exit-clearance/protection followup. |
| Full `qa:threat`, final gameplay source | Attempt reached the 600 s test-budget timeout, exit 124; no completed final audit receipt. This attempt predates the new one-worker rule. |
| Final Hetzner rerun, `--maxWorkers=1` | **BLOCKED before admission**: runner API DNS fails (`getaddrinfo`, Errno 8); example.com fails too. Local fallback disabled. Queue cancelled, exit 130; no native command started and no check remains running. |
| `scene:gate` / rendered matrix | Delegated to the dedicated QA lane under the latest PO rule. No qualifying current rendered pass is claimed. |
| Diff whitespace | `git diff 1b4e89b1..HEAD --check` and working diff check PASS. |

[Acceptance summary](evidence/acceptance-summary.json) preserves clause-level status and canonical hashes. [Native acceptance archive](evidence/acceptance-receipts.tar.gz) contains the eight complete/stationary/fixture/checkpoint receipts (about 123 KiB). [Verification receipt](evidence/verification.json) records checks, earlier versus final threat evidence, failed tuning probes, and the blocked remote command. [L6-07 numeric review](../../qa/reviews/L6-07.json) binds the new pressure targets to the current source and after-measurement hash.

When runner DNS is restored, repeat the exact one-worker command in the verification receipt. Use Hetzner for heavy suites, disable Mac fallback, and run commands sequentially. Do not interpret the earlier ten-level pass as a final-source pass. The reusable [measurement helper](../../../tools/qa/r12-l6-measure.ts) also runs its levels/tiers/seeds sequentially.

## Browser QA needed

**Owner: dedicated QA lane after merge. Coding lanes must not launch browsers.** Use ordinary physical inputs from `L6-default`, seed 1, with a fresh mortal save and captions enabled. Complete one low-tier run and one high-tier run. Capture every stage below at **zoom 1 and 1.5**, yielding low/high × zoom 1/1.5. Keep one browser at a time. Record actual ticks and actor IDs; retry/death changes the clock, so position/event triggers below are authoritative.

| Level / exact position or event | Quality / zoom | Inspect |
|---|---|---|
| L6 retreat, courier near **(110,15)** on the track; maintain the visible group. Follow recurring `spawnLog.wave===3` admissions at maintenance entries x=54/78/126/162/198/228, z=11.2/18.8. Observe at least two successive cohorts (40 s cadence, subject to existing admission caps). | low and high; 1 and 1.5 | Three-person pressure groups visibly reach the track, including one ahead and one behind the group. Windups, hits, follower threat, readability and room for covering movement. No harmless actors trapped behind walls/hatches; no unfair visible pop-in. |
| L6 Northgate approach **x=240–263, z≈14.1–15.9**, then courier near **(268,15)**; capture the tick the **first original survivor crosses x=263** and “The survivors are safe.” appears. | low and high; 1 and 1.5 | Same identities visibly walk through the exit. No disappearance on the platform. Caption is readable and timely; group, courier and open gate remain understandable in the camera. |
| L6 exit, **last living survivor crosses x=263**, then the tick **every rescued actor has x≥266**. Street targets are x=270–274.8, z=12–18. | low and high; 1 and 1.5 | Last survivor physically clears the mouth before gate closure/cinematic freeze. Bodies remain drawn; no clipped or floating procession, no guard returning to combat, no closed gate trapping the group. |
| L6 first cinematic tick and middle of the **six-second “Night. Still alive.”** shot, then result. | low and high; 1 and 1.5 | Camera still frames rescued bodies and courier; safe caption transitions to exact night caption. Night/exit framing reads clearly; result survivor count matches the rescued identities. |

The opt-in capture hook is `PLAYTEST_L6_RAIL_CAPTURES=1` in [session.ts](../../../tools/playtest/session.ts). It captures rail/safe/night at both requested zooms, logs original escaped identities/transforms/hidden flags, and pauses only to capture. Leave normal pose probes enabled. The hook supplies snapshots; QA must also watch the uninterrupted last-survivor transition because one frame cannot prove a visible departure. The input driver now follows the on-screen “Rejoin <name>” cue; verify this on the normal physical route. Before the second crash, the old driver stalled after leaving the group behind; the corrected route has no qualifying rendered run yet.

Run **`npm run scene:gate -- --jobs 1`** after merge on the admitted QA host using its shared build cache; open the L6 gate/retreat/exit sheets and report other gate rows separately. Include the gate's requested backends; remote SwiftShader does not establish Mac Metal/WebGPU performance. Personally open the four-cell rail/exit/night captures, then retain at most one sheet plus a compact hashed manifest. No new build or browser was launched for this handoff.

## Storage and handoff

Only the linked compact evidence above is retained for this lane. Disposable captures, traces, failed browser profiles, temporary baselines, duplicate after/matrix receipts and raw test outputs were removed. No sheet remains. The private Vite server is stopped; no added build/worktree exists. Disk had about 33 GiB free at handoff. The wider working tree also contains PO-requested deletions of obsolete tracked `test-results` artifacts; those unrelated cleanup deletions are not staged into this lane's feature/report commits.

**Remaining before acceptance closure:** final-source full threat audit when runner DNS works; dedicated browser review and scene gate; decision/fix for the legacy native timing gap. Native numeric pressure and visible-actor regression evidence are complete.
