L7-D1 implements AC09/10 district/assets and AC04 exit/wreck placement; D2/E/Q retain corridor, encounter, departure and full-campaign ownership.
W6 retains 560 placements, seven W5-derived hero families/21 LOD GLBs, 22 fires/smoke columns, nine collapses, 11 military wrecks, four ruined segments and zero active defenses.
Typecheck/lint/build pass; remote full unit 839/839; native browser 12/12; remote E29 browser 16/17, with unrelated WebKit audio smoke failing again on retry.
Reviewed W5/W6 shell sheets, plaza, Northgate/Corgi and rocket before/after captures: see [capture review](capture-review.md); Northgate has 0 clipping/sink/missed frames and 0° facing drift; peripheral horde visibility probes remain flagged.
High district stress: 211 draws, 740686 triangles, 200 infected, 240.5 MB heap, sim p95 1.9 ms, frame p95 13.9 ms; all pools within E18 caps; existing rocket stress 2/2 passes.
Low district stress: 109 draws, 231895 triangles, 100 infected, 200.8 MB heap, sim p95 6.3 ms (>6), frame p95 33.7 ms (>33.3): unchanged gate fails, so requested performance/verification closure remains incomplete.
