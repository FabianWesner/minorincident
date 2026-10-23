# Lessons learned (what worked, what didn't)

A living record, updated after every lane or experiment. Short entries with evidence. Per-lane detail lives in epics-pipeline/agent-scorecard.md (git-ignored); this file holds the durable conclusions.

## QA and regressions
- **Didn't work:** QA that only checked the batch's own changes. The PO found 14 issues in L1–L4 on PROD 13h that bots and Opus QA had passed (10-22). Most were older than 13g. No one had ever compared against PROD.
- **Worked:** the three-layer regression gate (docs/qa/regression-gate.md):
  - The invariant sweep (`qa:invariants`) went red on 7 real game problems on its first run and found the 24 s L8 load.
  - The PO-style QA with a side-by-side against PROD per checklist line (docs/qa/po-checklist.md) gave the first trustworthy verdict.
- **Worked:** every check has to be proven red on a known bug or a deliberately broken fixture before it is trusted. The A/B tool's 13g-vs-13h validation found "zero regressions", which was correct (the bugs predated 13g). Injected regressions were the right proof.
- **Didn't work:** narrow capture matrices. Lanes often captured only WebGPU low at zoom 1 or 1.5. Briefs must demand the full matrix, and the orchestrator opens at least one sheet per visual lane.

## Playtesting with agents
- **Worked:** scripted real-input bots (tools/playtest) for "is the level finishable". Several "stuck" moments turned out to be bot bugs (HUD clicks, held keys, stale rings), so classify bot vs game before fixing.
- **Mixed:** unscripted play by Luna 6 (low effort, fast tier, tools/playtest/live.ts):
  - Text HUD plus a suggested ground click worked for navigation and objectives.
  - It lost every fight, even in turn-based `--step` mode. The aim assist helped, and the PO's tactic ("run away when outnumbered") belongs in the prompt.
  - Turns take 5–10 s real time and 1–2 s in step mode.
  - Verdict: a cheap navigation and clarity tester, not a combat gate.
  - Round 6 (aim assist + the PO's 'run when outnumbered' tactics in the prompt + the click-settle fix, real time): its best run. It cleared 3 of L1's steps (pickup, delivery, the bat step where rounds 2–5 died 7–9 times) with 1 death in 119 actions, turns 1–4 s. It stopped on its own before the 300-action target, so for long runs wrap it in a loop that re-prompts.
- **Harness bugs looked like model failures:** a click that returned before the courier moved read as "NOT MOVING", a HUD arrow was mistaken for a marker, and a time cap counted from server start. Check the harness before blaming the model.

- **Worked (10-23):** a real-input playtest bot now plays the whole game unattended (L1 → credits in 47m30s, WebGPU low zoom 1.5, 50/50 steps, no skips; `npm run playtest -- --levels L1-L10 --no-skip`). It got there by fixing bot gaps (weapon choice, finale range, zoom drift, escort pacing, HUD-covered clicks) rather than game rules, and it surfaced a real controls bug (Q-152).

## Asset creation (characters)
- **Didn't work:** voxel-union surface merging plus reduction (old Alphas); it made blobs. Corpse-only convex shells fixed the shards at low quality but looked terrible up close.
- **Worked:** imagegen concept drafts (Sol) before any Blender work. 4 Alpha and 3 Mega directions, a contact sheet against the current model, and turnarounds for the picks. The PO and orchestrator choose from images, not words.
- **Partly worked:** a Sonnet Blender rebuild from the drafts (clean faceted parts, existing rig). It was clearly better than the blobs but far from the drafts:
  - the fixed rest pose left the arms sticking out;
  - the head came out small;
  - the faceting was too hard.
- **In progress (10-23):** Sol high plus an independent critical judge (a separate codex exec, the same prompt every round, sees only draft, status quo and new renders), finishing only at ≥ 9/10 for every look. Added techniques from the PO's research: silhouette first, same-angle comparison with region-specific fixes, a reusable part library, automated geometry QA. Record the outcome here when docs/reports/alpha-polish/README.md lands.
- **To evaluate:** WAM (geometry DSL) and blender-skills. Check the licence first, then pilot one asset (roadmap).
- **Worked:** the orchestrator looks at the sheets itself. Lanes' own visual verdicts are often too kind ("reads clearly" while hats were 2.5× head width).

## Performance
- **Worked:** metric-driven Sol lanes with a strict before/after, the same budget throughout, and "forbidden shortcuts" spelled out. Examples:
  - L8 load 24 s → 4 s: the cold menu entry used the handover pacing, and the crowd prep did excess work;
  - L6 reload memory 10.6–12 % → 4–6 %: two leaked references;
  - L10 cold-shader freezes 3.7–4.5 s → < 45 ms: light-variant prewarm.
- **Didn't work without a time box:** sub-millisecond p95 chasing. One lane spent hours on 0.2–0.4 ms. Set an acceptance margin up front.

## Orchestration
- **Worked:**
  - `--goal` mode for Sol jobs; they otherwise stop early with uncommitted work;
  - explicit permission boundaries ("driver work 60 min, game changes forbidden");
  - steering messages to order browser/quiet windows between lanes.
- **Didn't work:**
  - more than about 4 browser-heavy lanes at once: the shared quiet slots starve everyone;
  - lanes based on an older batch: the 13g base produced 9 merge conflicts;
  - merging many lanes before running the suite: a merge silently reverted a test list.
- **Watch:**
  - disk: 6+ worktrees plus captures fill 200 GB quickly. Remove each worktree right after merging, check `git status` first, and stop on any uncommitted tracked file (10-22: two changes were lost that way);
  - lanes leave captures in the shared scratchpad and can delete files there;
  - never delete anything under /tmp or /private/tmp without first checking which running lane owns it (10-23: the orchestrator deleted the WAM pilot's clone .git during cleanup). Only delete paths a finished lane created, or paths named in a lane's report.
