# Final gate blocked (2026-10-10 UTC / 2026-10-11 Berlin)

Production `100207ee`, browser assertion revision `78e39cbf`; later commit `f470fcc5` changes documentation only. Main `98e9aa79` was merged before this gate; the closing `git merge main` returned Already up to date (blocked-final-merge.log).

Full remote unit/sim: 962 passed, zero failed, three long batteries excluded. Selected E25 remote suite: 28 passed; fresh typecheck/lint/build passed. The fresh full levels run failed 2/31 (Oak travel, L6 straggler-rejoined); detailed retained evidence is in E27/closure/levels-oak-repeat.

The E25 browser stage, diagnostic Oak browser run and fresh Scene Lab capture run could not acquire either shared browser slot. A stopped shell (PID 44077, STAT T) in the foreign level-transition worktree held both locks via lockf PIDs 69009/8012 for more than 16 minutes. The orchestrator was notified and the owner was asked to release or resume it. No foreign process or lock inode was changed. Own queued runs were cancelled with SIGINT to avoid unattended browser startup.

The final combined performance run was never reached. Earlier checks.json, playwright.json, Scene Lab sheets and perf-after data are historical evidence, NOT a passing gate on this source. Existing inspected captures and earlier measured grip-fix checks are retained with their provenance. Unselected captures, own raw browser traces, own temporary probes and own snapshot worktree were removed.

Both epic statuses remain in-progress. Closure requires diagnosing Oak and the E24-owned L6 failure, fresh 31/31 levels, fresh epic/browser/smoke gates, fresh 23 Scene Lab captures and inspection, and the unchanged-budget combined 16-test performance gate after merging current main.
