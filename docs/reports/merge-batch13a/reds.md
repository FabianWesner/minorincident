# Red classification

Starting main is `2d5e0fb84`. “Yes — supplied baseline” means the failure was explicitly listed in this job and/or recorded by batch 12; it is not presented as a fresh measurement from this batch. “No — isolated control” refers to the fresh main controls linked below. Different reservation/load conditions do not establish a causal source regression.

| Check | Merged batch result | Red on main yes/no | Basis and current limit |
| --- | --- | --- | --- |
| Zoo S1 200-actor p95 | After-character loaded sweep red; after-controls sweep passes | Yes | Supplied known baseline; fresh isolated main passes. Timing is load dependent. |
| Zoo S2 200-actor p95 | After-controls sweep 4.041137 ms > 4 ms | Yes | Supplied known baseline; fresh isolated main passes. Original loaded red retained. |
| Nine other after-character timing failures | All pass in after-controls sweep | No | All eleven selected starting-main controls pass with both slots held; [assertion list](cpu-summary.json), [main control](baseline-timing-retry.txt). L9 also passes on isolated merged sources. This does not replace a matched loaded-main comparison. |
| L10 campus-route high p95 | Loaded sweep 5.464806 ms > 4 ms; merged follow-up passes | No | [Main follow-up also passes](l10-route-comparison.txt). Route/checkpoint/death checks pass. Main's follow-up is after the wrapper releases the extra slot; reservation limit is recorded in QA. |
| L4 low native timing | Fresh quiet WebGL: collapse median 34.2 > 33.33 ms; pickup/turn 110.9 > 80 ms; line-break 83.6 > 80 ms | Yes | Yes baseline supplied; camera-lane WebGL low also missed collapse and hitch limits. Fresh high passes and low sim p95 passes (5.9 ms). WebGPU native remains unmeasured. |
| L4 behind-building / first-frame cut outside disc | Original 12 rows red at limit 0; PO #25 explicitly accepted, all 12 pass revised 450,000 ceiling | No | All twelve batch-12 rows pass, outside 0. New lens-foreground reveal in `625d5aa6e` clears the enclosing building outside the bounded disc. All 12 captures opened; intentional foreground clearing accepted by orchestrator after review. [Baseline record](accepted-facade-baseline.json). Original results retained. |
| L7 low native timing | Not rerun separately | Yes | Supplied known baseline; no L7 timing fix in this batch. |
| Convoy occlusion high zoom 1 / 1.5 | 195,856 / 122,917 outside pixels, limit 0 | Yes | Batch 12 merged had 3,244 / 510; main 3,204 / 412. Already red, substantially worse with enclosing-facade reveal. [Batch 12 evidence](../merge-batch12/qa.md). |
| Convoy occlusion low zoom 1 / 1.5 | New: 122,571 / 205,216 outside pixels, limit 0 | No | Batch-12 low rows pass; camera comparison pending. No baseline change authorized for convoy. |
| APC low zoom 0.5 | Silhouette 2/7 = 28.57%, minimum 30% | Yes | Same failed metric as batch 12 and its fresh-main comparison. |
| L7 courier contrast | Not rerun separately | Yes | Supplied baseline and batch 12 fresh-main comparison. |
| L8 phone sim p95 | Not rerun separately | Yes | Supplied baseline and batch 12 fresh-main comparison. |
| qa-corgi-behaviour slide 12.4 cm | Not rerun separately | Yes | Supplied known baseline; dedicated changed tongue/limb scenes pass both backends and tiers. |

The orchestrator gate's final result and any additional full-matrix reds are appended after it runs. A queued command is unmeasured. E18 deterministic draw/triangle counters pass; the loaded timing reds and outstanding native coverage prevent claiming every E18 budget holds.
