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

## Verdict

**HOLD — no gameplay verdict is possible.** No batch-91 gameplay finding was confirmed or cleared in this turn. The prior s88 P1/P2 dispositions describe earlier revisions and are not carried forward as current findings.

### P1 / P2 list

- **Confirmed P1:** none assessed on batch 91.
- **Confirmed P2:** none assessed on batch 91.
- **Open:** all requested QA checks below. In particular, the prior s88 reports of L7 bus/soldier overlap and the L10 Mega damage behavior need fresh batch-91 real-input verification before disposition.

## Attempt and evidence

- Read `docs/qa/po-checklist.md` before QA.
- Verified a clean worktree at `d9db5d49`, matching the requested PROD snapshot.
- `TMPDIR=/tmp MI_BUILD_CACHE=off npm run build` passed. The standard cached build first failed because its shared cache lock is outside the writable worktree (`PermissionError`); disabling that cache produced a fresh production build, and the public-build check passed (21 HTML/JS files, no QA hooks).
- `npm run typecheck` passed.
- `npm run lint` passed.
- `sh tools/remote/run.sh "$PWD" -- npm test` did not run: no healthy Hetzner runner was available, and the remote runner rejected local fallback for this command (exit 69). It was not shortened or replaced with a local run.
- `npm run browser:pool` could not start. With both the default temp path and `TMPDIR=/tmp`, the `tsx` launcher failed to create its IPC socket (`EPERM`). Launching the daemon without the `tsx` CLI avoided that socket but the sandbox denied TCP listen on `127.0.0.1:4329` (`EPERM`). `tools/browser-status.sh` confirmed the pool was unavailable. No browser session or playtest driver was started.
- No gameplay screenshots/captures were produced or opened, so no contact sheet is included. No code or game-content changes were made.

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

The next run needs an environment where the browser-pool daemon can bind its configured localhost port and where the configured remote test runner is healthy. Then execute the specified HIGH zoom 1 and 1.5 passes followed by LOW zoom 1, with the real-input playtest driver and approved checkpoint saves. Record captures only after opening them; then produce the contact sheet and replace this blocked-attempt ledger with measured findings.
