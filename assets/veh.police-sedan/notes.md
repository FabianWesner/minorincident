# Sunset Grove police sedan

Reference: reference-upscaled.png. Length about 5.4 m including push bar; body width 1.88 m, mirrors 2.32 m, roof 1.67 m and light bar 1.93 m. Axle spacing 2.91 m, tyres 0.80 m. Front is +X, up +Z, wheel contact z=0.

Hero details: sculpted fender/body loft with circular wheel apertures; hollow tapered white cabin; four jointed doors with owned glazing, handles and livery; layered shields with raised star; vented steel wheels, rolled lips, hubs, lugs and tread; grille lattice, push bumper with bolts, fluted headlamps, tail/reverse lights, mirror housings, spotlight, wipers, antenna, plates and interior seats/dashboard.

All livery is solid geometry. Door badges and side lettering stand at least 3 mm outside their supporting panels. Static parts and each rigid assembly are joined by material. Joints are named empties with material mesh children whose origins coincide with the joint. No image texture is used by any exported material. The studio HDRI is render-only.

Production uses the palette tokens specified in the art direction. Glass is a dark palette tint with scalar alpha; ornament is deliberately simplified for clear game-scale reading. Fictional SG 104 plates and Sunset Grove shield microtype replace real brands.

The script exports baked vertex AO by default (`--skip-ao` is available for fast geometry-only builds). Rebuild the LODs with `--lod 1` and `--lod 2`. All assembly origins remain unchanged across LODs. A post-boolean/decimation cleanup removes numerical triangle slivers below 1e-8 m².

The first two standard Three.js captures hit stale Vite dependency imports. `capture.mjs` is an asset-local fallback that bundles the existing shared viewer in memory and intercepts only its module request; it uses the same GLTFLoader, lighting, cameras and render backends. It does not change the shared viewer or start a server.
