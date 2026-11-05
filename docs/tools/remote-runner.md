# Remote runner pool (Hetzner)

The Mac is the bottleneck for heavy tests. `tools/remote/` runs a command for your worktree on Hetzner `cx33` servers
(4 shared vCPU, 8 GB, Ubuntu 24.04, Node 26.0.0, Playwright Chromium + deps, FFmpeg for the existing audio measurements, 4 GB swap), named `mi-runner-1..3`,
all labelled `project=minor-incident`. Each runner has 2 job slots (like `sim-lock.sh`).

Lanes run focused tests plus `npm run test:gate`. The orchestrator runs the full suite plus `npm run test:nightly` once per merge batch. Use the pool for CPU suites (unit, levels and sim; at most four Vitest workers). The deploy browser gate stays local with at most two GPU browsers. Remote SwiftShader browser runs are opt-in through `npm run scene:matrix:remote` and `npm run test:e2e:remote`; the full remote matrix is too slow for the gate. See [deploy gate](../qa/deploy-gate.md).

## Use (lanes)
```sh
# unit / sim / levels
sh tools/remote/run.sh $PWD -- npx vitest run tests/levels/L2.test.ts --maxWorkers=2
# Timing budgets: reserve both runner slots for the measured gate command.
sh tools/remote/run.sh "$PWD" -- bash tools/remote/timing-isolated.sh --whole-run npm run test:gate
# result files back to your worktree (paths relative to the repo root; pulled even when the command fails)
sh tools/remote/run.sh $PWD --pull test-results/playwright/results.json -- sh -c 'npm run build && npx playwright test tests/e2e/smoke.spec.ts --project=chromium --workers=2'
# extra env / paths that are normally not synced
sh tools/remote/run.sh $PWD --env FOO=1 --with epics-pipeline/refs -- <command>
sh tools/remote/status.sh        # servers, slots, queue, load, price
```
* Do NOT wrap in `sim-lock.sh` / `e2e-lock.sh` (they are Mac locks; on the runner the slot limit does that). Use `--maxWorkers=2` / `--workers=2`.
* The exit code is the command's. Output streams live. Dispatch is FIFO across lanes; the queue and local slot appear in `status.sh`.
* If no remote runner has a free slot (or the pool is unreachable), supported CPU suites may use the Mac fallback: `tests/unit`, `tests/sim`, `tests/levels`, `test:gate`, and `test:nightly`. It admits one local job only when no browser reservation/Chrome GPU process or quiet-run is active, load is below 6, and at least 4 GB RAM is free. Vitest commands are capped at four workers and wait for browser/quiet-Mac admission before starting. The known `bash tools/remote/timing-isolated.sh [--whole-run|--all]` wrapper is expanded to its CPU command locally; remote slot locks are unnecessary on the Mac. Other shell wrappers, non-Vitest scripts (including the bot-based `npm run test:levels`), and browser/perf commands are ineligible for Mac fallback. Use direct `npx vitest run tests/levels/...` for focused level tests.
* The Mac uses the worktree argument as its working directory, resolves Vitest from that worktree’s installed dependencies, applies `--env`, and streams the normal Vitest reporters/exit code. `--pull` results are already in that worktree; `--with` needs no copy locally. No dependency installation or browser launch happens on the Mac fallback.
* New files wait whenever a GPU/browser reservation or `quiet-run` starts. Current files finish; the job retains its single local slot and resumes without rerunning finished files. Vitest's public threads-pool API gates each file's run message, including sequential timing projects. Paused coordinators advertise `mi-local-cpu-yielded`; active files advertise Vitest so both quiet-run preflights wait for them to drain. This adapter targets the pinned Vitest 5 API; rerun the focused checks on upgrades.
* Admission uses lane-infra's `tools/browser-busy.sh` when available, including the main checkout's merged helper. Until then it probes the actual legacy locks, pooled GPU/exclusive reservations, and Chrome processes. The RAM threshold counts free physical pages, excluding inactive caches, compressed memory and swap. Unavailable samples refuse admission.
* FIFO tickets live under `$TMPDIR/minor-incident-remote-queue/` (override `MI_LOCAL_QUEUE` only for isolated checks). Dead owners are removed. The head dispatches remote-first, holding its place through sync until actual remote slot admission, or through atomic local slot acquisition. `status.sh` shows each waiting lane and local running/yielded phase with active file count. All lanes must use this runner version and the same TMPDIR for machine-wide FIFO ordering.
* Each admission appends one locked JSON line to `$TMPDIR/mi-waits.jsonl`: `{lane, lock:"remote"|"local", waitMs, ts}`. Wait covers queue entry through slot acquisition, including remote sync. Set `MI_LANE` to name the lane; the default is the worktree basename. `MI_LOCAL_FALLBACK=0` disables only Mac dispatch.
* `timing-isolated.sh` reserves both runner slots in order. Its default mode releases the extra slot when Vitest reaches functional tests. Add `--whole-run` for gate/nightly wall-time measurements so another CPU job cannot distort either the 4/6 ms budgets or the measured duration. Existing jobs finish before admission; locks release when the command exits. Queue/sync time is separate from test execution time.
* Playwright needs a build first: put `npm run build &&` in the command (`dist/` is not synced). Linux uses SwiftShader (no GPU), the config handles that.
* Synced: tracked + untracked-not-ignored files. Not synced: `node_modules`, `dist`, `.git`, `test-results/`, `initial-drafts/`, `experiment/`, `references/`, `drafts-pipeline/`, `epics-pipeline/`, `folio-2025/`, and `assets/**/*.{blend,wav,ogg,mp3,webm,mp4}`. Use `--with <path>` to add one.
* `node_modules` is installed with `npm ci` only when `package.json`/`package-lock.json` changed (cached by hash on the runner, hardlinked into each workspace).
* The remote workspace is a commit-less git repo (index only), because some tests call `git ls-files`. `git log/diff` do not work there.
* Per-worktree sync cache: `/srv/mi/ws/<worktree>-<hash>`. The first sync of a new worktree seeds from the newest cache (hardlinks); later syncs send only changes. The cache is only written by rsync and the manifest update, under a local sync lock.
* Before each sync, `run.sh` removes caches unused for more than 2 hours, then removes oldest eligible caches if `/` has less than 15 GB free, stopping at 15 GB. It protects the cache being synced and caches whose corresponding job directory contains a live process. Set `MI_GC_DRY=1` to print the proposed removals without deleting them.
* Every run gets its own job dir `/srv/mi/jobs/<worktree>-<hash>-<pid>-<time>`: a full `cp -a` of the cache (about 270 MB of source, a few seconds). Parallel runs from the same worktree therefore never write into each other's files. Results (`--pull`) are copied back first, then the job dir is deleted, even when the command fails. Job dirs older than 24 h left by a dropped run are removed at the next sync.
* The job runs detached on the runner (`setsid`, log `<job>.run/log`, exit code `<job>.run/exit`), so a dropped ssh does not kill it. `run.sh` follows the log with a reconnecting loop that resumes at the last byte offset (no duplicated output) and returns the remote exit code; a local SIGINT/SIGTERM kills the remote job.
* ssh and rsync use `ServerAliveInterval=15`, `ServerAliveCountMax=8`. The sync steps (connect, rsync, manifest, job copy) are retried up to 3 times when ssh exits 255; the follow loop retries up to 10 times with backoff. The remote command itself is never retried.
* Never put secrets in the command or `--env`. The runner has no `.env`.

## Pool and scaling
`run.sh` asks `pool.py try` for an already-free slot before doing sync work. Queued remote jobs and actual held slot locks count against capacity, including a single timing job that reserves both slots. When all are busy/unreachable it can admit an eligible local CPU suite; otherwise it waits in the shared FIFO queue. It never scales the pool while waiting. The pool cap is three existing-size runners; there is no limit-increase request. Provisioning remains an explicit orchestrator operation.
Runners other than `mi-runner-1` are deleted after 4 h without any job (`MI_IDLE_HOURS`); `run.sh` triggers that check after every run, and `sh tools/remote/scale.sh watch` does it every 10 min.

Orchestrator commands: `sh tools/remote/provision.sh [name]` (add one), `provision.sh --snapshot` (refresh the base snapshot from mi-runner-1), `sh tools/remote/scale.sh add|reap|watch`,
`sh tools/remote/teardown.sh <name>|--all [--snapshots]`. Pricing: `python3 tools/remote/pool.py cost` (cx33 gross about 0.0162 EUR/h, 10.10 EUR/month per runner; billed hourly, delete rather than stop).

## Setup (already done once)
The API token `HETZNER_API_KEY` is read from the main checkout's `.env` (never printed). SSH key `~/.ssh/mi-runner` (ed25519), firewall `mi-runner-fw` (inbound TCP 22 only),
`~/.ssh/config` has `Host mi-runner` for runner-1 (manual `ssh mi-runner`); the tools use their own ssh options and `~/.ssh/known_hosts_mi-runner`.

## Differences on Linux
* Browsers run SwiftShader, not Metal: slower rendering, `--use-angle=swiftshader` (see `playwright.config.ts`). Visual goldens captured on macOS may differ in pixels; run golden/visual specs on the Mac.
* x86_64 vs arm64: Node/V8 uses its own math library, sim results are expected identical (checked by comparing test results).
* The runner is about 2x slower per job than an idle-ish Mac core (measured: unit suite 122 s vs 60 s, story-bots 166 s vs 74 s with the Mac at load 7), so use it for throughput and to keep the Mac free, not for a single quick run. Very long files (tests/levels/L1.test.ts ran > 60 min at 100% of one core) stay slow either way.

## Focused checks and throughput demo

```sh
python3 -I tools/remote/check.py --unit
# Full focused check (real Vitest fixture files, four-worker cap, GPU lock drain/resume):
sh tools/remote/run.sh "$PWD" -- python3 -I tools/remote/check.py
# In an orchestrator-scheduled idle window, against a worktree with cleanup's gate tags:
python3 tools/remote/benchmark.py <worktree> before test-results/mac-runner-demo
python3 tools/remote/benchmark.py <worktree> after test-results/mac-runner-demo
```

The benchmark runs four complete `test:gate` commands per phase. It holds both slots on each remote runner via `timing-isolated.sh --whole-run` (`RUNNER_SLOTS=2`), disables local fallback for the baseline, then enables it for the comparison. It retains each command, raw log, JSON test receipt, wall time and timestamped admission/finish events. The after phase requires observed overlap of three remote jobs and one local job, corroborated by overlapping test-file intervals in all four Vitest JSON receipts (hosts must have synchronized clocks). Sync, pull, cleanup and gaps while the local job yields cannot establish that proof. A busy Mac is never overridden to manufacture the result. Cancelled or failing attempts return nonzero. Compare equal revision/package hashes and test counts, and report any failures and competing workload alongside wall times.
