# Remote runner pool (Hetzner)

The Mac is the bottleneck for heavy tests. `tools/remote/` runs a command for your worktree on Hetzner `cx33` servers
(4 shared vCPU, 8 GB, Ubuntu 24.04, Node 26.0.0, Playwright Chromium + deps, 4 GB swap), named `mi-runner-1..4`,
all labelled `project=minor-incident`. Each runner has 2 job slots (like `sim-lock.sh`).

## Use (lanes)
```sh
# unit / sim / levels
sh tools/remote/run.sh $PWD -- npx vitest run tests/levels/L2.test.ts --maxWorkers=2
# result files back to your worktree (paths relative to the repo root; pulled even when the command fails)
sh tools/remote/run.sh $PWD --pull test-results/playwright/results.json -- sh -c 'npm run build && npx playwright test tests/e2e/smoke.spec.ts --project=chromium --workers=2'
# extra env / paths that are normally not synced
sh tools/remote/run.sh $PWD --env FOO=1 --with epics-pipeline/refs -- <command>
sh tools/remote/status.sh        # servers, slots, queue, load, price
```
* Do NOT wrap in `sim-lock.sh` / `e2e-lock.sh` (they are Mac locks; on the runner the slot limit does that). Use `--maxWorkers=2` / `--workers=2`.
* The exit code is the remote command's. Output streams live. If all slots are busy the call waits (queue).
* Playwright needs a build first: put `npm run build &&` in the command (`dist/` is not synced). Linux uses SwiftShader (no GPU), the config handles that.
* Synced: tracked + untracked-not-ignored files. Not synced: `node_modules`, `dist`, `.git`, `test-results/`, `initial-drafts/`, `experiment/`, `references/`, `drafts-pipeline/`, `epics-pipeline/`, `folio-2025/`, and `assets/**/*.{blend,wav,ogg,mp3,webm,mp4}`. Use `--with <path>` to add one.
* `node_modules` is installed with `npm ci` only when `package.json`/`package-lock.json` changed (cached by hash on the runner, hardlinked into each workspace).
* The remote workspace is a commit-less git repo (index only), because some tests call `git ls-files`. `git log/diff` do not work there.
* Workspaces live in `/srv/mi/ws/<worktree>-<hash>`; the first sync of a new worktree seeds from the newest one (hardlinks), later syncs send only changes.
* Never put secrets in the command or `--env`. The runner has no `.env`.

## Pool and scaling
`run.sh` asks `pool.py pick` for the runner with a free slot (least busy first). If all are full it queues; after 5 min of waiting (`MI_SCALE_WAIT`)
it creates another (cap 4, `MI_MAX_RUNNERS`), from the base snapshot when one exists (about 1 min) otherwise from a fresh Ubuntu image + `cloud-init.yaml` (about 4 min).
Runners other than `mi-runner-1` are deleted after 4 h without any job (`MI_IDLE_HOURS`); `run.sh` triggers that check after every run, and `sh tools/remote/scale.sh watch` does it every 10 min.

Orchestrator commands: `sh tools/remote/provision.sh [name]` (add one), `provision.sh --snapshot` (refresh the base snapshot from mi-runner-1), `sh tools/remote/scale.sh add|reap|watch`,
`sh tools/remote/teardown.sh <name>|--all [--snapshots]`. Pricing: `python3 tools/remote/pool.py cost` (cx33 gross about 0.0162 EUR/h, 10.10 EUR/month per runner; billed hourly, delete rather than stop).

## Setup (already done once)
The API token `HETZNER_API_KEY` is read from the main checkout's `.env` (never printed). SSH key `~/.ssh/mi-runner` (ed25519), firewall `mi-runner-fw` (inbound TCP 22 only),
`~/.ssh/config` has `Host mi-runner` for runner-1 (manual `ssh mi-runner`); the tools use their own ssh options and `~/.ssh/known_hosts_mi-runner`.

## Differences on Linux
* Browsers run SwiftShader, not Metal: slower rendering, `--use-angle=swiftshader` (see `playwright.config.ts`). Visual goldens captured on macOS may differ in pixels; run golden/visual specs on the Mac.
* x86_64 vs arm64: Node/V8 uses its own math library, sim results are expected identical (checked by comparing test results).
* The runner CPUs are shared vCPUs and slower per core than the Mac when the Mac is idle, but unaffected by the Mac's load.
