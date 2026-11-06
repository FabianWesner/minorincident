# fix70-s — follower pace over seeds 1–3

Base: `479a75c`. The 0.95 ratio, ten walking samples, population, timing and collision criteria are unchanged. L5/L7 pace in `qa:accept` (G-13, L5-08, L7-09) and both moving/passive L5/L7 pace in `qa:threat` now vote **per follower and phase** over seeds 1–3. Two qualified seeds are required; a pair fails only if at least two qualified seeds fail. Different followers/phases cannot combine into a failure. Moving routes must complete; passive routes may reach their unchanged observation budget. Insufficient/invalid samples cannot vote. Named threat coverage still fails when fewer than two seeds qualify. Each receipt retains per-seed sample counts, medians, group medians, ratios and route validity. The existing gate-tools test pins these boundaries within the unchanged 150-case budget.

## L7-09 motion repair

Before repair, high follower 71 fails departure on both valid seeds: **32.59% / 24.09%** of its group median. Read-only traces reproduce canonical final state hash `f06f7bb3`. Around ticks 4800–5070, followers 68/71 become mutually blocked at the inherited bus approach: navigation requests 5.2 m/s while resolved movement falls toward zero. Their physical contact witnesses identify each other.

The final fix extends the existing L7 departure collision-response reset from a solid corpse to a following body. When the final collision transaction rejects a requested step, the next step starts from the actual resolved velocity and zero accumulated acceleration. It retains the existing ≤0.12 m/s stalled-motion threshold, phase guard, body radii, sweeps and movement caps. Corpse routing and ordinary formation behavior are unchanged.

Follower 71's final high departure ratios are **100.11% / 100.18%** on seeds 1/2; neither fails. Low/high stationary far-follower upper bounds are **0.31% / 3.00%**, below the unchanged 10% ceiling. High seed 3 remains an explicitly invalid `tick-budget` route, as before; it is not a passing vote.

Rejected trials remain under `trials/`: a living-body arc detour cleared the high pace failure but raised low waiting to **29.13%** (original **5.60%**), producing the sole flag in a complete 559-second audit. A 30-tick approach guard restored the original high failure, and restricting arcs to departure retained the low waiting regression. The final branch removes those detour changes and uses resolved contact momentum instead.

## Measured results and open work

| Scope | Low | High | Remaining |
|---|---|---|---|
| L7-09 / G-13 human pace | PASS; all three routes complete | PASS; seeds 1/2 complete, seed 3 invalid | Whole L7-09 still needs rendered bar and crowd-orientation coverage. High seed-3 native completion remains unresolved. |
| L5-08 / G-13 human pace | PASS | **FAIL**: follower 28, `step/look`, ratios **98.14% / 94.13% / 90.15%** | Two genuine failing seeds are retained; the brief requests a game repair specifically for L7. |
| Whole L5-08 | FAIL | FAIL | The existing low calm straight-walk distance tolerance also fails. |
| Whole G-13 | Open | Open | L5 high fails; all-level pace/wait coverage is not established by this two-level run. |

Both full L5/L7 native acceptance groups are rerun after the game change, at both qualities and both policies, including fixtures and independent checkpoint controls. Their command exits remain nonzero for the documented failures/incomplete compound rows. The level JSON reports and canonical receipts carry the measurements. Shared ten-level status/index files are restored to base because this is a two-level qualification.

No new rendered captures or performance timings are produced; the numeric simulation traces are retained compressed. No bar, orientation, frame-time or full-row visual PASS is inferred from these measurements.

## Extra-seed observation controls

These collector controls were recorded on the `b1f39ca` game candidate, before the final contact-response repair. Their simulation and pace collection modules are byte-identical in the final game qualification; only report presentation text changes the observer fingerprint ([module hashes](validation/collector-module-parity.json)). They prove collector equivalence, not final-game acceptance. The source guard deliberately rejects other game revisions.

The primary seed retains the full threat observer. Extra seeds 2/3 run in at most two isolated Node processes, honoring the existing `qa:threat --maxWorkers=1|2` cap; the default is two and each pair waits for actual process exit. The full audit schedules independent levels across that same two-worker cap; each level worker runs extra seeds serially. Single-level diagnostics can use the two isolated extra-seed workers. The parent waits for child exit, validates each receipt and preserves every real flag; single-level diagnostic markers are removed only after all ten independent level receipts qualify. Extra follower seeds omit unused independent path/reachability queries while preserving phase discovery, every simulation tick and every pace sample. [Nine isolated-worker controls](pace-controls.json), backed by the [serial observer controls](pace-controls-serial.json), compare all pace rows and final state hashes: seeds 2/3 at both qualities for L5/L7, plus a full **1200-second** L5 passive seed with both observer modes. All are identical; passive state hash is `2f103578` in both modes. The full-observer inputs are archived under `before/*-full-observer.json.gz`. The diagnostic `tools/qa/accept/fix70-pace-control.ts` requires the recorded game source and retained baseline inputs.

The [first threat attempt](validation/threat-attempt-1.json) is rejected: reservation cooling reduced the ten-minute pool lease to 463 seconds of execution and cancelled the audit during L5's last extra passive seed. It never produced a full gate result. A concurrent unwrapped foreign threat job was also present. The final qualification uses the direct native command requested by the brief, with all other owned checks stopped and admission load below 6. The browser pool is unnecessary for this simulation-only command. A [third attempt](validation/threat-attempt-3.json) also times out at 600.6 seconds during L5 after the host load rises; it has no complete result. The final runner schedules independent levels within the existing two-worker cap. Neither the 600-second QA budget nor any game/observation window is increased or shortened.

## Inherited architecture checker correction

The first full unit gate finds that unchanged `Save.ts` imports the synchronous MIT fflate codec added by `7bd7cdf`, while the unchanged architecture checker permits only Three math and Rapier. [Baseline hashes](validation/architecture-baseline.json) (including the red gate receipt) establish this pre-existing mismatch. The checker now permits only `gzipSync`, `gunzipSync`, `strFromU8`, `strToU8`, and only in `Save.ts`; asynchronous/Worker APIs remain disallowed. The save codec already uses `mtime: 0`. Save and performance implementation are unchanged.

## Reproduction

```sh
npm run qa:accept -- --level L5 --reuse --skip-browser
npm run qa:accept -- --level L7 --reuse --skip-browser
npm run typecheck
npm run lint
npm test
# Alone in this lane, after host load falls below 6 (native simulation; no browser):
npm run qa:threat -- --out test-results/fix70-s/threat-final
```

## Verification and blocker

**BLOCKED: the final ten-level qa:threat gate needs a quiet shared-host window. The goal is not yet complete.** Typecheck and lint pass; **107 unit tests / 27 files** pass (63.8 seconds), within the unchanged suite budget (**150 cases / 43 files** collected).

The [fourth attempt](validation/threat-attempt-4.json) admits at load **5.953**, with all other owned checks stopped, then times out at **601 seconds** as foreign browser/QA work raises host load to 16–25. L1–L4 and L6 finish with zero gate flags; L5/L7 are unfinished. Raw skilled diagnostic flags remain in the archived measurements. Diagnostic leaf reports retain their partial-selection marker; no complete root gate is produced. The [four completed serial/parallel controls](validation/scheduling-controls.json) have identical native states, runs, observations and flags. This is not a ten-level PASS. The earlier complete audit concerns the rejected detour candidate and has one real wait flag.

Final game source is `9de16662e41eb6614f7957f1aa2b2d6c38fd02573fcbcccfa25c29b2bc27b562`; observer is `776d002a65f523d5788bf8af20dd37363e1322599008866c36f94f93fef4781c`. Both fingerprints are unchanged through the last attempt. Rule commit `09bf2e1`; final motion repair `886e189`; bounded scheduling `e8c23d9` / stale-receipt guard `70dd70f`.

[Validation receipts](validation.json), [acceptance summary](acceptance-summary.json), and [artifact SHA-256 manifest with observations](evidence-manifest.json). All owned checks have exited. No push or deployment.

**NEXT:** hold foreign heavy QA/browser work for a quiet verification window, wait for load below 6, and run the full native command above. It must finish all ten levels with zero flags within the unchanged 600-second budget. L5 high pace, L7 high seed-3 completion, and rendered L7-09 clauses remain open as listed above.
