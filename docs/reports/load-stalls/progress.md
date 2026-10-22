# P1-107 scene-loading investigation — work in progress

- Baseline runtime `9698a393c`; build/source identity in `evidence/before-build.json`. Final performance acceptance is still outstanding.
- Quiet L1 baseline, 20 fresh profiles/config: GPU low median/p90/max 2.459/2.511/2.561 s; high 2.485/2.559/2.593 s; GL low 2.642/2.719/2.743 s; high 2.627/2.686/2.773 s. Original 10–16 s L1 outlier has not recurred.
- Quiet diagnostic L8 reproduces 24.490 s: 17.708 s scene assembly (17.256 s infected-crowd), 6.177 s warm-up; retained raw profile/trace in `evidence/diagnostic-L8/`.
- L8 unnecessarily used the live-handover pacing on cold menu entry; L8/L10 also prepared unused catalogue creatures and duplicate pedestrian batches already drawn by CivilianCrowd.
- Candidate keeps live L7→L8 pacing, uses foreground compilation for cold entry, and prepares every L10 future encounter, dog coat and Alpha/Mega look. Actual GPU driver draws/fences and alternate-light warm-up remain in place.
- Targeted preparation tests: 23/23 local pass (previous 22-test candidate also passed remotely). Revised remote typecheck/lint/build and final full suite are running; browser admission is queued.
- Baseline remote suite: 2,423 pass, 3 fail (stale lighting-preview HTML expectation now fixed; asset-validation and L9 navigation timeouts). Final full suite, smoke and L10 replay remain outstanding.
- `evidence/matrix.sh` pairs before/after per configuration under ≤20-minute quiet reservations; candidate samples include ten seconds of real movement. Budget/gate are in `docs/qa/regression-gate.md` and `tools/perf/cold-load-time.ts`.
