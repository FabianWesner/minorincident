# bld.house-d visual review

Verdict: PASS
Comparison: `assets/bld.house-d/renders/comparison.png`

Reference: original crop and cleaned imagegen upscale from the Level 1 neighborhood kit. Final Eevee reference and game-camera renders use backface culling; the model was refined in four visual rounds. Independently rebuilt artifacts are byte-identical at all three tiers.

## Checklist C

- [must] Recognizable at gameplay-camera distance: PASS — The yellow two-storey clapboard shell, hipped roof, central dormer, right rear chimney, shuttered windows and gabled entry portico remain legible in `renders/game.png`.
- [must] Main part layout matches: PASS — Front/side windows, entrance, roof/chimney placement and porch forms follow the source crop; optional garage is absent from the default model.
- [must] Material separation correct: PASS — Palette wall, cream trim, dark roof, warm glazing, wood, brick/stone, greenery and flowers remain distinct; no textures or custom unnamed materials.
- [must] No real brands/logos/trademarks: PASS — The models contain no text, brands, logos or trademarked details.
- [should] Hidden sides plausible and consistent: PASS — The final WebGL2 front/side/rear/study sheet shows consistent siding, glazing and closed roof/gable forms on the inferred elevations.
- [should] Within budget without visible faceting at gameplay distance: PASS — The hero silhouette has softened edges and smooth greenery, stays below 100k triangles and uses fewer than 40 hero material draws. The authored distant tier retains continuous wall and roof shells, porch masses, chimney and window casings without collapse holes or spikes.

## Evidence

- `renders/hero.png`: final reference angle, Eevee, 1600×900, 96 samples; full object and chimney in frame.
- `renders/game.png`: final game angle, Eevee, 960×540, 24 samples.
- `renders/door-open.png`: entrance leaf rotates around its jamb and exposes the interior floor, without a center-pivot orbit.
- Mirrored palette variants with optional garages were rendered and checked; winding, roof/chimney mirroring and whole-footprint centering are correct. Temporary variant/iteration renders are removed at handoff.
- Shared GLB validator checks bounds, finite/indexed triangles, material tokens, required nodes, separate door assembly, LOD budgets and file sizes. Additional checks enforce active AO colors, no textures, single-sided materials, resolvable `ss_light` links and meshopt/quantization. Every tier passes.
- Geometry hashes and full file bytes match the second independent build for all tiers, including AO and compressed output.
- Typecheck and lint pass. Unit tests pass: 200 tests / 65 files; two skipped files and two todo tests.

- Headless real-GPU WebGL2/Metal loaded all three compressed tiers without console warnings/errors; captures are in `renders/turnaround.png`, `renders/webgl2-game.png` and `renders/lods.png`. The generic viewer received its MeshoptDecoder through a response-only capture hook; no preview source or server was changed.
- Repeated final stationary gameplay frames are pixel-identical (1,260,000 pixels, maximum difference 0).
- Final delivered triangles: 82,726 / 11,138 / 3,308. Hero material draws: 38. Each distant tier uses 24 draws; all files are below 1.5 MB.
- Delivery QA found excessive unbounded AO and unsafe hero-mesh decimation at the distant tier. Actual Cycles visibility now gives a restrained 0.68–1.0 shade with opaque vertex alpha; LOD2 uses authored structural primitives. Final GLB captures confirm the identity colors, intact roofs/walls and comparable house mass across all three tiers.

## Limitations

Rear/interior forms are inferred from a single source view. Glazing reads more softly in the neutral Eevee studio than the vivid orange reference. Tiny address text was omitted. These are documented simplifications, not blockers for the building silhouette/layout.

WebGPU is reserved for manual checking by repository policy and was not launched. Manifest registration and full E17 integration verification remain with the integrator.
