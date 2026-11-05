# Street sign review — three rounds

1. Solid blockout: correct two-plate silhouette and readable names, but post and bolt positions were mirrored relative to the reference. Text bevels created 29,292 triangles.
2. Corrected left-side post/right-side bolts, increased pole thickness and aligned the reference camera. Geometry remained excessive at 17,364 triangles.
3. Reduced bevel and outline segmentation without affecting gameplay readability. Adjusted teal toward the darker reference and compressed text horizontally for bolt clearance. Final mesh: 9,556 triangles / four material primitives.

Checklist C:
- PASS — recognizable street-name sign in both game-camera backends; both street names remain legible.
- PASS — two parallel plates, offset post, cream rounded rims, hex bolts, capped silver pole and dark stepped base match the reference part layout.
- PASS — four palette materials separate painted faces, rims/lettering, metallic post and dark hardware.
- PASS — hidden rear uses matching teal panels and solid clamps with fasteners.
- PASS — within the 6–12k Side budget, with softened edges and no distracting game-distance faceting.
- PASS — only Maple Ave / Pine St; no real brands.

No animatable or luminous parts on this fixed prop. Root and body are named; col:post is an empty collider. Surface offsets prevent coplanar text and face panels. GLB audit confirms finite coordinates, zero degenerate triangles, no textures, and four material primitives. Both WebGPU and WebGL2 load with no errors or warnings. Five settled game-camera frames per backend have zero changed pixels.

Validation: npm run typecheck; npm run lint; npm run test:unit -- --maxWorkers=4 (5 files, 12 tests passed). This asset task does not implement an entire epic; the GLB audit and required capture tools supply the asset-specific verification.
