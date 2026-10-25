# Skinned crowd production — verified

- `lane/skinned-prod` merges batch16 (`8574b670b`); tested runtime/assets `bc86d7204`. Nine archetypes select skins directly without a dev flag; unconverted figures stay rigid. No deployment.
- All 52 civilian clips, weighted grips, posed picking/bounds/health-bar heights and CrowdFigureProbe are implemented and exercised.
- Hats and glasses fit native skinned heads; the accessory oracle checks 12 mm spectacle clearance and fit-cache invalidation.
- Quantized normals/UVs/weights, meshopt and ETC1S: largest LOD0/1/2 files are 473,752 / 206,628 / 146,080 bytes, below every delivery limit.
- [Automatic build proofs](builds/): unseen L1 man A, man B and woman B, plus nurse/dog, have zero manual steps. The [quadruped contract](rig-contract.md) is proven on both zebras.
- Healthy-source infection preserves clothing paint while desaturating skin and adding red eyes; shared textures and both couriers are integrated.
- [Captures](captures.md): both backends, all clips, accessories, infection, arm/leg/head caps, frozen severed corpses, hit flash, combat gibs and LODs; all 12 wound HDR readbacks are finite.
- [L1 census](l1-census.md): all 20 potential IDs, 14 observed per seeded route, high/low counts, player, named actors, pets, couriers, corpses and cast-source availability.
- [200-AI perf versus main](performance-analysis.md): six skinned archetypes, 19 crowd draws; WebGL2 +0.70 ms, WebGPU +0.80 ms. Same-window L6 load: 2.47 s versus 2.67 s baseline.
- [All gates passed](gates/final.json): validator (1,262 rows), typecheck/lint, remote units/levels (2,692 passed; nine intentional skips), E17/smoke (47 browser + 371 assets), invariants (28 sim + 12 WebGPU); [campaign](campaign/summary.json) 10/10, no skipped steps, P0/P1 zero, five P2 observations retained.
