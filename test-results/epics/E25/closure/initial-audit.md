# E25 closure audit

Audited main / initial lane HEAD `baf1fb5a3848c18d1ad34cb8ce1c0fcc715c0f97` before implementation, 2026-10-10. A test tag alone is not a PASS: existing evidence and fresh validation are distinguished below. No budgets or criteria changed.

| AC | Initial audit | Evidence / missing behavior |
| --- | --- | --- |
| E25-AC01 | GAP | WebGPU lighting/tone-mapping spike and decision report absent; manual WebGPU policy applies. |
| E25-AC02 | PASS (existing evidence) | tests/unit/render/e25-lighting.test.ts validates shipped anchors and rejection cases; rerun pending. |
| E25-AC03 | GAP | Only tests/visual/e25-deferred.spec.ts placeholder; LightField has facade clipping but no static visibility polygons or trailer mask proof. |
| E25-AC04 | DEFERRED | WebGPU requires manual validation per repository guidance; automated headless parity cannot prove this. |
| E25-AC05 | GAP | LightField.heroAt selects one light; no 40-light hysteresis/crossfade test. |
| E25-AC06 | PASS (existing evidence) | tests/visual/e25-lighting.spec.ts; hero-shadow.json and hero-shadow.png report tinted shadow; rerun pending. |
| E25-AC07 | GAP | Placeholder only; weather blackout is not generator startup flicker. |
| E25-AC08 | GAP | Placeholder only; breakable lamp and darkness sight penalty absent. |
| E25-AC09 | GAP | Placeholder only; depth-faded cones absent. |
| E25-AC10 | GAP | E28 supplies wet streaks; reflection-lab and SSR silhouette evidence absent. SSR is staged to release extras (04 §6). |
| E25-AC11 | GAP | Placeholder only; camera-dependent material-class/env proof absent. |
| E25-AC12 | GAP | Placeholder only; interior mapping proof absent. |
| E25-AC13 | PASS (existing evidence) | tests/visual/e25-lighting.spec.ts; night-readability.json and masks; rerun pending. |
| E25-AC14 | PARTIAL | tests/perf/e25-lighting.spec.ts covers L1 and night-street, not light-lab. |
| E25-AC15 | GAP | Placeholder only; complete day/night asset preview evidence absent. |
| E25-AC16 | GAP / L6 DEFERRED | Existing review fails geometry occlusion, beams and reflections. L6 shelter-fails deferred to E24 per task; all other spots remain required. |

