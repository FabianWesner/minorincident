# Lab signs review

Verdict: accepted for side tier; matches the reference's five props. Compared original/cleaned references with final Eevee `renders/hero.png` and `renders/game.png`, material backface culling on.

The authorized-personnel red sign, no-bicycles plate with bicycle/prohibition symbol, yellow warning triangle with black exclamation, deliveries/right-arrow/side-door plate, and grey security keypad are all present. Short mounting posts match the reference's stub proportions. Lettering and symbols are mesh geometry; border plates, screws, button caps and screen sit proud of the backing surfaces. Both game-camera signs and raised keypad buttons read clearly; no clipped or overflowing text, missing backfaces or coplanar stripes were seen.

Keypad includes a dark inset bezel, green READY screen, 12 numeric buttons and reader slot. Numeric legends and READY clarify tiny source details. Canonical foliageLight is less luminous than the concept's display. Typeface is the reproducible Blender built-in font; its round letters are intentionally faceted. No textures or additional palette colors.

Named placement parents preserve sign_authorized, sign_nobike, sign_hazard, sign_deliveries and keypad. +X front, ground z=0, assembly centered on X/Y. Each piece has an empty coarse collider. Automatic LODs are constrained to the original envelope because decimation initially inflated the thin plates; optimization prunes collapsed triangles.

Delivered triangles: LOD0 8,934; LOD1 1,030 (11.5%); LOD2 301 (3.4%). 19 draw calls and seven palette materials. Meshopt-compressed files approximately 85/23/16 KB, below the 300 KB side limit. Deterministic 32-sample CPU baked AO. Shared validator passes all tiers: geometry, dimensions, nodes, palette, forward marker, compression and budgets. Two independent factory-startup Blender builds have identical canonical geometry hashes (determinism.json).

Integration pending: manifest untouched. Its 2×2×0.3 dimensions are a placeholder; actual glTF assembly dimensions are approximately X=.296, Y=1.355, Z=4.052 m. Integrator must use these dimensions or independently place named pieces, and add script/source/LOD paths before changing status. WebGPU review remains manual. WebGL2 status is recorded separately if the shared browser slot becomes available.

Final validation: npm run typecheck and npm run lint passed; npm run test:unit -- --maxWorkers=4 passed (200 tests, 2 skipped files, 2 todo tests). WebGL2 was not run because the shared browser lock remained occupied; the queued smoke check was cancelled. No claim of browser verification. WebGPU remains a manual integration check.
