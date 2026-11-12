# s80-l9busclip

L9 now adds massless native upper contact shells to the school bus and APC. The original chassis, mass properties and ordinary vehicle handling remain. Shells are reapplied idempotently on checkpoint rebuild. Ram resolution requires real Rapier contact across every collider on each vehicle; distant or dodged rams cannot damage the APC. No contact pose teleport is used.

## Current evidence

- Opened the original s78 capture: bus geometry filled the APC windscreen and overlapped its roof/front.
- Native four-case probe physically contacts in head-on, side, rear and rail-stall fixtures. Every sampled tick asserts overlap ≤0.2 m. Maxima: 0.08746 m head-on/rear/rail; 0.03238 m side. Each fixture has 317–325 contact ticks and final bus speed ≤0.869 m/s.
- Focused vehicles test: both tests pass, including ordinary handling/flip recovery and three actual native contacts costing exactly 120 armour.
- Existing bus-driver proof passes: two telegraphed dodges wreck the bus, zero APC damage, exploded wreck retained.
- Typecheck and lint pass on the current source.
- HIGH and LOW Scene Lab rows pass, zero console errors. Opened both sheets: bus nose meets the APC rear, separate roof silhouettes, clear APC windscreen throughout frames 0–120. HIGH has softer lighting; LOW preserves the same geometry and readable separation. Combined retained sheet: [contact-sheet.jpg](contact-sheet.jpg). This static visual row complements the moving native probe.

## Remaining gates

Rerun the full remote unit suite, L9 threat audit and all 18 L9 progress regressions on the final source. Earlier full-suite failures were resolved in focused vehicle tests; the full rerun is still required. Earlier L9 threat receipt had flags [], with wrapper exit 1 for PARTIAL_LEVEL_SELECTION. No tools/qa/threat files were changed.
