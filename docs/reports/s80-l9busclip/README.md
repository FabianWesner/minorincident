# s80-l9busclip

L9 now adds massless native upper contact shells to the school bus and APC. The original chassis, mass properties and ordinary vehicle handling remain. Shells are reapplied idempotently on checkpoint rebuild. Ram resolution requires real Rapier contact across every collider on each vehicle; distant or dodged rams cannot damage the APC. No contact pose teleport is used.

## Current evidence

- Opened the original s78 capture: bus geometry filled the APC windscreen and overlapped its roof/front.
- Native four-case probe physically contacts in head-on, side, rear and rail-stall fixtures. Every sampled tick asserts overlap ≤0.2 m. Maxima: 0.08746 m head-on/rear/rail; 0.03238 m side. Each fixture has 317–325 contact ticks and final bus speed ≤0.869 m/s.
- Focused vehicles test: both tests pass, including ordinary handling/flip recovery and three actual native contacts costing exactly 120 armour.
- Existing bus-driver proof passes: two telegraphed dodges wreck the bus, zero APC damage, exploded wreck retained.
- Typecheck and lint pass on the current source.
- HIGH and LOW Scene Lab rows pass, zero console errors. Opened both sheets: bus nose meets the APC rear, separate roof silhouettes, clear APC windscreen throughout frames 0–120. HIGH has softer lighting; LOW preserves the same geometry and readable separation. Combined retained sheet: [contact-sheet.jpg](contact-sheet.jpg). This static visual row complements the moving native probe.

## Final-source gate rerun

- Remote full suite on 46.225.66.90: exit 0, 27 files passed, 106 tests passed / 1 skipped, 205.6 s (240 s budget).
- `sh tools/qa/l9-progress-regression.sh`: exit 0; all 18 primary/detour × road/countryside/dry-shortcut × seeds 1–3 receipts completed.
- L9 threat audit: skilled route completes, but passive route fails at the 600 s budget while remaining near the rail (x≈377.9, z≈-195.6), with later crowd collision invariant failures. Flags include `L9/INCOMPLETE_NATIVE_POLICY:mission-failed` and the normal partial-selection wrapper flag. This violates the required zero L9 flags and remains open. No threat harness files were changed.

## Remaining work

Resolve the passive rail restart/contact regression, then rerun the affected gates. The goal is not complete. No checks remain running.

Diagnostic: restricting upper shells to dynamic/dynamic contact preserved the four overlap probe results but did not resolve the passive audit failure (skilled complete, passive mission-failed at 600 sim seconds). Reverted that unsuccessful change. Further diagnosis must examine bus pressure/rail restart state rather than assuming fixed rail geometry is responsible. No checks remain running.

Passive-route observer (outside the threat harness) narrows the stall: rail stall starts at tick 6132, restarted=true and holding=false afterwards. At ticks 12600–15000 the APC remains x≈376.59/z≈-194.73 despite throttle/steering input. Bus is stopped at x≈387.48/z≈-209.53, roughly 18 m away, since tick 7423. Thus restart timer and direct bus pressure are not the blocker; inspect APC native contact pairs next. Temporary observer removed after its terminal run.

Latest filter validation: upper transport shells now use Rapier contact hooks so they interact only with each other; existing chassis handles roadside fixtures. Typecheck, lint, focused vehicle tests (2/2), and the four-case overlap probe pass. Threat audit passive route now completes and all L9-specific flags are empty (only PARTIAL_LEVEL_SELECTION remains), but skilled route hits its 600 s budget and reports crowd collision-invariant failures. This is still an unresolved route regression; do not treat the empty flag list as completion. No checks remain running.

Skilled-route pin diagnosis: original chassis contacts roadside furniture near x380.39/z-193.72 while infected ram momentum repeatedly restores the diagnostic speed to 7.2 m/s. Added fixed-contact protection to keepRamMomentum so a fixed object preserves the native solver stop and ordinary driving recovery. The same observed skilled route now completes (220 s budget). Full audit, remote suite and progress gates must be rerun for this final source. Temporary observer removed; no checks running.

Current final-source focused gates: both skilled and passive L9 audit routes complete; L9 flags are empty (only PARTIAL_LEVEL_SELECTION wrapper flag remains). Typecheck, lint, both focused vehicle tests, four-case overlap probe (maximum 0.08746 m), and dodge/wreck proof all pass. Commit the momentum fixed-contact guard; remaining completion work is rerunning remote full unit suite and 18 progress regressions on this source, then consolidating this report. No checks running.
