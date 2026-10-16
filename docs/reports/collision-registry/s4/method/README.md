# Reproduce the measurements

The production CPU profile entry point is `tools/perf/zoo-s2-profile.ts`. Run it on an isolated Hetzner job and pull its output; it profiles only the original 600 measured high-cap Zoo S2 ticks. CPU profiling is attribution evidence, with overhead, rather than the acceptance measurement.

`pose-trial.py` is the exact private-copy transformation driver used for the paired pose-only and pose/copy trials (`--copy`), followed by the 53-check functional selection. It is retained as a record of the experiment; the resulting implementation now lives in `src/sim/world/SolidRegistry.ts`.

`vitest-profile.py --isolated` instruments the unchanged Zoo S2 tests in a private remote copy with CPU/phase timers. Its results are explicitly instrumented and were collected for attribution. Without `--isolated` it targets the complete timing project; the initial attempt did not reserve both runner slots within its five-minute admission bound and produced no profile.

For the successful three-pair main comparison, copy `horde.ts` and `main-pair.py` back to their recorded scratch paths `tools/perf/collision-s4-horde.ts` and `tools/perf/collision-s4-pair.py`, then create the baseline archive:

```sh
git archive 3883a1679 src layouts tests/fixtures tools/performance/sim.ts \
  public/assets/layouts/D-SUBWAY.layout.json public/ui/home/placeholders.json \
  > tools/perf/collision-s4-main.tar
sh tools/remote/run.sh "$PWD" --pull test-results/collision-s4-main-pair -- \
  bash tools/remote/timing-isolated.sh python3 tools/perf/collision-s4-pair.py
```

The driver copies the exact same measurement helper into both source trees. It keeps seed 1, all 100/200 living/visible actors, 120 warmup ticks and 3600 measured ticks, three alternating main/head trials and the ratio of median p95 values. No trial is dropped. Remove these scratch files afterward; they are not runtime dependencies.

## Final full-project acceptance and numeric separation cache

`coordinate-before.txt` is the separation implementation at `231637509`; `coordinate-after.txt` is exactly `src/sim/ai/CharacterSeparation.ts` at retained `3714fe54e`, SHA256 `c3af33b72870ff263b0addf793a6ba6b81fabdeb71c2187babaf8ba1642dfaa0`. The latter caches synchronized numeric X/Z and the active contact row. `coordinate-source.txt` and the source files alongside each trial preserve the intermediate variants. The replay compares that final separation change, not the intentional earlier corgi/Mega QA behavior changes.

Restore the selected driver and its source snapshots to the `tools/perf/collision-s4-*` paths referenced inside it before remote synchronization. `candidate-gate.py timing test-results/collision-s4-candidate-timing/tests.json tests/unit tests/sim` writes the exact committed candidate bytes in the private runner copy, records their hash and runs **all** unmodified timing-project files. It copies both original Zoo result JSONs before restoring the private file. The functional counterpart was run directly with `npx vitest run tests/unit tests/sim --project=functional --maxWorkers=4 --reporter=default --reporter=json --outputFile=...`. These projects are disjoint by the unchanged Vitest config.

`coordinate-cache-trial.py`, `coordinate-row-trial.py` and `separation-cache-trial.py` preserve every alternating pair. `state-compare.py` invokes `state-trace.ts` against the before/after source bytes, records complete per-tick state hashes and event sequences for classic/mixed, 100/200 actors, seeds1/2, 720ticks each. The transient mixed-200 pending admission is retained on both sides. `full-context-profile.py` profiles the original measured high window while running the complete timing project; use its monotonic microsecond bounds in `measured.json` to select the profile samples. Inspector overhead is never used as the 4ms acceptance value.

The cache/proposal/array experiment drivers and private source snapshots are historical records. Re-running one temporarily edits **only the immutable private runner job** and restores it afterward. They are deliberately kept under this report, not in the runtime/tool search path. They do not add test skips or modify assertions, fixture counts or thresholds.

The latest baseline horde comparison is `evidence/main-pair-371/summary.json`. Older `evidence/main-pair.json` refers to the earlier ffdd source. Both use main3883a1679 and the identical helper on both sides; absolute milliseconds from separate hosts/batches are not cross-compared. The relative acceptance uses the median p95 ratio of the three matched main/head pairs within its own batch.

## Browser provenance

The canonical gate watcher only copies changing JSON reports, preserving smoke, matrix and final browser results before later Playwright invocations overwrite `test-results/playwright/results.json`. The exact script, complete log and stage JSONs are retained in the final gate evidence. The focused matrices use the original catalog driver on both backends; their independent indices and all72 metric/sheet pairs are retained. `opened-captures.json` records the48 requested sheets actually opened, plus the final native phone images.

Native timing uses the existing quiet-run wrapper with a temporary nonblocking `lockf` shim and a1,140second owned process-group deadline. Its final log records225.47seconds and exit0; all four locks release on process exit. Final artifacts use phase `collision-s4-final-371` to separate them from earlier trials. The original13tests retain their four explicit manual skips; physical-phone and manual WebGPU timings are not invented from native Chromium proxies.

Large raw E18 core state/counter JSONs are stored losslessly as `.json.gz` to keep the evidence diff readable. `e18-core/artifacts/compressed-index.json` records each original filename, byte count and SHA256. Read with `gzip -dc <file.json.gz>`; all original fields and samples are retained. Summary/result JSON and the two baseline heap arrays remain directly readable.
