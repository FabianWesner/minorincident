# Performance acceptance

Candidate runtime: `bc86d7204`. Baseline: main `0009f107d`, built in the separate baseline worktree. [Provenance](performance-provenance.json), [raw observations](performance.json), [summary](performance-summary.json).

| Native backend | Main p95 | Skinned p95 | Difference | Crowd draws |
| --- | ---: | ---: | ---: | ---: |
| WebGL2 | 6.20 ms | 6.90 ms | +0.70 ms | 19 |
| WebGPU | 6.65 ms | 7.45 ms | +0.80 ms | 19 |

Each value is the mean of two p95 observations in an ABBA sequence, independently per backend. Each observation samples at least 12 seconds after excluding the first 120 frames. Both builds initialize on low at 1280×720/DPR 1. All eight observations retain 200 submitted actors; the candidate mixes worker, nurse, woman A, man B, dog and infected zebra, all skinned. A second browser or detected local Blender, Vitest, TypeScript or Vite build invalidates the measurement. The final run completed without detected overlap.

## Added work and fixes

- CPU profiling identified exact weighted `skinBounds` work and repeated accessory fitting. Completed accessory fits are cached with skull replacement invalidation. Bounds reuse requires identical geometry, cut mask, pose rows/revisions and placement; moving held poses additionally reuse only their joint × inverse-bind matrices. Matrix rewrites still invalidate the cache. The full-vertex/perspective-pole fallback and exact picking remain intact.
- Cold loading exposed a second production cost: civilian material graphs were keyed by atlas UUID. Textured civilians now share graphs and rebind each living/frozen page's own atlas before drawing. Unit checks and the [mixed-atlas captures](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/skinned-prod/texture-sharing.json) cover graph reuse and texture identity. In the diagnostic L6 observations, candidate shader compilation fell from about 1.60 s to 1.01 s. This is separate from the frame-time comparison above.
- Vertex skinning still uses the prototype's joint-world atlas plus inverse-bind row. A nontransitioning influence reads eight pose texels and four bind texels; weighted seams retain their original influences. The experimental integer-frame branch was reverted after it increased cold shader compilation. No animation, influence, texture-resolution or geometry reduction was used to meet the final frame gate.
- LOD selection is identical (`lod2` for all six active body batches), so a different LOD choice does not explain the remaining difference. Current main submits about 171.4k triangles and the candidate about 184.8k. The active six bone atlases use 13,601,280 versus 13,610,112 bytes: the additional bind rows cost 8,832 bytes.

[L6 recheck](load-L6-final.json) ran in the same exclusive reservation after the final ABBA comparison. Earlier failed/invalid attempts remain in `gate-attempts/`; they are not used as acceptance results.
