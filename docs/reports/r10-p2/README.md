# r10-p2 — L6 exit guidance, downed weapons, L8 opening objective

Baseline: `0ad5a72b`. Delivered game source: `da16c087` (later commits contain proof tooling and this report only). No deploy or push.

## Causes and fixes

- **L6:** the exit gate waited for living followers while the HUD measured distance to the exit ring; the attack banner had neither a persistent follower target nor useful bearing. `LevelSixSubway.regroupTarget` now selects the live alarmed follower, or a remaining follower, while regrouping or standing at the blocked destination. The objective names that survivor and measures their distance. A persistent world/edge cue and minimap pin follow the same entity, including after the temporary attack warning expires. Dead/hidden/non-following actors are excluded. This also handles a blocked courier who has another companion nearby. The fixed exit destination and mission gates are unchanged.
- **L9/shared:** held props were hidden only for `scriptedClip === 'crawl'`. The shared `ActionView` visibility and aiming rule now covers scripted fall/impact/crawl, active knockdown, knockdown/get-up/death animations, and zero health. Standing weapons still render; inventory is retained.
- **L8:** both objective generation and two HUD branches suppressed the opening tracker. The opening now says **Stay with the group** throughout the calm minute. The calm timing and absence of a waypoint remain intact.

E30-AC04 and matching prose previously required *no objective*. Corrected that criterion and its QA contract to follow this brief's explicit opening-objective requirement. No other spec criteria changed.

Game commits: `b0ee6116`, `9962613c`, `0d068b9c`; follow-up cause fixes `a06a3e70`, `43e1b322`, `da16c087`.

## Before/after proof

Run `node --import tsx tools/qa/r10-p2-proof.ts before|after L6|L8|L9`. `R10_DIST` selects a baseline bundle; `R10_REVISION` records its revision. Production HUD is explicitly enabled. Browser: headless Metal WebGL2, 1280×720. Low/high × requested zoom 1/1.5 captures are in `test-results/r10-p2/{before,after}-L{6,8,9}/`; full receipts include route observations, L9 key traces, actual tier/zoom, live target/attachment state and source provenance. L6 device calls are reproducible in the committed harness. Compact retained evidence and hashes: `validation.json`. Full captures and receipts are preserved under `/Users/wesner/Workspace/mi-evidence-archive/r10-p2-da16c087-20261108`, using the original repository-relative paths. The 56 archived capture hashes were verified against the working copies.

The registered production missions use real keyboard/mouse/E input (L6 translates read-only planner advice; L9 follows the authored road using WASD). No actor relocation, population edits, objective skips or simulation timer changes. Courier survival is protected. Route traversal uses fixed ticks; the L9 crash plays on the normal live clock before paused photos. Controlled generic pose fixtures are separately labelled; `R10_POSES_ONLY=1` runs them without repeating the road.

| Check | Baseline | Delivered |
|---|---|---|
| L6 physical early exit run, tick 6586; same scene after six seconds | “Stay with the group · 0 m”, generic attack banner, no named rescue bearing | “Rejoin Marcus · 155 m”, persistent named edge cue, arrow and minimap target ID 16. Following that bearing with keys reduces distance 154.19→152.19 m and the objective updates to 153 m. |
| L8 opening tick 61 and calm end tick 3541; sampled each second | Objective blank and tracker hidden | Tracker visible with “Stay with the group” throughout all sampled pre-breach seconds. |
| L9 real road drive → native impact → crawl | Launcher visible in all four impact captures; crawl hidden | All held attachments hidden during impact and crawl; standing fixture retains weapon. |
| Shared controlled poses | Captured independently from native crash | Knockdown, get-up, death and crawl attachment checks; knockdown visual matrix. |

Opened and reviewed low/high and both requested zoom settings for each before/after comparison. L6 shows a readable named instruction and bearing; L8 shows a readable objective without a waypoint. L9 impact has the baseline launcher and no launcher after the fix. Its authored cinematic camera ignores player zoom until crawl: impact captures record the actual fixed zoom, rather than claiming four different framings. Crawl and HUD scenes exercise actual zoom 1 and 1.5. This physical L9 route renders an idle courier during impact, so the prone body rule is also checked in separately labelled knockdown fixtures.

Invalid exploratory captures (HUD disabled, wrong tracker selector, far-point steering, paused crash animation and cinematic-zoom assertion) are retained under `test-results/r10-p2/attempts/` and excluded from passing evidence. The baseline worktree was removed with `git worktree remove` once its web bundle was preserved; unchanged public assets are shared by that bundle.

## Validation

- `npm run typecheck` and `npm run lint`: pass (final proof-tool check recorded in `validation.json`).
- `npm test`: **107/107 passed**, 27 files; collected repository budget **150/150**, 45.8 s against 240 s cap, after final game commit.
- `npm run build:qa`: pass after final game commit.
- `QA_ACCEPT_ROOT=docs/reports/r10-p2/accept npm run qa:accept -- --level L6|L8|L9 --skip-browser --reuse`: final results below. The custom root prevents new runs overwriting archived review receipts; L6 checkpoint control reads from that same root.
| Acceptance command | Fresh failing level rows | Incomplete level rows | Native/fixture/checkpoint errors | Exit |
|---|---:|---:|---:|---:|
| L6 | 0 | 9 | 0 | 1 |
| L8 | 0 | 10 | 0 | 1 |
| L9 | 0 | 8 | 0 | 1 |

Full raw acceptance output is archived under `docs/reports/r10-p2/accept/` within the artifact root; a working copy is retained at `test-results/r10-p2/accept-delivered/`. Hashes and policy outcomes are in `validation.json`.

`npm run qa:threat -- --maxWorkers 4 --out test-results/r10-p2/threat-quiet`: **PASS, zero flags across all ten levels**, 163.6 s audit / 166.1 s budget wrapper (600 s cap), exit 0. L6/L8/L9 each have zero level and passive flags. Earlier full runs hit the 600 s limit under CPU contention; the targeted diagnostic also had zero level flags but intentionally exits 1 for partial level selection. Those attempts are retained in `validation.json`; thresholds and the time cap were unchanged.

### Acceptance limits

These commands do not establish full level acceptance. The final commands have no fresh failing level-specific rows; skipped visual/performance rows remain incomplete. The global failures include **G-22** in L6 and **G-24** across these levels. G-22 reports two-member L6 announcement cohorts and late first attacks. A fresh baseline L6 low/complete run has the exact same final native hash (`98ec0b82`), threat observations and acceptance observations as the delivered run (`baseline-L6-native.json`), establishing this as inherited behavior. A pristine far-away Alpha gets a mandatory bar in unchanged baseline `HealthBars.ts`, while G-24 expects it hidden. `baseline-bars.json` reproduces that behavior from `0ad5a72b`; neither the renderer's health-bar rule nor its acceptance fixture was changed. Historical stale reviews and skipped browser/performance rows remain visible in the generated report.
