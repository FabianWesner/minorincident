# epic-gaps closeout

## Changes

- PO 10-09: E17–E24 acceptance gates that required multi-seed batteries now use a single seed; gameplay thresholds are preserved. Historical calibration tables remain historical. Fun/feel remains PO judgment.
- Reused the l6-hitch preparation fix now merged on main (`a93caf8f`): L1 authored civilian LOD0 preparation and weather preparation before program warming. L4 prepares its fixed street/soldier cast during loading. No geometry, LOD, light, VFX or gameplay cap was reduced.
- Strengthened the L4 peak fixture to its actual populations and firing load, retaining E18 bounds and recording fixed-step versus total frame simulation cost separately.
- Manifest: 391 entries, 350 integrated, 25 reference, 16 placeholder. Eight shipped procedural implementations now point to actual source files. All 305 modeled GLB entries have five unclipped game-renderer views and comparison sheets; 304 have references. No speculative replacement GLB was produced.

## Validation

| Gate | Result |
| --- | --- |
| Typecheck, lint, production build | PASS |
| Remote unit + simulation | 927 passed, 0 failed; six existing E27 deferred cases |
| Single complete-bot gates, L1 / L2 / L4 | PASS; L1 106.37 s, L2 137.62 s, both zero deaths; L4 seed 3 in 150–240 s band |
| Level browsers | 31/31 passed, headless, ≤2 workers |
| Smoke | 6 Node + 26 browser passed |
| E17 photo-state inventory | 1/1 passed; 156 distinct views / 936 equivalent aliases, zero detected static or dynamic placeholders |
| E17 turntables | 4/4 passed, including all 305 modeled assets; coverage 10.10–70.99% |
| L1 transitions / photo budgets / blast+audio / download | All eight relevant tests passed; old low L4 firing fixture was superseded |
| Final L4 full-load high + low | 2/2 passed |

## Performance

| Measurement | Before | After | Original bound |
| --- | ---: | ---: | ---: |
| L1 pickup maximum | 233.3 ms | 23.3 ms | 50 ms |
| L1 handover maximum | 225.3 ms | 42.3 ms | 50 ms |
| L1 infected-exit maximum | 237.0 ms | 25.7 ms | 50 ms |
| Blast + audio maximum (initial closeout baseline) | 220.5 ms | 26.3 ms | 50 ms |
| L4 high, full-load war p95 | 8.8 ms | 8.4 ms | 14 ms |
| L4 high, collapse p95 | 8.9 ms | 9.5 ms | 14 ms |

L1 cause: 218.47 ms `CivilianBatch.init` main-thread task (rig bake, vertex indexing, infection attributes, Meshopt simplification); zero shader link calls during the pickup. L4's earlier closeout measurement had only 47 infected/23 civilians, so the core gap was missing valid peak evidence: the full-population before run already met high budgets.

Final high peak: 80 infected / 40 civilians / 20 soldiers, 18 firing; 262 draws and 568,384 triangles. Collapse: 280 draws, 1,051,466 triangles. Sim p95 per fixed step 2.2 ms; transition maxima ≤17.3 ms.

Final phone peak: 48 infected / 20 civilians / 10 soldiers, all firing, at 4× CPU throttle; 206 draws / 254,113 triangles. Collapse: 182 draws / 464,943 triangles. Sim p95 per step 4.9 ms; transition maxima ≤36.5 ms. Both fixed-step and raw frame CPU are retained in JSON. Native runs reserve both shared browser locks; conditions are recorded.

## Explicit deferrals

Each AC is PASS or deferred with a reason in the [E17](../epics/E17/report.md), [E19](../epics/E19/report.md), [E20](../epics/E20/report.md) and [E22](../epics/E22/report.md) reports. Deferred criteria retain their thresholds. The four statuses are `done` under the job's “all non-deferred pass” rule.

E17: D-SUBWAY delivery optimization belongs to E24; decay.burned-facade needs an authored reference; 41 manifest entries still need production or an explicit PO catalog retirement. Their exact IDs/statuses are in manifest-audit.json and the E17 report. Runtime photo inventory is in photo-assets.json.

Remaining sound/behavior collector or balance gaps are named in the reports. PO visual scoring and E25/E27 lighting/VFX acceptance remain with their owners. A passing component test is not used to claim a deferred full criterion.

Main was merged before closeout. No deployment and no merge to main. Uncommitted captures are removed; the complete turntable batch and selected before/after evidence are committed.

The high before/after fixtures have the same 80/40/20 population. The final target distribution uses actual snapped soldier positions to establish firing coverage. Small L4 timing differences are run variation; they do not establish a speedup from the cast-preparation change.
