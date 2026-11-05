# Art registration wave 0 report

## Changes

- Registered all 25 delivered assets, with measured bounds, forward markers, source declarations and palette/geometry validation. Standardised the paramedic to 1.8 m. Updated collision metadata.
- Rebuilt native distance tiers only for three large assemblies: food court (99,328 / 11,459 / 2,700 triangles), mini-mall (86,012 / 14,540 / 4,068), hospital exterior (85,300 / 9,965 / 2,606). Cheap foliage distance files now reuse the cheaper base geometry.
- Triaged the remaining 95 entries: 9 canonical model aliases, 47 UI/ability/procedural non-model entries, 39 missing model/composition entries. Non-model metadata does not assert unfinished presentation is complete. Alias placement scales and four layout bounds were adjusted to fit their existing lots and preserve navigation.
- Produced 25 five-angle LOD contact sheets under `test-results/art-register/`, plus overview images and review notes. No asset received final approval status.

## Validation

All final commands passed:

| Command | Result |
|---|---|
| `npm run assets:validate` | 667 checks, 0 failures |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run test:unit -- --maxWorkers=4` | 75 files, 245 tests passed |
| `E2E_PORT=3358 npm run test:smoke` | 5 Node tests passed (621 skipped), 22 browser tests passed |
| `E2E_PORT=3358 npm run verify -- E17` | typecheck/lint/build passed; 39 Node tests passed (587 skipped); 36 browser tests passed |

Browser commands use the repository lock, headless browsers and at most two workers. E17 checks and asset validation evidence are retained under `test-results/epics/E17/`.

## Rule changes and deviations

No specs were edited. The orchestrator requested pragmatic validation rules and a rebuild timebox. Tiny models may retain base triangles; cheap props and handhelds use absolute floors. Retained native tiers have explicit per-asset absolute caps: all 54 exceptions and shipped counts are in `art-register-lod-budgets.md`. Existing house/vehicle hard caps remain. File size limits use KiB consistently; monotone file-size checks apply to houses and road vehicles, since independent streams in assemblies can grow despite fewer triangles. Freight trains are excluded from the road-car fixture contract.

Generic aggressive decimation was visually rejected for perforated panels/actors and discarded. The retained exceptions are a scope decision, not evidence that crowded actors or dense later-level scenery meet campaign frame budgets.

## Remaining work

Independent visual QA and manual WebGPU checking remain. The paramedic far tier is visibly coarser. Further native authoring/performance QA is warranted for dense retained scenery/crowd tiers. Missing production work is listed with asset IDs, levels, descriptions and priorities in `missing-models.md` (tracked copy) and the requested ignored `epics-pipeline/briefs/missing-models.md`; turret aliases share one production task. No new models were authored for missing entries. No merge, push or deploy was performed.

## Commits

- `e46fc912`: practical cheap/retained LOD budget rules and targeted regression coverage.
- Subsequent art registration commit: manifest, authored tiers, delivery markers, collision/layout contracts, triage and validation evidence.
