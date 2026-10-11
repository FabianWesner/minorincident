# Repeated full level gate failure

Source: production `100207ee`, main `98e9aa79`; browser assertion-only revision `78e39cbf` has identical game, unit/sim and level-test source. Headless Chromium Metal, one worker, shared e2e lock, port 3500. Full run: **29 passed, 2 failed**, no skipped tests.

- L3 Oak: the full suite repeats the earlier failure at exactly x=106.62232208251953, z=25.383996963500977 while travelling to (118,24), HP 100, deaths 0, nearby live infected 0. Two focused main3ff runs and two focused lane runs previously passed, so those controls do not establish the cause.
- L6 keyboard/mouse escort: reached the result with 27 rescued and zero deaths, but failed the final `straggler && rejoined` assertion at L6.spec.ts:58. Its mission data and assertions remain untouched.

A short local functional simulation probe loaded L3 seed 1, placed the player at the exact stalled coordinates, and issued the requested move target (118,24). It reached (117.9289,24.0137) within 240 ticks and cleared its target. This does not recreate the complete mission or browser click state; it only shows that the static geometry at those coordinates alone does not prevent this requested move. Raw output: exact-position-sim-probe.log. No performance conclusion is drawn from the local probe.

The failure contexts are retained. The 96 MB L6 trace was removed; this directory contains no uncommitted capture intended for delivery. The full gate remains red pending diagnosis and fresh validation.

A second short functional probe ran the existing complete/Oak bot for seed 1 until x≥92 (one run, no battery), then tested the same position and destination in that mission-evolved world. It also reached (117.9143,24.0182) within 270 ticks. Raw output: mission-position-sim-probe.log. This still does not reproduce the browser click state or establish the cause.
