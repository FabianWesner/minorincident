# Batch 91 real-input QA — HOLD (in progress)

Target PROD revision: `d9db5d49` (worktree HEAD). This report records an infrastructure-blocked QA attempt; it does **not** claim the requested HIGH then LOW real-input coverage was completed.

## Resumed execution — 2026-11-13

The sandbox restriction was lifted. The existing browser pool was healthy; one GPU context was used, through the playtest driver and pool wrapper, on ports 4941/4942. A fresh QA build passed.

HIGH zoom 1 L6: an eight-minute real-input run completed its observation window, but did not finish L6 or reach the first hatch. It progressed through shelter → stop → retreat and yielded at checkpoint `abandon`, tick 28390. Full post-hatch cadence remains open. Raw receipts and captures: `test-results/s94-b91high/high-z1-l6/`. Captures have not yet been opened, so no visual conclusion is claimed. The driver's one P2 warning concerns the scripted shelter rest and needs review before promotion to a finding.

The prescribed remote unit suite ran on 46.225.66.90: 105 passed, one skipped, one failed (27 files; 211.2 s inside 240 s). Failure: `tests/tools/test-budget-tools.test.ts:66`, “killed watchdog must reap its process group”. This was not a timeout. No test changes were made. Browser and remote command handles were terminal before this update.

The initial infrastructure diagnosis below is retained as attempt history; its browser/runner blockers are resolved. Remaining gameplay coverage is still open.

## Additional measured evidence

- Opened L6 `campaign-L6-t27060.jpg`: courier at 6 HP under active pressure, objective 189 m away. The run had eight deaths and one driver assist. This first run used default WebGL, so it does not qualify the requested WebGPU pass.
- L7 HIGH zoom 1, explicit WebGPU, completed in 302 s, six deaths, zero assists, no skipped objectives. The driver's `simSeconds: 0` is invalid across handover and is not used. Opened `campaign-L7-t16262.jpg`: crowded combat around vehicles before boarding, HUD Aboard 0/18. Opened `campaign-L7-result.jpg`: L8 loading. Neither frame captures the moving departure, so bus/soldier collision remains unverified. Raw receipts: `test-results/s94-b91high/high-z1-l7-webgpu/`.
- Per-level experience: L6 observed segment was dangerous and repeatedly lethal; post-hatch experience unknown. L7 had sustained fighting and completed without a measured >10 s no-progress interval (maximum 4.82 s); six deaths make it demanding. No confirmed visual defect is assigned from these frames.

Next L7 pass must set `PLAYTEST_L7_DEPARTURE_CAPTURES=1` to retain moving departure frames, which the normal 45 s capture interval missed. HIGH zoom 1.5 and all LOW coverage remain open. No browser/check remains running after these samples.

## Latest passes

| Pass | Evidence | Disposition |
| --- | --- | --- |
| L7 HIGH z1.5 WebGPU | 157 s, zero deaths/assists, completed. Opened timed departure captures at 1.52, 3.07, 8.23 s. Actual quality high, actual/target zoom 1.5 in capture receipts. | No live-soldier/bus intersection visible in these samples. Does not cover every intervening instant. The “wide-z0.8” filename is misleading: receipt reports actual zoom 1.5; excluded as a wide view. |
| L8 HIGH z1 WebGPU, elephant-yard fixture | 54 s, zero deaths/assists, reached 14/14 aboard, approached driver marker from 6 m to 1 m, then departed. Opened tick-2763 14/14 frame and L9 loading result. | Previous 14/14 stall did not reproduce. Hale-alive predicate still requires runtime proof. `simSeconds: -1` invalid across handover, excluded. |
| L8 HIGH z1.5 WebGPU, same fixture | Driver terminated with assertion: requested zoom 1.5, observed target 1. | Unqualified attempt; no zoom-1.5 pass claimed. No code changed. |
| L9 HIGH z1 WebGPU, before-rail fixture | 480 s, zero deaths/assists, rail progressed to evac-point. Ended at “Defense complete · 3/4 at the trucks · 12 m”. Maximum no-progress 139.13 s; active APC stationary at x468.49,z−1.23. | Candidate final-bay stall; needs manual exit/interaction and survivor-state investigation before calling a soft lock. No L10 handover reached. |

Opened L9 tick-27116 frame shows the courier inside the APC at the barrier, crowd outside, 3/4 objective. Driver reports 21 stationary-enemy warnings plus one no-progress warning; these are not 22 distinct confirmed defects. The vehicle barrier/crowd may explain enemy movement; reachability and manual input remain unverified. Per-level experience: L8 boarding moved promptly; L9's final wait was prolonged and confusing under this driver.

[Contact sheet](contact-sheet.jpg) contains four opened source captures: two HIGH z1.5 L7 departure frames, HIGH z1 L8 14/14, HIGH z1 L9 final bay. The generated sheet was also opened.

Raw new evidence resides in `test-results/s94-b91high/high-z1-5-l7-webgpu/`, `high-z1-l8-yard-webgpu/`, `high-z1-5-l8-yard-webgpu/`, and `high-z1-l9-rail-webgpu/`. These are local artifacts. No process/check remains running at this report boundary.

## L9 retry and L10 opening sample

L9 HIGH z1 WebGPU retry from the same rail fixture completed in 214 s. The manual-input watcher submitted **no F input**: the driver advanced without it, so this retry did not reproduce the prior final-bay wait. The automatic P1 `ally-passive` warning names vehicle #667 at 0/1000 HP; the authored L9 vehicle zero-HP floor makes that insufficient evidence of an injured survivor or P1 gameplay failure. The prior 139 s wait remains an intermittent candidate, not a proven soft lock. Raw receipts: `test-results/s94-b91high/high-z1-l9-manual-exit/`. Actual upright L10 pose still needs a live post-load capture.

L10 HIGH z1 WebGPU opening sample: 300 s, ten deaths, zero assists, 409 fire-axe attacks, no skipped objectives. It did not reach the requested Mega hunting encounter. No Mega damage/recovery, ≥60-infected performance, arrivals, rack, knife, molotov or road-crop pass is inferred. The two retained frame entries are loading frames; they cannot substantiate gameplay fps. Raw receipts: `test-results/s94-b91high/high-z1-l10-hunt-webgpu/` including route audit. All processes ended before this update.

[Evidence index](evidence.json) preserves compact run receipts. The coverage ledger below retains the full original scope; cells marked Not run also include incomplete attempts detailed above and must not be read as passed.

## Verdict

**HOLD — no gameplay verdict is possible.** No batch-91 gameplay P1/P2 is confirmed yet; the L9 final-bay stall is a candidate requiring manual confirmation. The prior s88 P1/P2 dispositions describe earlier revisions and are not carried forward as current findings.

### P1 / P2 list

- **Confirmed P1:** none confirmed; no soft-lock claim is made from a bounded driver run.
- **Confirmed P2:** none confirmed; candidate L9 final-bay no-progress (139.13 s) remains under investigation.
- **Open:** all requested QA checks below. In particular, the prior s88 reports of L7 bus/soldier overlap and the L10 Mega damage behavior need fresh batch-91 real-input verification before disposition.

## Attempt and evidence

- Read `docs/qa/po-checklist.md` before QA.
- Verified a clean worktree at `d9db5d49`, matching the requested PROD snapshot.
- `TMPDIR=/tmp MI_BUILD_CACHE=off npm run build` passed. The standard cached build first failed because its shared cache lock is outside the writable worktree (`PermissionError`); disabling that cache produced a fresh production build, and the public-build check passed (21 HTML/JS files, no QA hooks).
- `npm run typecheck` passed.
- `npm run lint` passed.
- `sh tools/remote/run.sh "$PWD" -- npm test` did not run: no healthy Hetzner runner was available, and the remote runner rejected local fallback for this command (exit 69). It was not shortened or replaced with a local run.
- `npm run browser:pool` could not start. With both the default temp path and `TMPDIR=/tmp`, the `tsx` launcher failed to create its IPC socket (`EPERM`). Launching the daemon without the `tsx` CLI avoided that socket but the sandbox denied TCP listen on `127.0.0.1:4329` (`EPERM`). `tools/browser-status.sh` confirmed the pool was unavailable. No browser session or playtest driver was started.
- No captures were produced in the initial sandbox-blocked attempt; later opened captures and sheet are documented above. No code or game-content changes were made.

## Coverage ledger

| Requirement | HIGH | LOW | Disposition |
| --- | --- | --- | --- |
| L6 full cadence after first hatch; attack windows and experience | Not run | Not run | Open |
| L7 bus departure vs soldiers; inspect captures | Not run | Not run | Open |
| L8 boarding through driver handoff with Hale alive | Not run | Not run | Open |
| L9 rail crossing, final bay, handover to L10; bus/courier observations | Not run | Not run | Open |
| L10 every rack weapon by click and key (0/Q cycling, all 14), knife, molotov aiming arc and previous-weapon return | Not run | Not run | Open |
| L10 road crops | Not run | Not run | Open |
| L10 Mega melee/gun damage to ~35%, recovery after ~1 s without hits | Not run | Not run | Open |
| L10 arrival interval, visible sprinter spawns, and 60–70 infected frame time/fps | Not run | Not run | Open |
| Per-level glitches/captures, >10 s stalls, fun/boring/harmless observations | Not run | Not run | Open |

The environment blockers are resolved. Continue executing the specified HIGH zoom 1 and 1.5 passes followed by LOW zoom 1, with the real-input playtest driver and approved checkpoint saves. Record captures only after opening them; then produce the contact sheet and replace this blocked-attempt ledger with measured findings.

## HIGH z1 departure retry

`high-z1-l7-departure`: 300 s, seven deaths, one driver assist, no skipped objectives, incomplete at corridor checkpoint (tick 17811); no timed departure captures were produced. Max no-progress interval 10.801 s. This attempt neither clears nor reproduces the bus/soldier overlap. The previous HIGH z1 completed route remains valid for its narrower route-completion scope. No process remains running.
