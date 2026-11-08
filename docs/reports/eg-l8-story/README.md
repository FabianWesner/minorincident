# eg-l8-story — L8 sanctuary, breach and escape

Story source: [story-script.md](../../design/story-script.md), written by the orchestrator for the PO on 2026-11-08. `main` was fast-forwarded to `a7b70c78`; the L8 roster caches from `r12-l8perf` are retained.

## Changes

- Nadia starts beside the arriving group and leads a continuous tour along the public paths to the central plaza. All five normal animal species stand near the fences along that route. Children, staff and soldiers remain in the sanctuary population; animal ambience stops at the alarm.
- The objective, Nadia's lines, command-post broadcast, Hale's greeting and warning, elephant dialogue hooks, Hale's keys line and departure caption use the canonical script. No additional courier story lines are introduced.
- After the 60-second calm, a 30-second plaza defence introduces the real tunnel wave. A vested K9 uses the shared tunnel emergence; a separate pond keeper can be grabbed, and the toured flamingo is bitten and transforms through the shared same-ID infection sequence. Converted animals receive a courier pursuit target. Animal boss AI remains for the next lane.
- Hale, Reyes and nearby guards move to the APC. If Sam did not survive the incoming campaign roster, Reyes joins the evacuation group. All required story actors exist before the sanctuary checkpoint.
- The courier covers passenger boarding on foot. Once the passengers are seated, the Mega crosses the north wall in a short camera beat, runs along the east service route and reaches Hale at the APC. Hale gives the keys line and handover gesture before falling; the cab unlocks afterward.
- Boarding the driver starts an eight-second APC departure through the east gate. The two baked steel leaves open, the Mega follows behind the moving APC, and a shared vehicle camera keeps both visible. The complete living group and arsenal use the existing L8→L9 transport handover.
- Story timers, actor IDs, door state and departure pose are checkpointed. L8-02/03/05 carry the PO date and preserve the population, same-ID transformation, combat, Alpha and concurrency clauses.

## Validation

Current remote validation is in progress. Heavy commands use `tools/remote/run.sh` with Mac fallback disabled and one Vitest worker. The focused story helper is included in the existing mission integration case, so the registered test count does not grow. It covers the real walked tour, calm captions, actual K9 tunnel membership and flamingo bite/turn, driver gating, Hale handover/death, moving escape/chase, gate geometry and sanctuary restore.

`git diff --check` passes. An initial remote typecheck used a file manifest created before the queue wait and omitted the newly created helper files; that sync-only failure is superseded by the complete resync.

## Browser QA needed

No browsers are run by this lane. The QA lane should inspect low/high at the PO zooms:

- Follow Nadia from the bus: all normal animal species are readable at their lit fences; the path/lion lines, broadcast and Hale greeting have enough reading time.
- Watch the flamingo pond during the opening breach: the K9 exits its tunnel, the keeper grab and the same-ID flamingo transformation read from the game camera.
- Cover APC boarding: the north-wall reveal clearly shows the Mega; Hale's keys gesture and death stay brief and avoid close gore; the courier can enter the real cab afterward.
- During departure, both steel leaves open before the APC reaches them, the vehicle and complete group cross the east gate, the Mega remains visible behind it, and the exact departure caption can be read.
- Check camera return/skip, checkpoint retry during the story, frame cost at the boarding hold and the unchanged L8→L9 roster/arsenal handover.

No specifications, reference assets or dependencies changed. No deploy or push.
