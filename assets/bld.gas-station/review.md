# Sunset Fuel — final review

Verdict: passes Hero asset review after five visual rounds.

The model preserves the reference's shop/canopy/three-pump/price-sign composition, cream trim, red and navy brand fascia, sunset emblem, red digital price rows, Sunset Fuel and Sunset Grove lettering, warm shop stock displays, yellow islands and guards, pump controls and hose loops. Soft edges, hardware, roof equipment, masonry joints and sparse coarse wear supply close-range detail.

The storefront faces +X, the lot is centered in XY, and the model contacts z=0. `root`, `roof`, `interior`, hinged `door_front`, separate named lamp assemblies, six light anchors and building/column/sign/pump collider empties are present. Roof and interior can be hidden independently. Static geometry joins by material within control assemblies; animation pivots stay separate. Materials are scalar Principled palette/emission materials with no image textures. All LODs include the baked AO channel.

| Export | Triangles | Total draw calls | Static draw calls |
|---|---:|---:|---:|
| LOD0 | 94,400 | 39 | 29 |
| LOD1 | 11,263 (11.9%) | 39 | 29 |
| LOD2 | 2,548 (2.7%) | 11 | 8 |

Tier draw caps exclude animated assemblies, as specified. LOD2 keeps the main structural silhouette and controls while omitting stock, small signage lettering, hoses, lamp housings and tiny surface details. Thin panels remain actual boxes rather than collapsed triangles. Geometry checks find no NaNs, degenerate triangles or textures.

`renders/hero.png` is 1600×900 at 96 samples; `renders/game.png` is 960×540 at 24 samples. Final Three.js captures include study/front-quarter, opposite-quarter and game views on WebGPU and WebGL2, with zero warnings/errors. Both reduced LODs also load and render without errors on both backends.

The initial distant-camera canopy depth streaks were fixed by removing the broad cream underlay, modeling perimeter trim, and making roof seams physical panel gaps. Final game-camera images and ±0.2° camera captures show clean roof/floor surfaces. Five repeated frames on each backend are pixel-identical (`flicker.json`). Raised plates, markings and lettering have explicit offsets; no coplanar decals are used.

Review infrastructure exception: the shared preview server injects a missing `/@vite/client` development script. The asset-local review hook substitutes an empty response for that HMR request and resolves the existing worktree Playwright installation. Model and renderer requests remain unmodified. No shared tooling, server, specs or reference images were edited.
