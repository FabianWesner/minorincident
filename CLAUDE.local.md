# Orchestrator playbook: who builds what

Living, self-learning document. After every finished lane: (1) add one line to `epics-pipeline/agent-scorecard.md` (date, lane, model/effort, task kind, outcome, rework needed, note); (2) if the evidence contradicts a routing row below, change the row and say why in one line. Keep this file short; details live in the scorecard.

## Pool
- **Opus 5.5** (Agent tool, model `opus`) — also the orchestrator itself (reviews, merges, decisions, visual/asset QA).
- **Sonnet 5.5** (Agent tool, model `sonnet`)
- **Sol 6.1** (codex-scheduler, `--model gpt-6.1-sol`, effort low/medium/high) — default builder (PO goal 2026-10-07: delegate implementation, Blender, imagegen and QA to Sol).
- **Astra** (codex-scheduler, `--model gpt-6-astra`, effort xhigh) — exception only, when the PO asks or a problem resists Sol twice.
- **Luna 6** (codex-scheduler, `--model gpt-6-luna`) — minor work and mechanical QA.

## Routing (current best guess, evidence in the scorecard)
| Task kind | First choice | Why / notes |
|---|---|---|
| Hard diagnosis: perf traces, root causes, "why does it look/feel wrong" | Sol high | 10-07 (new Mac): Sol found real causes fast — LOD1 double download (load3), arrival fight with the bike collider, 80-tick knockdown from authored displacement, crowd stride changing only the phase denominator, 9 s civilian-corpse cutoff. Opus still reviews the conclusion |
| Character feel: animation, locomotion, combat juice | Astra xhigh for the player; Sol high for crowds | PO asked for Astra on player animation (10-07). Sol skin pilot passed metrics but PO found crouch/turn defects → metrics alone are not enough; review stills/videos at the game camera |
| AI behaviour: perception, herd cue, stuck handling | Sol high (Opus earlier) | Opus was rule-faithful earlier; Sol untested on AI this round |
| Visual QA gates and asset QA | Opus (orchestrator) | Contact sheets, game-camera stills; never trust a lane's own "no visible change" |
| Architecture/perf rework: load pipeline, LOD policy | Sol high | load3: 17.1 → 9.4 s with measured tables; needed steering away from GLB re-authoring and .gz sidecars |
| Scoped systems: mission/HUD/UI, map layout, toys, audio wiring | Sol medium | campaign-foundation, props-barricades delivered with tests |
| Level content (encounters, pacing) | Sol high | l3-content first proposed shrinking the time band to fit a 68 s run → brief must say "add content, never change the band to fit" |
| Merge-conflict resolution, test fixes, docs | Sol medium / Luna | |
| Imagegen (concept sheets, backgrounds, UI art) | Sol (low) | Best image pipeline; PO decision |
| Blender/bpy asset builds, rebuilds, packing | Sol (low/medium) | Never trust Sol's own visual verdict: lod0-diet shipped shredded houses; art-register's generic decimation perforated thin panels (Sol caught it this time). Always independent Opus asset QA before merging |
| Long autonomous multi-step pipelines | Sol | Steady over hours; give a clear end state |
| Game code with a hard, measurable acceptance test | Sol (medium/high) | Give the metric, the forbidden shortcuts and "report genuine bugs, don't work around them" |
| Monkey work: bulk renames, data entry, manifest edits, formatting | Luna | Tight mechanical briefs only. story lane (Luna): delivered the code but skipped runtime measurement when the lock was busy |

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
