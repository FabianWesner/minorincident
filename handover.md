# Handover: Minor Incident (2026-10-07, ~10:45)

## Where things are
- **Game:** "Minor Incident", an isometric zombie action RPG in the browser. TypeScript, Vite, three.js WebGPU with WebGL2 fallback, Rapier, deterministic sim in `src/sim`.
- **Specs:** in `specs/`, starting with `specs/README.md`. Repo rules are in `AGENTS.md`.
- **PROD (public beta):** https://minor-incident.com (www → apex). Cloudflare Pages project `minor-incident`, branch `main`. Deploy with `epics-pipeline/deploy.sh <key>`.
- **QA / experiments:** https://qa.minor-incident.com, Pages branch `qa`, behind Cloudflare Access with the PO's email OTP. Deploy with `BRANCH=qa epics-pipeline/deploy.sh <key>`. Headless agents use the public alias https://qa.minor-incident.pages.dev.
- **Last PROD deploy:** `L1v2-beta3` (d45e2151).
- **Main since then (not deployed yet):**
  - new two-wheel bike model
  - pause bar centred
  - see-through holes, including the smoke
  - pushable props
  - skating fix
  - Sol asset repairs (fire station, LODs)
  - LOD policy
  - clear ending, bubble timing and walk-cadence fix
  - favicon
  - robust L1 bots
- **Main is red on 2 tests, both lane F's:**
  - `tests/unit/assets/courier-bike.test.ts`: saddle is 0.39 m off.
  - Smoke S-02 in `tests/e2e/controls-playtest.spec.ts`: click-to-move stops 1.7 m short near the new bike start.
  - Fix these before the next PROD deploy.
- **GitHub (`git@github.com:FabianWesner/minorincident.git`) was unreachable from the old Mac (DNS) since about 04:00.** Main is 127+ commits ahead of origin, so push from the new Mac. Everything is also in the transfer package `~/Desktop/minor-incident-handover/`, as a git bundle of all branches plus the git-ignored working files.

## Moving to the new Mac
1. Copy `~/Desktop/minor-incident-handover/` over.
2. Clone or fetch from the bundle: `git clone minor-incident-all.bundle suburban-survivors`, then `git remote set-url origin git@github.com:FabianWesner/minorincident.git` and `git push origin --all`.
3. Restore the git-ignored files from `ignored-files.tgz` into the repo root:
   - `epics-pipeline/`: logs, deploy log, QA reports, PO findings with screenshots, briefs, overview generator
   - `CLAUDE.local.md`: the orchestrator playbook
   - `.env`: Cloudflare token, secret. Keep it private.
4. Restore the Claude memory with `claude-memory.tgz`: extract it to `~/.claude/projects/<new-project-path-slug>/memory/`. The path slug changes with the folder location.
5. Run `npm ci`, then `npx playwright install chromium`. Blender must be at `/Applications/Blender.app`. Codex CLI is needed for Sol/Luna (codex-scheduler skill in `~/.claude/skills/codex-scheduler`).
6. Check: `npm run typecheck && npm run test:unit && npm run build`.

## Lanes (branch `lane/<slug>`; worktrees under `.claude/worktrees/` are not needed, recreate them)
| Lane | Owner model | State | Next |
|---|---|---|---|
| l1v2-f (bike/toys/corgi) | Sonnet | WIP: saddle test, smoke S-02, bike stall at the rack (-68.1, 7.6), depot parking | make main green, then deploy |
| story (feel/story/animation) | Opus | merged; WIP: cadence cap for civilians, infected and corgi | measure head-bob per figure, cap cadence |
| load3 (load time) | Opus | WIP: stopgap removed; phone 4G cold regression 9.4 s → 17.8 s | bisect download growth |
| skin-pilot | Opus | WIP: skinned courier (Mesh2Motion CC0 rig and clips, AnimationMixer, `?skin=1`) | finish courier → A/B video → deploy to QA → **ping PO** → corgi |
| asset-fix-2 | Sol (codex, low) | WIP: LOD budgets (houses LOD1 ≤ 12k / LOD2 ≤ 4k tris, vehicles LOD1 ≤ 6k / LOD2 ≤ 2k) | finish → independent Opus asset QA → merge |
| l1v2-a/c/d/e, w-world, bots, favicon, home-art, bike-model, asset-fix, lod-policy | — | merged | — |

## Open PO findings (full list: `epics-pipeline/po-qa-findings.md`)
- **Figures look robotic and puppet-like.** The skin pilot is the answer. The figure look should move closer to `initial-drafts/living-civilians-and-story-npcs.png`.
- **Rider hands and feet on the bike.** Covered by the skin pilot's ride clip.
- **Level length.** Bots take about 100 s against the 4–6 min target. Deliberately not padded; the PO judges it in play.
- **Sound quality.** A second pass may be needed once the PO has listened.

## How we work (details in CLAUDE.local.md + memory)
- **Roles:** the orchestrator (Claude) delegates, decides architecture, merges and deploys.
- **Who builds what:**
  - Opus: diagnosis, feel, AI, QA and performance
  - Sonnet: scoped systems
  - Sol 6.1: imagegen, Blender, long pipelines, and code with a hard metric
  - Luna: monkey work
- **Scorecard:** every finished lane adds a line to `epics-pipeline/agent-scorecard.md`.
- **Lane rules:** each lane works in its own worktree. Headless only. `tools/e2e-lock.sh` for browser runs, `tools/sim-lock.sh` with `--maxWorkers=2` for heavy Vitest. No `git stash pop` in worktrees.
- **Deploying:** PROD after every green batch (typecheck, unit, build, smoke). The deploy log artifact is updated per deploy: https://claude.ai/artifact/59XdYbBp9YqPLb36wG73qv. The project overview artifact is https://claude.ai/artifact/Nd6ixELcJKtAC7NBgvb9gU.
- **Assets:** Sol asset output always gets an independent Opus asset QA, and briefs state per-LOD budgets.
