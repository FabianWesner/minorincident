# Crow flock-budget QA revision

The previous hero model exceeded the new 3,000-triangle crow budget. It was rebuilt with broad, closed ragged wing/tail shells and low-segment volumes rather than heavily decimating the detailed feather model. LOD0 is 2,442 exported triangles, a 93.7% reduction. Lower LODs are regenerated from the same script.

The silhouette, open hooked beak, crown, emissive red eyes and curled talons are retained. All bird and infected compatibility nodes remain. Wing roots, elbows and distal bands have separate rigid parents, so flapping and folding remain possible. Hidden stump caps use eight triangles each. The pose sheet shows left wing/forearm and right leg motion plus the restored left shoulder stump.

The revised model intentionally uses chunky feather fans for flock rendering. This is the requested simplification, rather than an unresolved art gap. The new hero, four-view turnaround and pose sheet replace their previous versions. Palette-only materials, no textures/skins, exact ground contact, required nodes and all three LOD files are checked by validate.py; WebGPU and WebGL2 results are recorded in browser-check.jsonl.
