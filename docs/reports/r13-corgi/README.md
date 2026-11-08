# r13-corgi — recovery guarantee and companion HUD

Working fixes are committed through `602835dd3b69d5f0a40215df4c1ffc54dc807d8a`, against brief baseline `c92a03b2`. Runtime source hash: `af461613360ea843ff9fce1ac59c291db4ffebce7465e696861d656941f9a476`.

**Closeout:** the orchestrator stopped further investigation at the time box. The rejoin, restore-placement, and HUD fixes are retained. The L4 collision difference below remains open. No browser was launched; no deployment or push was performed.

## Changes

- After six continuous seconds beyond 35 m, or six seconds off-screen without closing the gap, Corgi searches for a physically clear, reachable entry just outside the camera behind the courier. Both relocation endpoints must be off-screen. Ordinary movement then runs Corgi into view. Visible Corgi is never relocated by this rule.
- Progress measures closing distance, so circling does not indefinitely reset the stall timer. Slow catch-up cannot indefinitely reset the distant leash. Blocked entry searches retry once per second.
- Scripted passengers, boarding, threshold transitions, and non-playing mission phases retain their existing owners. Rejoining overrides the standing warning pose until Corgi is nearby.
- Checkpoint gathering now happens after chunk/navigation, vehicle, gate, and solid restoration. It finds a clear point near the courier, clears stale movement/transition state, and fixes stale hidden admission. Cinematic completion also gathers Corgi; passengers remain under script control.
- The HUD always presents companion state, including rejoining and awaiting rescue. The touch CSS rule hiding the companion panel was removed.

Implementation: [Companion.ts](../../../src/sim/npc/Companion.ts), [Mission.ts](../../../src/sim/missions/Mission.ts), [Hud.ts](../../../src/ui/Hud.ts), and [ui.css](../../../src/ui/ui.css). Regression assertions were folded into the existing corgi case in [npcs.test.ts](../../../tests/engine/npcs.test.ts); no test case was added.

## L10 investigation and native evidence

The seed-1 native route **did not reproduce the original PO loss**, with the baseline companion implementation on either tier. No exact historical fence/pocket is claimed. Confirmed defects were the unconditional touch-panel hiding and unsafe restore ordering/placement. The recovery rule covers a stalled or distant companion regardless of the original obstruction.

L10's safe companion behavior and residency exclusion did not identify a permanent death/despawn path. The native probe samples companion presence once per simulation second.

| Tier | Baseline companion maximum gap | Fixed maximum gap | Fixed completion time | Missing samples |
|---|---:|---:|---:|---:|
| Low | 14.51 m | 14.59 m | 1,290.60 s | 0 / 1,307 |
| High | 12.89 m | 5.60 m | 1,297.02 s | 0 / 1,314 |

These before/after values were measured on the Mac before the remote-only instruction. The baseline comparison substituted `c92a03b2`'s companion implementation into the native harness; it is not a full baseline acceptance run. Both routes completed with zero deaths. The final remote native run reproduced the fixed metrics, with zero deaths and zero missing samples.

Actual `cure-military` and `cure-corridor` snapshots were captured during native play and restored into fresh worlds. Both tiers were checked with normal snapshots and snapshots deliberately placing Corgi 200 m away, hidden, with a stale transition timer: **all eight probes placed a visible, admitted Corgi exactly 2 m away**, with the timer cleared. Both Mac and remote runs passed.

Evidence: [before](native-before.json), [Mac after](native-after.json), [remote after](remote-native-after.json). Repro tool: [r13-corgi.ts](../../../tools/qa/r13-corgi.ts).

## Validation

All heavy commands after the remote-only instruction used `MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" -- <command>`, sequentially, with one worker where supported.

| Check | Result |
|---|---|
| `npm run typecheck` | PASS locally and remotely; remote 45.28 s |
| `npm run lint` | PASS locally and remotely; remote 28.26 s |
| `npm test -- --maxWorkers=1` | Mac: 107 passed. Remote retry: 106 passed, 1 skipped, 0 failed; 214.63 s |
| Test inventory | 150/150 cases, 43/45 files |
| Native L10, both tiers + fresh restore probes | PASS; remote 192.10 s |
| Full threat audit, L1–L10 | 31 stages, 0 stage errors, **0 aggregate fail flags**; 1,925.4 s audit / 1,931.4 s wrapper |
| `qa:accept -- --level L10 --skip-browser` | Completed; exit 1, G-24 and L10-03 remain failing; remote 1,144.39 s |
| Mortal checkpoint death/control probes | All 54 clauses PASS; both control hashes identical; 0 errors |

The full threat command was:

```sh
node tools/qa/test-budget.mjs --name qa-threat-serial-remote --max-seconds 3000 -- \
  node --import tsx/esm tools/qa/threat-audit.ts --maxWorkers=1 --out test-results/r13-corgi/remote/threat
```

The caller wall budget was increased for the required serial audit; the default 600-second wrapper was not passed. Case limits, observation windows, and threat thresholds were unchanged. The earlier local audit was interrupted when the orchestrator required remote execution. Remote queue/setup and serial QA carried the work beyond the original time box.

The remote helper creates a commit-less manifest repository. The first remote unit run failed at `git rev-parse HEAD` in the gate-tool fixture, and acceptance could not start for the same reason. Creating a HEAD commit in the disposable remote snapshot resolved this infrastructure issue; no game or test code was changed. [Follow-up validation](followup-validation.json) records the snapshot HEAD and verifies that the runtime sources match the committed code.

Acceptance remains red:

- **G-24:** the fixture expects healthy distant Alphas to have no bar, while production deliberately makes Alpha bars mandatory. The production function and fixture are byte-identical to the brief baseline.
- **L10-03:** the low/stationary military-column regular group measures 2 against the 10–20 target; the existing source already documents this baseline failure. Composition/handgun-dog proof freshness also remains incomplete for the changed source.
- Current level rows: 4 PASS, 10 NOT CHECKED, 1 FAIL. Current global rows: 26 NOT CHECKED, 1 FAIL. This report does not claim complete L10 acceptance.

Evidence: [local validation](local-validation.json), [first remote validation](remote-validation.json), [follow-up validation](followup-validation.json), [threat summary](threat-summary.json), [remote acceptance](remote-acceptance-summary.json), and [baseline acceptance source comparison](baseline-acceptance.json).

## Open: L4 collision difference

The aggregate threat gate is green, but its detailed L4 receipt contains `INCOMPLETE_NATIVE_POLICY:mission-failed`. This must not be described as a proved pre-existing failure.

| Runtime | Outcome | Simulation time | Deaths | Additional failure |
|---|---|---:|---:|---|
| Brief baseline `c92a03b2` | complete | 599.13 s | 19 | none |
| Retained runtime `602835dd` | mission-failed | 455.55 s | 8 | collision-invariant |

The retained-runtime witness is tick **12480**, actor **440**, other **442**, penetration depth **0.640672 m**, writer **`infected.update`**, objective **`wait`**. Baseline and changed runs used different runner hosts. A controlled same-runner comparison and a conditional scene-gather experiment were queued, then cancelled before execution at the orchestrator's closeout instruction. No experimental runtime change was applied.

Repro on the retained branch (seed 1, low tier):

```sh
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" \
  --pull test-results/r13-corgi/l4-repro -- \
  node --import tsx/esm tools/qa/threat-audit.ts --levels L4 --maxWorkers=1 \
  --out test-results/r13-corgi/l4-repro
```

Inspect `L4.json` → `run.outcome`, `run.failures`, `run.blocker`, and `flags`. The partial audit adds `PARTIAL_LEVEL_SELECTION` by design. Repeat from an isolated, properly initialized `c92a03b2` checkout on the **same runner** to establish causality. The completed baseline probe restored all six changed runtime source files from that commit; their hashes are recorded in the follow-up validation.

Evidence: [L4 difference](L4-difference.json). Investigation remains open at the orchestrator's direction.

## Browser QA needed

- Observe rear entry after distant and nearby stalls across headings, both zoom limits, and WebGPU/WebGL2: visible running, no visible relocation or interpolation streak.
- Verify companion panel visibility and layout in touch portrait/landscape, including following, hiding, fetching, rejoining, and awaiting-rescue states.
- Inspect the first interactive frame after military/corridor restores and scene transitions, including vehicle boarding/disembarking ownership.
