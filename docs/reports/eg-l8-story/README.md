# eg-l8-story — L8 sanctuary, breach and escape

Story source: [story-script.md](../../design/story-script.md), written by the orchestrator for the PO on 2026-11-08. `main` was fast-forwarded to `a7b70c78`; the L8 roster caches from `r12-l8perf` are retained.

## Changes

- Nadia starts beside the arriving group and leads a continuous tour along the public paths to the central plaza. All five normal animal species stand near the fences along that route. Children, staff and soldiers remain in the sanctuary population; animal ambience stops at the alarm.
- The objective, Nadia's lines, command-post broadcast, Hale's greeting and warning, elephant dialogue hooks, Hale's keys line and departure caption use the canonical script. No additional courier story lines are introduced.
- After the 60-second calm, a 30-second plaza defence introduces the real tunnel wave. A vested K9 uses the shared tunnel emergence; a separate pond keeper can be grabbed, and the toured flamingo is bitten and transforms through the shared same-ID infection sequence. Converted animals receive a courier pursuit target. Animal boss AI remains for the next lane.
- Hale, Reyes and nearby guards move to the APC. If Sam did not survive the incoming campaign roster or dies during L8, Reyes joins the evacuation group. All required story actors exist before the sanctuary checkpoint.
- The courier covers passenger boarding on foot. Once the passengers are seated, the Mega crosses the north wall in a short camera beat, runs along the east service route and reaches Hale at the APC. Hale gives the keys line and handover gesture before falling; the cab unlocks afterward.
- The Mega uses the explicit `inf.mega-alpha` model so pooled IDs cannot change its face. That body and the current skinned dog load before Begin. The retired rigid K9 contributes its authored police vest, attached to the current dog's displayed body joint; its old body is not drawn.
- Boarding the driver starts an eight-second APC departure through the east gate. The two baked steel leaves open, the Mega follows behind the moving APC, and a shared vehicle camera keeps both visible. The complete living group and arsenal use the existing L8→L9 transport handover.
- Story timers, actor IDs, door state and departure pose are checkpointed. L8-02/03/05 carry the PO date and preserve the population, same-ID transformation, combat, Alpha and concurrency clauses.

## Validation

Game implementation: `2eacf0c5`. Heavy commands use `tools/remote/run.sh` with Mac fallback disabled and one Vitest worker. No browser is launched.

### Full story probes

Both ordinary production-input runs pass with **zero story flags**. No player invulnerability, staged boarding, objective skips or teleportation are used. All eight healthy animals pass within 18 m of the real tour route, and both runs record the canonical calm/breach/keys/departure captions, pond keeper grab, initial north-wall reveal, soldiers firing on the Mega, Hale falling before the courier boards, and the moving gate escape.

| Observation | Low | High |
| --- | ---: | ---: |
| Completion (sim seconds) | 205.13 | 256.07 |
| Courier deaths | 0 | 1 |
| Opening flamingo bite after initial alarm | 19.75 s | 19.98 s |
| Same-ID transformation after bite | 2.92 s | 2.68 s |
| Courier distance at bite | 17.05 m | 17.06 m |
| Peak infected / cap | 90 / 100 | 190 / 200 |
| Scheduled Alphas | 5 | 5 |
| Soldier shots at the Mega | 19 | 31 |
| Living passengers seated at departure | 14 | 14 |

The first sampled Mega pose is `(88, 4.7, -88)` in both runs. The APC finishes at `(146, 80)` and the Mega at `(136, 80)`. Evidence: [low](evidence/story-low.json), [high](evidence/story-high.json), [summary](evidence/story-summary.json). The JSON records the game source hash, original probe digest and raw receipt digest.

The high run's checkpoint retry shifts its final breach timestamp. The archived opening audit instead uses the actual initial Hale alarm at tick 3600: bites at ticks 4785/4799 and both turns at tick 4960. `story-probe.ts` now uses that initial event too, requiring a nonnegative opening interval; the correction changes observation only.

### Per-change and acceptance gates

Typecheck and lint pass on the implementation. The existing mission integration case passes, including the shipped police-vest geometry, tour, real tunnel membership, timed shared bite/turn, Hale handover, driver gating, gate geometry, escape motion and checkpoint restore. The vehicle case passes, including restored driving after L8→L9 transfer.

The first full-suite unit invocation hit the wall-clock watchdog at 246.2 s against its 240 s budget, with no assertion failure reported. The isolated remote rerun of `npm run verify -- E30` **passes**: typecheck 53.878 s, lint 33.876 s, unit command 217.689 s. All 27 unit files pass: **106 tests passed, one skipped**. Test collection remains **150/150 cases, 43/45 files**. Evidence: [verification receipt](evidence/verify-checks.json). No threshold was relaxed.

Native acceptance completes low/high production-input routes, both controlled fixture sets and all six checkpoint/death controls without runtime errors. It exits **1**, reporting one failing level row (`L8-06`) and ten incomplete level rows. Fresh global checks also fail `G-13`, `G-22` and `G-24`; these must not be hidden by the level-row count. Browser clauses remain unchecked. Evidence: [current native clauses and failures](evidence/acceptance-native.json).

`git diff --check` passes. Early diagnostic failures led to the corrected gate cap extraction, dry-shore staging, vault-height ownership and vehicle handover flag. Raw logs remain under `test-results/eg-l8-story-*`.

## Done and open follow-ups

**Done:** the scoped L8 story sequence is implemented using the canonical script, committed in steps, and verified through complete native low/high story runs. The remote typecheck, lint and unit gate passes. The final observation-only initial-alarm guard is committed separately from the game revision used by those runs.

**Open:** acceptance is not green. Per the orchestrator's time-box instruction, these become follow-up lanes:

- `L8-06`: minimum nearby bounded-path reachability is **84.62% low / 81.82% high**, below 90%. Stationary first player attack is **24.25 s / 22.97 s**, above 20 s. Preserve the visible keeper/flamingo opening while repairing the other tunnel approaches.
- `G-22`: the announced tunnel cohort misses its 20-second player-contact clock in complete and stationary routes. High complete also reports fewer than three outlets with six members. The story's animal contact within 30 seconds does not satisfy this separate player-contact rule.
- `G-13`: some evacuation followers fall below the 0.95 individual/group median walking-speed ratio. Keep the existing roster caches while investigating escort movement.
- `G-24`: the shared Alpha eligibility fixture reports a healthy distant Alpha bar as visible. Infected zoo species pass that boundary check; rendered bars still require QA.
- Animal miniboss AI remains the next `eg-l8-bosses` lane; this lane provides the story and transformation hooks.
- Browser presentation, audio and performance remain for the QA lane below. No release-readiness claim is made.

## Browser QA needed

No browsers are run by this lane. The QA lane should inspect low/high at the PO zooms:

- Follow Nadia from the bus: all normal animal species are readable at their lit fences; the path/lion lines, broadcast and Hale greeting have enough reading time; zoo ambience is audible before the alarm and stops afterward.
- Watch the flamingo pond during the opening breach: the K9 exits its tunnel, its police vest fits the moving body and remains with its corpse, and the keeper grab and same-ID flamingo transformation read from the game camera.
- Cover APC boarding: the north-wall reveal clearly shows the Mega; Hale's keys gesture and death stay brief and avoid close gore; the courier can enter the real cab afterward.
- During departure, both steel leaves open before the APC reaches them, the vehicle and complete group cross the east gate, the Mega remains visible behind it, and the exact departure caption can be read.
- Check camera return/skip, checkpoint retry during the story, frame cost at the boarding hold and the unchanged L8→L9 roster/arsenal handover.

No specifications, reference assets or dependencies changed. No deploy or push.
