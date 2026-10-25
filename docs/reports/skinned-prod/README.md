# Skinned crowd production — final gates running

- Branch `lane/skinned-prod`: merged `lane/batch16` at `8574b670b`; runtime/assets committed through `bc86d7204`; no deployment.
- Nine archetypes select skins directly; the dev flag is removed. Unconverted assets stay rigid, including elderly (its source cane is fused into the hand).
- All 52 civilian clips, weighted grips, posed picking/bounds/health bars and CrowdFigureProbe are implemented and exercised.
- Native head fits retain hats and spectacles; the accessory oracle checks 12 mm spectacle clearance and fit-cache invalidation.
- Delivery: quantized normals/UVs/weights, meshopt and ETC1S; largest LOD0/1/2 files are 473,752 / 206,628 / 146,080 bytes.
- [Automatic build proofs](builds/): unseen L1 man A, man B and woman B, plus nurse/dog; zero manual steps. The [quadruped contract](rig-contract.md) is proven on both zebras.
- Healthy-source infection preserves clothing paint while desaturating skin and adding red eyes; shared textures and both couriers are carried from batch16.
- [Captures](captures.md): both backends, clips, accessories, infection, arm/leg/head caps, frozen severed corpses, hit flash, combat gibs and LODs; all 12 wound HDR readbacks are finite.
- [L1 census](l1-census.md): all 20 potential IDs, 14 observed per seeded route, high/low counts, named actors, pets, couriers, corpses and cast-source availability.
- [Perf versus current main](performance-analysis.md): WebGL2 +0.70 ms, WebGPU +0.80 ms, 200 actors/six skins/19 draws. Validator, typecheck/lint, 56 scoped tests, E17 (47 browser + 371 assets), invariants (28 sim + 12 WebGPU) and visuals green; final remote units/levels and L1–L10 campaign remain pending.
