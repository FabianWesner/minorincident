# prop.package-courier — side-tier review

Verdict: matches the concept at side-tier quality, with documented small-detail simplifications. Three modeling rounds. No manifest or registry edits; no commit.

The crop and built-in imagegen cleanup preserve the medical parcel and separate handheld scanner. The final geometry retains the warm orange rectangular box, wide medical cross, Sunset Grove Courier marking, blue cold-chain and red fragile labels, top barcode card, taped lid seam, reinforced corners, side up arrows, status displays, and orange/dark scanner with barcode screen. The scanner is slightly squarer and more upright than the reference. Tiny wear, label fine print, rounded snowflake branches, and degree sign are simplified. No invented branding.

Reviewed images retained: renders/hero.png (1600×900, Eevee, 96 samples), renders/game.png (960×540, Eevee, 24 samples), renders/turntable.png (front, side, rear, game), and renders/webgl2-{study,rear,game}.png (headless Metal WebGL2). Backface culling is enabled on Blender materials and every exported material is single-sided. The wineglass bowl winding was corrected after the round-2 render. Raised plates, text, barcode bars and icons stand at least 3 mm beyond their supporting surface; final captures show no missing faces or visible z-fighting. Rear is intentionally plain cardboard, matching the available reference's absence of rear markings.

Delivery: meshopt-compressed and quantized model.glb, model.lod1.glb and model.lod2.glb. Triangle counts 9,857 / 1,223 / 301 (12.4% and 3.1%); 20 material primitives, 13 shared palette tokens. LOD0 is 183,448 bytes, below 300 KB. Geometry and material counts meet side-tier limits. No image textures, exported cameras or lights. Both collider empties and root physics extras survive compression. Shared deterministic CPU AO is exported as vertex colors. Parcel faces +X, ground contact z=0; glTF exporter handles Y-up conversion.

All LODs pass the local audit for finite data, single-sided materials, collider retention, meshopt extension and zero textures. Headless WebGL2 study/rear/game review had zero console errors. The standalone preview lacks MeshoptDecoder, so the check script decodes the delivered GLB and intercepts only its HTTP response; no preview code is changed. This proves the delivered geometry renders, but does not validate the standalone preview's compressed-file loading. WebGPU is untested here because repository guidance reserves it for manual validation. No claim of WebGPU approval is made.

Reproduction and local verification commands are recorded in notes.md; prompt.md records the exact built-in imagegen prompt. report.json contains delivery statistics and decoded geometry hashes. Repository TypeScript/epic tests are not relevant to this isolated asset-only delivery; no code or epic criteria changed.

A second full Blender build plus delivery compression produced identical decoded geometry SHA-256 hashes for all three LODs.
