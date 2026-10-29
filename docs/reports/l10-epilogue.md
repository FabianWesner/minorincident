# L10 epilogue and R1 QA (Q-235 / Q-236)

## Q-235: cause and regression origin

The supplied capture shows the collapsed infected crowd. E32 §5.8 explicitly kills infected with the cure; healthy survivors emerge separately, stay alive, and walk/idle. There is no infected-to-healthy conversion.

The same seeded Scene Lab release was run on **batch 28 `763b56c87`** and **pre-fix batch 29 `469bcaffa`**: 72 living infected near the console and the real survivor controller. Both builds produce **68 overlapping corpse footprints** after the approaching group collapses. Survivor routes were also observed through 110 seconds. This predates batch 29; the narrow roads, look dressing and Q-233 actor IDs did not introduce it.

Two older behaviors explain the picture:

- `591eb20c9` (2026-10-24, “Bound corpse settling to one metre and retain layered heaps”) limits render settling to 1 m, so the dense final horde becomes layered clumps.
- Cure mist introduced in `888e63f33`, expanded for the pullout in `39c200c8f` (2026-10-14), reuses full-height smoke spheres at 0.32 opacity. These overlap entire figures and produce a pale veil. The figures themselves are **opaque**: diagnostic materials all report `transparent=false`, `opacity=1`, `fade=1`. Removing the corpse cutout leaves the distant clumps unchanged; removing mist removes the veil. There is no stuck cure-fade material.

The final fix gives L10 epilogue corpse settling up to 4 m of supported floor, refreshing already-frozen bodies once at release. The identical cohort now has **6 overlapping footprints**, **0 interpenetrating pairs**, maximum lift **0.22 m** and maximum displacement **3.6 m**; the courier footprint remains clear. Combat settling elsewhere remains at 1 m. Mist is flattened to a low bank (vertical scale 0.14, opacity 0.20), so upright survivors remain above it. The six healthy survivor routes use wider, nav-resolved slots instead of the original compact 1.3 m grid. Their existing walk/pause/idle animation remains in use. The original corpse visibility cutout remains intact.

Reviewed captures: [batch 28](l10-epilogue/captures/batch28-release.jpg), [batch 29 before](l10-epilogue/captures/before-release.jpg), [after](l10-epilogue/captures/after-release.jpg), [survivors before](l10-epilogue/captures/before-survivors.jpg), [survivors after](l10-epilogue/captures/after-survivors.jpg). Raw cohort and material evidence is in [l10-epilogue/evidence](l10-epilogue/evidence).

## Q-236: R1 pole and flood

`6ba51eb28` pulled the field pole line from its old 17–21 m setback to 7.5–9.5 m. The foreground pole `prop.utility-pole:3242` at **(556.63, 8.91)** then projects its crossarm across the start-area camera. It now sits 18 m downstream at **(574.63, 8.91)**. The layout source, generated placement/collider JSON and GLB marker agree; the placement count, IDs and random dressing decisions are preserved. No runtime placement workaround remains.

Only R1's flood-marked evac towers are adjusted: the authored spot direction remains, with warm light, intensity **6 → 3.2**, and range **24 → 14 m**. The smaller pool falls off into the night instead of bleaching the evac verge. [Before](l10-epilogue/captures/before-flood.jpg) / [after](l10-epilogue/captures/after-flood.jpg).

## Verification

- `npm test`: **106/106**, with no new test cases; typecheck and lint passed.
- `npm run layouts:build -- D-CURE`: passed; only the selected pole changes placement. Static-overlap census remains **182 → 182** (existing authored overlaps).
- Finale constants and `tools/qa/l10-arrival-check.ts` are unchanged. Earlier timing run: **143.15 / 143.22 s**, cure released, zero deaths; final source run pending.
- Full high/low epilogue, R1 AC16 contrast, smoke, and 48-row scene gate: running/pending.
