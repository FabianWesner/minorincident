# look-l10b — L10 night run, look-l9b recipe (Fable 5.1, 2026-10-20)

Start: lane/look-l10 tip (9f3041560, Opus: D-CURE dressing, L10-night preset, decorLights). Orchestrator sheet check ~4/10:
"the pale purple road fills a third to half of every frame, lane stripes glow, the crash site (R1) is dim and sparse", plus
the hard constraint that R6/R7 dressing was physicsOnly (infected walked through it).

## What changed
- `src/data/timeOfDay.ts` L10-night: the L9 recipe (moon .38 silver key, deep-blue grade, contrast 1.34, breakup .22),
  `roadNeutral .85` (the purple asphalt reads grey), `roadLift 1.6 #aebfd3`.
- `layouts/D-CURE/layout.py`: road marks in `silver`; the flat verge-patch quads are not emitted (rng stream kept); a continuous
  dark shoulder band 4-9.5 m (`leather` on the crash scar, `leatherEdge` elsewhere) with the lawn strips moved beyond it; tar cracks
  and skid marks on the asphalt as no-cut overlays (`surface(..., cut=False)`, own `Random(1020)`); the destroyed corridor gets an
  ash ground sheet (`pantsDark`) and its burned fronts stand 19-23 m back (Scene Lab powers every placement, so their window pools
  must not reach the AC16 verge band); **R6/R7 dressing is solid for everyone** (no `physicsOnly`).
- `src/render/NightAccents.ts` `cureAccents`: render-only fires on the crash scar (every clear burned wreck burns, brush fires)
  and the destroyed corridor; pools stay out of the verge band (wreck fires >= 8.5 m, brush >= 12 m past the lane edge), 14 m
  from encounter/medkit spots, 70 m from the console. Unit test in `tests/unit/render/night-accents.test.ts`.
- Tools: `tools/qa/l10-look-gen.py` (per-region look specs incl. a fixed epilogue camera at the console), `tools/qa/l10-fires.ts`,
  `PREFIX` for `tools/qa/l9-look-sheet.py`.

## Finale (hard constraint)
`tests/sim/levels/l10-arrival.test.ts` (seed 32, both tiers) after every dressing change; final layout: Mega arrival
**142.83 s high / 141.88 s low** (baseline on look-l10: 142.83 / 141.92; tolerance +-0.5 s), courier hp 62, cure released.
One intermediate variant (R6 wrecks/low props moved to 10-12.5 m) stalled the Mega at high (arrival null) and was reverted;
the final R6 change moves only the building fronts (19-23 m), which the calibration accepts.

## Gates (Scene Lab, WebGPU, high and low, untouched)
night-read-l10-r1 3.9-4.1, r2 2.2-3.7 (median 3.6, floor 2.16), r3 2.2-3.4 (floor 2.17), r4 3.2-3.9, r5 3.0-4.0,
r6 3.2-3.7 (was 1.9-2.3 on the look-l10 dressing with my darker preset: the lit windows of the burned fronts washed the verge).
Look scenes: 28 WebGPU + 3 WebGL2 captures pass budgets (draws <= 300, tris <= 500k), no console errors, clipping 0.
Unit: tests/unit/levels + layouts + accents 160/160; remote tests/levels/L10-campaign + tests/sim/levels + tests/unit/levels
green on the solid layout (39 files), re-run on the final tree (see the lane report).

## Sheet
`before-after.jpg`: rows crash (R1), fringe (R2), military (R4), campus (R5), corridor (R6), complex (R7 approach), epilogue
(console); columns before (look-l10 tip, WebGPU high z1/z1.5), after high z1/z1.5, after low z1/z1.5, WebGL2 high z1.

## Honest score: 6/10
Night reads as night: grey-silver asphalt with cracks and skids, dark verges, warm lamp pools (R2/R4/R5), red beacons (R7), a
dark dead corridor, grey marks, no patch polygons, WebGL2 identical. What keeps it from 7: the 8 m road still fills more than
half of every zoom-1 frame, pale against the verges, because the AC16 gate needs the band at ~.07 luminance where lamp pools
light the verge (R2/R3 floors 2.16/2.17 leave no headroom to dim it), and Opus's 6 m gameplay clearance keeps every prop out
of the zoom-1 frame, so the frame is road + 3.5 m of verge. The crash site has its burning wrecks and flares but the APC wreck
hero shot is not in these rows. A real step up needs a different camera/zoom policy or a narrower road, not more dressing.
