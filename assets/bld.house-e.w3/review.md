# bld.house-e.w3 · lane visual review

Reviewed reference, four sides, authored LOD0/1/2, and the game camera at 122–131 px model height. Headless Chromium, Metal WebGL2, FOV25°, azimuth45°, polar54°. Images use the production GLBs and game palette renderer. Independent orchestrator acceptance is pending.

Dark irregular openings, broken sill accents and local soot survive all tiers. Roof and porch remain standing. Winding was corrected so char/void polygons face outward on all four facades. Far windows drop sash dividers and therefore read as larger dark openings.

Concrete limitations: textureless roof decks are smoother than the reference; foliage/flower density is reduced to protect distance budgets. House E has no garage in the integrated base; the exact existing porch and roof forms take precedence over adding one. The burned facade reference depicts a devastated whole building, while the L3 contract calls for localized standing fire damage.

Technical checks: triangle/draw/material/byte table is in test-results/l3-oak-houses-de/report.md. House anchor matrices match the original base exactly; projected footprints meet IoU >=0.9977 in every tier. Named doors, roof/interior groups and entrance/collider anchors survive. No generic decimation, texture atlas or new dependency.

Evidence: test-results/l3-oak-houses-de/bld.house-e.w3/lod-contact.png, comparison.png and game-camera.png. For houses, footprint.png and cutaway.png also verify placement and roof-off ownership.
