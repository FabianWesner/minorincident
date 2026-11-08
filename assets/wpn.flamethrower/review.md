# Flamethrower vision review

**Verdict: PASS.** Reviewed the shipped runtime LOD0/1/2 in the game asset viewer and courier hold/fire frames at game-camera zoom 1 and 1.5. Evidence: `docs/reports/r15-flamer/sheet.jpg` and the adjacent `evidence.json` / `validation.json`.

Reference: the brief's military prototype and the existing `wpn.machine-gun` / `wpn.rocket-launcher` palette, beveled boxes, cylindrical bands and courier scale. No external reference art was supplied.

Checklist C:

- **Recognizable:** the under-barrel fuel cylinder, broad burner and yellow nozzle distinguish the flamethrower at gameplay distance. The HUD glyph repeats the cylinder and flame.
- **Part layout:** cylinder, connected fuel hose, receiver, rear/front grips, nozzle and pilot light are authored geometry. LOD1 preserves the hose and cylinder bands; LOD2 preserves the main cylinder/receiver/burner silhouette within 200 triangles.
- **Materials:** olive paint, dark receiver/rubber, brass hose, gold safety bands and a tiny emissive pilot flame stay distinct. No texture dependencies or real-world markings.
- **Style and hidden surfaces:** the closed solid assembly and symmetric stock/grip construction continue the existing weapon kit. Deliberate low-poly distance shapes remain readable.
- **Budget:** runtime tiers are 1,258 / 476 / 188 triangles and 8 / 7 / 6 draws. Named sockets survive every tier; selected validation has no errors.

Courier context: red top, teal backpack and adult character silhouette remain readable. Both palms contact their authored grips; the model stays clear of the torso and the visible fire cone starts ahead of the nozzle. The pilot light reads as a small warm point rather than another large light source. Hold and firing poses are present at both requested zooms, with zero browser console errors.
