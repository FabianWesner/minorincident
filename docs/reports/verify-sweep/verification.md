# Verification execution

Source main `c31833b2539bf74c0d5ff80402a0a13ba36d93de`, own worktree `lane/verify-sweep`. All twelve remote Node selections, their typecheck/lint/build stages, and shared units passed. Browser stages were omitted by instruction; no full fresh browser-verifier pass is claimed.

Heavy work runs exclusively on Hetzner using `sh tools/remote/run.sh "$PWD" --pull docs/reports/verify-sweep/evidence -- sh tools/verify-sweep-temporary.sh`. Each epic uses a copy of the repository `tools/verify.ts` entry with an explicit guard: commands containing `playwright` are recorded with `exitCode: null` and omitted. The original typecheck/lint/build and exact `selectionFor(E<NN>)` Vitest pattern run unchanged. E07/E22 run with one worker; E23–E32 and shared units use the permitted four-worker cap. The timing project remains serial (`fileParallelism: false`, groupOrder 1), before functional work (groupOrder 2). No test threshold or deadline changes. [Exact temporary entry](evidence/verify-sweep-temporary.ts.txt), [driver](evidence/verify-sweep-temporary.sh.txt), [source/runner metadata](evidence/execution.json). The temporary tools files are removed before commit.

This is verification with browser stages omitted, **not** a green full `npm run verify` claim. No browser, local Vitest suite, local build or dev server is started. Browser and native timing are accepted only where the [ledger](ACs.md) names a committed evidence file. Remaining browser/performance work stays partial. Smoke browser evidence is [postmerge-10 final smoke, 16/16](../postmerge-10/evidence/gate-final-smoke-playwright.json); its unrelated lifecycle and zoo clipping reds remain recorded in [the red inventory](../postmerge-10/red-tests.md).

## Fresh results

| Selection | Passed | Failed | Nonselected/skipped | Evidence |
| --- | ---: | ---: | ---: | --- |
| E07 | 356 | 0 | 2801 | [assertions/checks](evidence/E07-summary.json) |
| E22 | 110 | 0 | 3047 | [assertions/checks](evidence/E22-summary.json) |
| E23 | 66 | 0 | 3091 | [assertions/checks](evidence/E23-summary.json) |
| E24 | 39 | 0 | 3118 | [assertions/checks](evidence/E24-summary.json) |
| E25 | 36 | 0 | 3121 | [assertions/checks](evidence/E25-summary.json) |
| E26 | 34 | 0 | 3123 | [assertions/checks](evidence/E26-summary.json) |
| E27 | 36 | 0 | 3121 | [assertions/checks](evidence/E27-summary.json) |
| E28 | 25 | 0 | 3132 | [assertions/checks](evidence/E28-summary.json) |
| E29 | 101 | 0 | 3056 | [assertions/checks](evidence/E29-summary.json) |
| E30 | 129 | 0 | 3028 | [assertions/checks](evidence/E30-summary.json) |
| E31 | 120 | 0 | 3037 | [assertions/checks](evidence/E31-summary.json) |
| E32 | 225 | 0 | 2932 | [assertions/checks](evidence/E32-summary.json) |
| unit | 1620 | 0 | 9 | [assertions/checks](evidence/unit-summary.json) |

Per-epic counts overlap through shared tags/smoke and must not be added as unique tests. The driver continues across targets and ends with an echo: its outer exit alone is not the verdict. Each inner command exit and Vitest JSON above is authoritative. Full raw reports are retained as `evidence/E<NN>-vitest.json.gz` / `unit.json.gz`; ANSI-normalized full logs are adjacent `.log.gz` files.

The Linux plan does not select Darwin-only native E22/E29 stages; those are explicitly evaluated from committed native reports in the ledger. All selected Playwright commands have null exits and a BROWSER OMITTED log entry. Remote builds emit the existing commit-less cache Git-revision diagnostic; build exits are zero, with the actual source commit recorded separately.

## Fresh campaign evidence

- [E31 continuous seed 1](evidence/E31-campaign-seed-1.json): all 9 levels complete; final level 127.733 simulated seconds, 0 deaths. Actual roster/arsenal/vehicle handover assertions passed.
- [E32 continuous seed 1](evidence/E32-campaign-seed-1.json): all 10 levels complete; final level 1574.300 simulated seconds, 0 deaths. Actual roster/arsenal/vehicle/cure handover assertions passed.
- [Standalone L10 complete seed 32](evidence/E32-complete-seed-32.json) retains regional timing. This is complete-policy evidence; no 45–50 minute calibrated novice result is claimed or required as a gate under the supplied decision.
- Fresh L4 complete/newbie/checkpoint JSON and L6 policy/continuous-campaign JSON are also retained in `evidence/`.

## Acceptance and cleanup

E26 is promoted using all 16 met ACs, fresh Node checks/shared units and named committed browser evidence (including the reviewed fixed W0/W5 UI). The other eleven targets remain in-progress because numbered ACs are partial. E32-AC04 gets the requested one-line obsolete-gate spec note; AC21 already contains the accepted PO ~143 s target. No criterion text, test, budget or timeout was weakened. Temporary entry/driver tools are removed; only report/evidence, status and the authorized spec note are committed. No deployment or merge.
