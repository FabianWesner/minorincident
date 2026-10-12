# Crowd variety — 2026-10-12

Baseline: `ef34a25d`. Final implementation incorporates requested main `529d09b6`, including accessory art `d1db5f5b`. Comparisons therefore include the incoming main changes. No deployment or merge into main was performed.

## Implementation

Default regular infected balance seven existing models in their local neighbourhood. Outbreak pedestrians and dressed infected balance five civilian bases in separate cohorts; nearby authored pedestrians cannot skew the infected mix. L6 maintenance arrivals balance five bases. Explicit story variants remain authored, and reused infected pool objects clear stale appearance data.

Entity IDs determine seven natural hair colours plus grey, six skin tones, twelve shirts, eight lower-garment tones and accessory choice. Infected skin remains within the ash-green palette. Appearance fields and the covered-hair bit occupy the existing `_variant` vec4; `_parts` carries hair/skin/garment/headwear tags. Shipped civilian bake bytes are unchanged. Palette selection runs per vertex, and rendered-look records are cached between outfit changes.

All twelve manifest `acc.*` meshes are discovered automatically, shared between pedestrians and infected in one rigid instance batch per mesh/LOD. Authored head fits take precedence; other ordinary human bases fit the reference shell to their baked skin skull. Hats and hair pieces hide base hair and caps per instance. Other accessory kinds retain hair. Hair pieces receive the seeded natural hair colour. LOD2 draws no accessories. Accessory shadows do not add a shadow draw.

Real-geometry assertions and both browser backends check the complete layouts: infected 8 buffers / 14 locations, civilians 5 / 12, accessories 5 / 8. Limits remain 8 WebGPU vertex buffers and 16 WebGL2 attribute locations. Every accessory geometry is checked against 150/80 triangles; LOD2 is absent.

## Variety and images

The QA fixtures stage fourteen L2 regular infected, twenty regular infected and twenty pedestrians on baked Elm Street ground. They isolate appearance counting rather than replay the PO's exact melee. Metrics count submitted living figures and channels actually present in the selected geometry; hidden base hair does not inflate hat-wearing looks. Scripted infected specials are excluded.

| Fixture | Desktop / phone distinct looks | Largest same-look share | Largest model share |
| --- | --- | --- | --- |
| L2, 14 infected | 14 / 14 | 7.14% | 21.43% |
| 20 infected | 20 / 20 | 5% | 20% |
| L1, 20 pedestrians | 20 / 20 | 5% | 20% |

The baseline infected model shares were 28.57% in the fourteen-figure scene and 30% in the twenty-figure scene. Both final views pass their minimum variety and maximum-share gates with zero captured console errors.

Reviewed all desktop and phone images. Desktop shows distinct caps, brimmed hats and hair-piece silhouettes, with brown, black, copper, blonde and grey hair plus cream/blue/green/pink clothing. Phone keeps clothing and natural hair colours while dropping accessories. A few figures touch the phone frame edges; the metric records twenty visible figures. The L2 hunch and glowing eyes remain distinct from upright healthy pedestrians. The repetition of one grey-haired beret base is reduced.

| Scene | Before desktop | After desktop | Before phone | After phone |
| --- | --- | --- | --- | --- |
| L2 | [image](before-l2-fight-high.png) | [image](after-l2-fight-high.png) | [image](before-l2-fight-low.png) | [image](after-l2-fight-low.png) |
| L1 | [image](before-l1-street-high.png) | [image](after-l1-street-high.png) | [image](before-l1-street-low.png) | [image](after-l1-street-low.png) |

## Performance

Native headless Chrome/Metal, 1280×720 high and 390×844 low, twelve-second minimum RAF windows after 120 warm frames. Figures remain alive throughout. These unthrottled measurements use the 200/100 infected fixtures.

| Tier | Draws before → after | Triangles before → after | Frame p95 before → after |
| --- | --- | --- | --- |
| Desktop, 200 | 48 → 54 | 661,441 → 496,623 | 8.0 → 7.9 ms |
| Phone viewport, 100 | 48 → 54 | 169,797 → 103,415 | 5.8 → 4.3 ms |

The stricter existing `horde-budget` suite adds forty live pedestrians and four-times CPU throttling on the phone. Desktop: 53 → 59 draws, 713,249 → 548,431 triangles, 10.6 → 8.4 ms frame p95. Phone: 52 → 58 draws, 182,933 → 116,551 triangles, 24.0 → 30.8 ms frame p95. Final 14/33.3 ms gates pass. An earlier phone run measured 34.6 ms; caching appearance records reduced repeated allocation and the final run passed without changing budgets.

Focused native simulation: 200 infected p95 1.89 ms (4 ms cap); 100 p95 0.70 ms (6 ms cap). Shared Mac load varied significantly; intermediate renderer p95 samples ranged 7.1–13.3 ms on desktop. Raw counters and final values are in [evidence.json](evidence.json).

## Validation and limitations

- Remote full unit suite: 934 tests / 186 files pass. Final focused geometry/appearance/cohort tests: eleven pass, including cloned-geometry cache invalidation, skull fits, all accessory triangle caps and both buffer limits.
- Final headless WebGL2/WebGPU crowd-drawn and variety checks: four pass. Existing 200-body draw and sixty-body readability checks also pass. Thirty live draws and seven corpse draws remain unchanged. The corpse comparison explicitly fixes its original three reference archetypes and 63 bodies; the preceding live scene retains varied models.
- Native horde budgets: desktop and four-times-throttled phone pass. Physical phones were not measured.
- `npm run verify -- E18` was run and failed its full-selection simulation timing gate under shared Mac contention. The isolated unchanged horde assertions subsequently passed; the full verify command is not claimed green.
- Existing emulated L6 device tests crash loading `perf-l6-mainstreet`: the fixture requests absent D-MAIN in the current L6 subway composition (`origin` is undefined). Both failures reproduce on untouched baseline. Budgets and fixture assertions were not relaxed to hide this.
- Full non-visual remote Playwright attempt: 24 passed, nine failed, one skipped, 148 did not run at its 23-minute cap. The earlier attempt also stalled on slow software-rendered frame checks. Arrival and audio frame-limit failures reproduce on baseline; other broad-suite failures remain unclassified. This run is incomplete and cannot serve as a full regression approval.

## Reproduce

`MI_VERIFY_REMOTE_SIM=1 MI_VERIFY_REMOTE_BROWSER=1 npm run verify -- E18` routes functional work remotely while keeping timings and pixels on the Mac. `SCENE_PORT=33791 sh tools/e2e-lock.sh npx tsx tools/scenelab/crowd-variety.ts after` regenerates variety captures and native measurements; `--captures-only` and `--perf-only` select either part. All automation is headless. Full unit and functional browser work used `tools/remote/run.sh`, at most four Vitest threads and two Playwright workers.
