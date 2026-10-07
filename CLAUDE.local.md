# Orchestrator playbook: who builds what

Living, self-learning document. After every finished lane: (1) add one line to `epics-pipeline/agent-scorecard.md` (date, lane, model/effort, task kind, outcome, rework needed, note); (2) if the evidence contradicts a routing row below, change the row and say why in one line. Keep this file short; details live in the scorecard.

## Pool and routing rule (PO, 2026-10-07 — binding)
- **Opus 5.5** (Agent tool, model `opus`): complex implementation that needs judgement, and hard bugs (unclear root cause, feel, "why does it look wrong"). Also the orchestrator itself: decisions, merges, deploys, visual/asset QA.
- **Sol 6.1** (codex-scheduler, `--model gpt-6.1-sol`): work with a clearly defined goal and explicit success criteria it can work toward (metrics, test counts, budgets, asset builds with per-LOD budgets, imagegen, Blender).
- **Sonnet 5.5** (Agent tool, model `sonnet`): regular development work and QA.
- **Luna 6** (codex-scheduler, `--model gpt-6-luna`): simple tasks and fine-tuning with a clear goal.
- **Astra and Fable: only when the PO asks for them.**

Before dispatching, classify the task: judgement/hard bug → Opus; crisp goal + success criteria → Sol; regular dev/QA → Sonnet; simple/tuning → Luna. Opus/Sonnet lanes run as Agent-tool subagents in their own git worktree (`isolation: "worktree"`), with the same brief and lane rules as Codex lanes.

## Observations per model (keep updating; evidence in `epics-pipeline/agent-scorecard.md`)
- **Sol 6.1**: strong root-cause finder when given a measurable target (load3, arrive-jitter, combat-feel, crowd-feel found real causes on 10-07). Weak spots: drifts toward changing the target instead of the work (l3-content proposed shrinking the time band; load3 tried .gz sidecars) → briefs must name forbidden shortcuts. Passing metrics ≠ good look (skin pilot crouch/turns) → feel work belongs to Opus or needs game-camera review. Own visual verdicts on assets are not trusted (shredded LODs before; caught perforated decimation itself this time).
- **Luna 6**: delivered code quickly but skipped required runtime measurements when locks were busy, and its "stride lengthening" only changed timing (caused skating) → only for simple, fully specified tasks with a mechanical check.
- **Astra (on PO demand)**: player-anim lane 10-07 — quick, precise diagnosis of the crouch/turn root cause in the shared ground-contact solver.
- **Opus 5.5 (agent)**: excellent on hard bugs/judgement — P0 invisible crowd: WebGPU 8-vertex-buffer limit found and fixed in 34 min with a dual-backend guard; zombie-voice curation with license snapshots.
- **Sonnet 5.5 (agent)**: reliable merge-conflict resolution and post-merge bug fixes (arrive-jitter, crowd-feel, ride contacts), no tolerance loosening.
- **Headless smoke runs WebGL2 only by default — WebGPU-only failures slip through; the crowd-drawn smoke now covers both.
- (older) Opus/Sonnet earlier playbook: earlier playbook rated Opus best at diagnosis, feel, AI behaviour and QA gates, Sonnet fast and reliable for scoped systems with an acceptance check.

## Rules learned (keep short)
- Visual fixes count only with captures the lane looked at and describes in its report. "No capture taken" means not done.
- Quote PO/QA findings verbatim in briefs, never paraphrase them.
- Any visible defect on the player, the companion or a vehicle the player uses is P1.
- Asset outputs from any model go through an independent asset QA (all LODs, game camera) before reaching main. Asset briefs always state triangle/file budgets per LOD.
- Every lane: own worktree on `lane/<slug>` (scheduler `--worktree`), headless only, `tools/e2e-lock.sh` for browser runs, `tools/sim-lock.sh` + `--maxWorkers=2` for heavy Vitest, never deploy; the orchestrator merges.
- Lanes never use `git stash pop` in worktrees (repo-wide stash list). Use a WIP commit instead.
- Git-ignored files (`epics-pipeline/`, `folio-2025/`) are not in worktrees: give lanes absolute paths.
- This Mac (10 cores/16 GB): ~5 heavy lanes is comfortable, 9 works but the shared locks become the bottleneck (E19 verify holds a sim slot for 40+ min). Lanes must release locks between batches and skip redundant full-suite reruns; the orchestrator runs the full unit suite on main after merging.
- Disk is tight: remove a lane worktree (scheduler worktree-remove) right after merging it; keep ≥ 10 GB free (disk guard monitor alerts below 6 GB).
- Tell a lane to stop a slow verification and hand it to the follow-up lane rather than waiting (l1v2-f).
- Bot time bands: never pad, never shrink the band to fit a thin level — add the missing content.
- PROD (minor-incident.com) is the public beta: deploy after each green batch (typecheck, unit, build, smoke) straight to PROD after the orchestrator's own QA. QA env (`BRANCH=qa`) only when the PO must test before a merge (PO rule 10-07). Every deploy gets an entry in `epics-pipeline/deploylog.json` → `deploylog.py` → deploy-log artifact.
- Smoke/verify had no check that crowd figures are actually drawn on screen; a merge made all pedestrians invisible on PROD (10-07). Every crowd/render merge needs a visible-figures guard before deploy.
- Resumed scheduler jobs (`--resume-from`) come back with `sandbox=workspace-write` and cannot run Blender/git staging/localhost listeners: for build lanes re-run fresh (or `codex exec --dangerously-bypass-approvals-and-sandbox` in the lane worktree) instead of resuming (10-07, art-l2l3-qa).
- PO picks the model for the player figure: Fable 5.1 took over from Astra on 10-07 (on demand only).
