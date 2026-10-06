# Asset review · npc.lab-guard

Comparison: assets/npc.lab-guard/renders/reference-comparison.png
Reviewer / date: Codex / 2026-10-06

Compared the final Eevee hero, game-camera view, front/side/back turnaround and pose render with both the original crop and clean upscale. Identity: Stocky adult, navy GBD cap and short-sleeve uniform, chest badge and GBD SECURITY back lettering, shoulder patches, beard, radio/cable, duty belt/pouches, cargo trousers and heavy boots.

- [must] Recognizable at gameplay distance: PASS — outfit colors, broad adult chibi head and principal accessories remain readable in the game-camera render.
- [must] Main part layout matches: PASS — the reference outfit, face, hair and accessory arrangement are present; the rigid civilian contract remains intact.
- [must] Material separation correct: PASS — cloth, skin, hair, glove/rubber, metal and accessories use distinct approved palette materials; culling is enabled and relief clears underlying surfaces.
- [should] Hidden sides consistent: PASS — rear hair and outfit construction match the back reference; coat yoke/centre seam or rear apron straps/bow and guard lettering are modeled where applicable.
- [should] Triangle budget and faceting: PASS — LOD0 is 55,301 triangles, below 60k; LOD1 6,314 and LOD2 1,592 meet ratios and shipping budgets. The distant tier intentionally simplifies subpixel trim.
- [must] Fictional brands and adult characters: PASS — the model reads as a stylized adult; the only security marking is the fictional GBD from the supplied sheet.
- [must] Animation and infection material tags: PASS — all 19 humanoid nodes survive every tier; the actual runtime rig resolver and infection baker pass. Pose probes move both the hand and foot with their animated parents.

Geometry, known palette tokens, empty sockets, forward marker, bounds, nondegenerate faces, AO, meshopt/quantization and repeat-build determinism pass. Browser WebGL2 status: PASS, all three LODs without console errors. WebGPU remains the repository's manual check.

Stylization: no fabric weave or transparent lens texture is used. Smooth tailored shells and raised seams replace the painted concept's fine surface noise. The animated joint seams are inherent to the existing rigid-part character contract.

Verdict: PASS
Failing items and follow-up: none in the requested asset scope; integrator registration and manual WebGPU check remain.

Repository checks: typecheck, lint, build and the unit suite pass. `npm run verify -- E17` passes its tagged tests and 35/36 browser tests; `tests/e2e/art-integration.spec.ts:20` fails with “Infected spawn inside collider or outside grid”. These new NPCs remain unregistered, so that integration failure is outside this asset delivery. All 12 dedicated NPC WebGL2 checks pass.
