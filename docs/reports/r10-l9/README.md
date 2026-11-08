# L9 long dark drive review

Date: 2026-11-08  
Base: `0ad5a72b` (`main`)

## Scope and current implementation

The brief asks to improve the 100-second L9 crossing drive without changing its length or bridge set piece. At this base, the requested categories are already represented in the runtime:

- route-specific infected groups and roadside wanderers are authored in `src/data/l9.ts`; `src/sim/missions/LevelNineEncounters.ts` also admits a small pursuing patrol during quiet stretches;
- `src/render/NightAccents.ts` places route flares/lanterns, wreck hazard lights, fires, near-verge burning debris, and lights toward the crash and city;
- the implementation is render-only for the lighting accents and does not add a separate asset or instancing system.

No gameplay or lighting source change was made in this lane. The available evidence did not support safely tuning already dense roadside lighting/encounters: the required real-input baseline and visual/performance comparison could not run in this sandbox.

## Evidence

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test -- --maxWorkers=4` | Pass: 107 tests, 27 files; within the four-thread cap |
| `npm run qa:accept -- --level L9 --skip-browser` | Native low/high complete and stationary receipts, fixtures, and checkpoints completed; 0 fresh failing rows, 8 incomplete rows (browser checks skipped) |
| `npm run qa:threat -- --levels L9` | L9 has 0 level flags. The command exits nonzero because the audit marks a single-level selection as `PARTIAL_LEVEL_SELECTION`, so this is diagnostic rather than a full gate |
| `npm run scene:gate` | Not run: the sandbox rejected tsx's local IPC socket (`EPERM`) |
| `node --import tsx/esm tools/scenelab/gate-run.ts gate --out test-results/r10-l9/scene-gate` | 0/50 rows pass; browser pool failed to start (exit 75), all 50 rows not run |
| Four requested real-input cells (low/high × zoom 1/1.5) | Not run: the preview server could not bind an available local port (`EPERM`) |

The per-level threat receipt showed both skilled and passive L9 routes complete in 128.13 simulated seconds, with no L9 threat flags. The single-level audit's overall flag is a policy flag for partial selection, not a detected L9 threat.

The only available image was the pre-existing `test-results/pre-uat-l9/overview.jpg`, which I opened. Its lower comparison cells show an APC on a lit road with roadside fires and nearby infected; its upper cells compare the crash crawl pose and APC seating. It is old pre-UAT evidence, not a current drive capture, so it does not establish drive coverage or current visual acceptance.

## Measurements and remaining evidence

Before/after kills, encounter count, and seconds with no meaningful content in frame are unavailable: no current real-input capture completed, and there is no matching before/after measurement in the checked-in report material. The requested low/high and zoom 1/1.5 visual matrix, per-capture descriptions, frame-time ceiling, and cold-load measurement therefore remain unverified.

The full brief is not complete until those browser runs and the performance checks can execute in an environment where the headless browser pool and preview server can bind local sockets. Do not infer visual or performance acceptance from the native receipts.
