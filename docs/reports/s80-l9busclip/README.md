# s80-l9busclip — complete

## Fix

L9 adds massless native upper contact shells to the school bus and APC. Rapier resolves hull contact without moving either vehicle by teleport. Shell contact hooks restrict these extra shapes to each other; the original chassis retains ground/roadside collision, mass and ordinary handling. Shells restore idempotently with native bodies at checkpoints. Ram damage requires an actual contact between the two vehicles. Infected momentum protection respects fixed roadside stops so normal steering/reverse recovery remains possible.

## Verification on final gameplay source `2573cccc`

| Gate | Result |
|---|---|
| Remote `sh tools/remote/run.sh "$PWD" -- npm test` | Exit 0; 27 files, 106 passed / 1 skipped; 207.5 s of 240 s; runner 46.225.66.90 |
| Typecheck and lint | Pass |
| Focused vehicle tests | 2/2 pass, including flip recovery and three real Rapier ram contacts costing exactly 120 armour |
| Native four-case probe | Head-on, side, rear, stalled at rail: every sampled tick ≤0.2 m overlap; actual contact required in every case |
| Probe maxima | Head-on/rear/rail 0.08746 m; side 0.03238 m; 317–325 contact ticks; final bus speed 0.012–0.869 m/s |
| Bus driver proof | Two telegraphed dodges wreck bus; zero APC damage; exploded bus wreck retained |
| `threat-audit --levels L9` | Skilled and passive complete; zero L9-specific flags. Command exits 1 only for existing PARTIAL_LEVEL_SELECTION diagnostic wrapper |
| `tools/qa/l9-progress-regression.sh` | Exit 0; all 18 primary/detour × three routes × seeds 1–3 finish |
| Scene Lab HIGH / LOW | Both pass, zero console errors; sheets opened and reviewed |

## Visual review

Opened the original s78 real-input capture: yellow bus geometry fills the APC windscreen and overlaps its roof/front. The retained [HIGH/LOW contact sheet](contact-sheet.jpg) shows the bus nose meeting the APC rear, distinct roof silhouettes and a clear APC windscreen throughout frames 0–120. HIGH has softer lighting; LOW retains the same readable geometry. The static Scene Lab row complements the native moving-contact probe.

## Scope and limitations

No zombie stats, corpse persistence rules, threat harness files, specifications or protected asset/reference paths changed. No deployment, push or main movement. Native fixtures set initial poses before sampling; the gameplay collision fix uses Rapier contact rather than corrective pose writes. Automated captures use headless WebGL2; WebGPU remains manual per repository policy. No checks remain running.
