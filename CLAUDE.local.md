# Orchestrator playbook: who builds what (local, not committed)

Living document. Update it after every lane result: add the outcome to `epics-pipeline/agent-scorecard.md`, and change the routing below when the evidence says so.

## Pool
- **Opus 5.5** (Agent tool, model `opus`)
- **Sonnet 5.5** (Agent tool, model `sonnet`)
- **Sol 6.1** (codex-scheduler, `--model gpt-6.1-sol`, effort low/medium/high)
- **Luna 6** (codex-scheduler, cheap; monkey work only)

## Routing (current best guess, evidence in the scorecard)
| Task kind | First choice | Why / notes |
|---|---|---|
| Hard diagnosis: perf traces, root causes, "why does it look/feel wrong" | Opus | Found the real causes tonight: shader compile at flicker, stuck Shift, 1600-step route budget, LOD1 near batches |
| Character feel: animation, locomotion, combat juice, story beats | Opus | Strong at authoring clips plus game-camera review |
| AI behaviour: perception, herd cue, stuck handling | Opus | Rule-faithful (sight-only kept), writes good sim tests |
| Visual QA gates and asset QA | Opus | Honest severity and evidence; but re-check that every visual P2 is re-tested |
| Architecture/perf rework: load pipeline, LOD policy | Opus | Measured tables, safe staging |
| Scoped systems: mission/HUD/UI, map layout, toys, audio wiring | Sonnet | Fast and reliable when the brief has an acceptance check |
| Merge-conflict resolution, test fixes, docs | Sonnet | Cheap and accurate |
| Imagegen (concept sheets, backgrounds, UI art) | Sol (low) | Best image pipeline; PO decision |
| Blender/bpy asset builds, rebuilds, packing | Sol (low/medium) | PO decision. Never trust Sol's own "no visible change" verdict: lod0-diet shipped shredded houses/vans. Always follow with an independent Opus asset QA before merging |
| Long autonomous multi-step pipelines (asset batches, packing, sweeps) | Sol | Steady over hours; give a clear end state (goal mode) |
| Game code with a hard, measurable acceptance test (N/N seeds, perf number, test suite) | Sol (medium) | Trial 10-07: bots 20/20 + 20/20, no rule bending, found a real bug. Give it the metric, the forbidden shortcuts and "report genuine bugs, don't work around them" |
| Game code where judgement or feel decides (no crisp metric) | Opus | Sol untested there |
| Monkey work: bulk renames, data entry, manifest edits, log/report formatting, moving files | Luna | Cheapest; tight, mechanical briefs only |

## Rules learned (keep short)
- Visual fixes count only with captures the lane looked at and describes in its report. "No capture taken" means not done.
- Quote PO/QA findings verbatim in briefs, never paraphrase them (the rider-on-box fix was misread as "bike oversized").
- Any visible defect on the player, the companion or a vehicle the player uses is P1.
- Asset outputs from any model go through an independent asset QA (all LODs, game camera) before reaching main. Sol asset briefs always state triangle/file budgets per LOD (unbudgeted "clean LODs" came back 5–10× heavier).
- Every lane: own worktree on `lane/<slug>`, headless only, `tools/e2e-lock.sh` for browser runs, `tools/sim-lock.sh` + `--maxWorkers=2` for heavy Vitest (sim/levels/full unit) — 6 parallel lanes without it hit load 154 on 10 cores, never deploy; the orchestrator merges.
- Lanes never use `git stash pop` in worktrees: the stash list is repo-wide, so a pop can apply another lane's entry (seen 3× on 10-07). Use a WIP commit instead.
- PROD (minor-incident.com) is the public beta: deploy after each green batch (typecheck, unit, build, smoke). Use `BRANCH=qa` only for experiments the PO should try.
