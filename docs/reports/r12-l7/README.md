# R12 L7 rework — native evidence and QA handoff

**Status: implementation committed; native verification BLOCKED by host/runner access. Do not treat this report as a green acceptance gate.** Browser validation belongs to the dedicated QA lane after merge (PO instruction).

## Changes

- Global rocket cadence is 1.2 shots/s (50 ticks between shots), previously 2.4 shots/s. Damage, splash and other weapon definitions are unchanged.
- Launcher checks safety at discharge, after aim assistance: an aim point closer than 5 m or a living infected centre within 5 m in a 30° firing cone rejects the shot without spending ammunition. Existing dry audio cue and a two-second “Too close!” HUD hint are used. A fired rocket colliding before 5 m of actual travel becomes a harmless dud.
- L7 Alphas have 450 HP, previously 300; other levels retain 300. L7 horde mouths span both sides of the streets/corridor and bus approach, with longitudinal staggering. Population and Alpha counts are unchanged. Existing follower wounds and boarding logic remain intact.
- Native L7 controller selects shotgun below 6 m. L10 controller uses MG before the finale and the authored mounted-gun stairs during charging, then selects rocket/shotgun by range. These controller changes require the unfinished L10 acceptance check; they do not change weapon balance.
- L7 acceptance documentation is marked PO 2026-11-08. The obsolete cadence/Alpha criteria in the L7 spec were corrected to the superseding PO requirement; no other specification scope was changed.

## L7 before/after

Baseline runtime is `1b4e89b11c7f82dd72850e4f9bf1d1118c9cb64f`; final runtime/controller revision is `3d0e98ba`. Both variants use the same final controller, seed and quality settings, with a 300 simulated-second cap. This is a controlled native comparison, not a physical-input playthrough. [Baseline source payload](baseline-source.json.gz) and [source hashes](source.json) identify the runtime under test.

[Before](measure-before.json) and [after](measure-after.json) contain attack bearings, individual Alpha timings, failure positions and route durations. Rates count attack windup starts over the entire route; they are not successful bites. Alpha TTK is first player hit to permanent death, including mixed shotgun/rocket use; unobserved deaths are censored. `n` is the number of observed Alpha deaths.

| Variant | Quality/seed | Rockets | Kills/rocket | Courier attacks/min | Group attacks/min | Alpha mean TTK (s; n) | Deaths | Boarded | Outcome |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| before | low/1 | 76 | 2.29 | 41.6 | 5.5 | 0.74; 5 | 0 | 24 | complete |
| before | low/2 | 62 | 3.03 | 36.9 | 4.0 | 2.21; 5 | 0 | 24 | complete |
| before | low/3 | 72 | 2.69 | 8.4 | 0.4 | 1.27; 5 | 0 | 0 | tick-budget |
| before | high/1 | 64 | 5.05 | 215.8 | 21.6 | 1.25; 5 | 1 | 0 | mission-failed |
| before | high/2 | 71 | 5.11 | 75.8 | 30.8 | 2.26; 5 | 0 | 13 | complete |
| before | high/3 | 75 | 5.17 | 44.2 | 5.1 | 0.89; 5 | 0 | 24 | complete |
| after | low/1 | 45 | 3.51 | 54.3 | 11.4 | 2.52; 4 | 0 | 21 | complete |
| after | low/2 | 39 | 4.41 | 42.2 | 6.8 | 3.94; 5 | 0 | 24 | complete |
| after | low/3 | 42 | 4.24 | 31.4 | 2.3 | 2.00; 3 | 0 | 24 | complete |
| after | high/1 | 39 | 6.21 | 210.7 | 32.7 | 4.77; 4 | 1 | 0 | mission-failed |
| after | high/2 | 40 | 7.47 | 243.7 | 23.9 | 1.54; 2 | 1 | 0 | mission-failed |
| after | high/3 | 46 | 7.70 | 86.2 | 16.5 | 4.05; 5 | 0 | 21 | complete |

Total rockets: 420 → 251; rocket kills: 1,630 → 1,403; deaths: 1 → 2. Four of six routes completed in each variant; the baseline also has one capped run. After-change completions board 21–24 survivors. High seed 2 now fails, so the higher difficulty has a measured survival cost. Increased kills per rocket does **not** demonstrate less clustering; this remains a playtest concern.

The cardinal attack counts span all four bearings in both variants. The `simultaneousDirections` field in the matrix only counts nearby visible living enemies and must not be called simultaneous attacks. The separate [crossfire proof](crossfire.json) counts actual overlapping windups against the living courier/following evacuees and preserves bearings observed at 6–12 m: streets four sectors at tick 181, corridor three at tick 3937, bus three at tick 5393 (high, seed 1). Adjacent 45° sectors count separately; this does not establish three attacks separated by 90°. Observer stops on satisfying the direction criterion, not mission completion.

## L10 Mega

[Before](mega-before.json) / [after](mega-after.json): production projectiles against a stationary Mega at 8 m require ten damaging direct hits in both cases. First-to-tenth impact takes 3.75 → 7.50 s; trigger-to-kill takes 4.30 → 8.05 s. Before fires an eleventh rocket already in flight when the tenth hits. The target position is held fixed to isolate cadence; this fixture is **not proof that the full moving Mega encounter remains winnable**. The complete L10 acceptance run was interrupted before producing evidence and must be rerun on Hetzner.

## Checks and remaining native work

- Focused combat/navigation tests: 11/11 passed; safety assertions folded into the existing weapons test, with no new test case count. Close aim, forward enemy, enemy behind, armed hit, and pre-arm enemy/cover collisions are covered.
- Full unit suite: 107/107 passed in 65.2 s within the requested 150 s cap. This predates the newest one-worker rule; any rerun must use one worker.
- Final typecheck and lint passed, including the added crossfire helper. An earlier lint failure for an unused physical-helper local was corrected; both the failure and the later passes remain in the command receipts.
- L7 acceptance completed: low seed 1 completes with zero deaths; high seed 1 fails at 89.98 s during bus departure. Fixtures: eight clauses per quality, zero errors. All three checkpoints pass per quality. The overall report has two failing rows: L7-01 uses a stale physical pickup receipt (browser skipped), and L7-05 reports reachable-share zero. Neither failure has been waived. The [historical baseline path clauses](baseline-path-checks.json) passed at 98.6–100% across both qualities and both policies; the current moving-route zero therefore requires a fresh path diagnosis, rather than dismissal as an inherited failing row. [Archived acceptance](acceptance.json.gz).
- Baseline threat L1–L5 has zero per-level/passive flags; its only global flag is the deliberate partial-level selection. [Baseline audit](threat-before.json.gz). Full final threat audit and exact L1–L5 hash/run/phase equality checks are still pending.
- [Command receipts](commands.json), [interrupted earlier diagnostics](interrupted.json), and [browser startup diagnostics](browser.json) retain failures as well as passes. Generated canonical reports were restored rather than published as passing results.

Host blocker: Hetzner pool discovery fails DNS (`Errno 8`); direct SSH fails `No user exists for uid 501`. The supported remote wrapper was queued with `MI_LOCAL_FALLBACK=0` and cancelled without launching a job. Local heavy jobs are stopped. No additional browser run is required from this coding lane.

Resume with the supported remote runner after host services are restored:

```sh
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" \
  --pull docs/reports/r12-l7 -- python3 tools/qa/r12-l7-native.py --remaining
```

The batch executes measurements serially, acceptance one level at a time, and unit/threat commands with one worker. With `--remaining`, it reuses the archived before/after measurements and baseline threat audit, then runs typecheck, lint, unit, L7/L10 acceptance and full threat comparison. Omit that flag for a full comparison rerun. Complete-route acceptance archives now retain threat phases and worst-path diagnostics for investigation. No heavy commands may overlap on this Mac. A fresh native pass must resolve or explicitly investigate the L7 failures and establish full L10 completion before calling the brief verified.

## Browser QA needed

Dedicated QA lane: use real keyboard/mouse input, ordinary mortality, HUD visible, 1280×800, WebGL2 Metal, one headless browser. Inspect both low/high qualities. Zoom 1.5 for combat and safety; repeat bus wide shot at zoom 0.8. Tick numbers below are native seed-1 reference points; physical arrival times will vary. Do not teleport or inject combat inputs for the actual route proof.

| Level | Exact reference position/tick | Quality / zoom | Check |
|---|---|---|---|
| L7 | Launcher pickup, first equipped/ready frame; aim at ground 2 m ahead, then a visible target ≥8 m | low + high / 1.5 | Physical LMB produces dry click + “Too close!”, no ammunition/projectile spent; farther target fires. Capture and open the hint and normal shot. Prepared helper: `tools/qa/r12-l7-live.ts` (not yet browser-validated). |
| L7 | Courier (262.40,15.00), native tick 181, seed 1 | low + high / 1.5 | Opening remains traversable; ordinary melee winds up from distinct approaches. |
| L7 | Courier (46.47,46.37), tick 3937, seed 1 | low + high / 1.5 | Corridor flank/rear pressure, distinct approach mouths, no spawn inside walls; Alpha survives two direct rockets and dies on third; rapid trigger cadence stays 50 ticks. |
| L7 | Courier (-50.26,42.60), tick 5393, seed 1 | low + high / 1.5 then 0.8 | Multiple attack approaches at bus, follower wounds, physical boarding and uninterrupted departure; investigate high seed-1 native failure and reachable-share failure. |
| L7 + L10 | First launcher-ready frame; nearest forward infected at 4 m, then enemy behind at 4 m; aim 8 m ahead | low + high / 1.5 | Forward enemy blocks; enemy behind does not. Fire from clear range, then inspect any collision before 5 m: no blast/damage. No god mode during route proof. |
| L10 | Authored finale console/platform stair after charge starts; then first frame of `mega` objective, courier on deck y>2 | low + high / 1.5 | Normal physical stair/mounted-gun use can finish charge; dismount, preserve ≥5 m range and defeat moving Mega with ten direct rockets; record actual TTK/deaths and verify all L10 acceptance rows. |
| Scene gate | Standard `scene:gate` catalog, all 50 rows | catalog qualities / authored camera | Check actual rendered scenes/errors after merge. Earlier attempt executed zero rows due host Chromium startup failure; it is not passing evidence. |

Lane raw outputs and the unneeded local 521 MB dist were removed; shared build caches were retained. No captures were produced in this lane; no visual claims are made. Dedicated QA should retain only README-linked evidence and at most one contact sheet. No push or deployment was performed.
