# Street lamp

3.865 m tall; 0.64 m roof width; 0.60 m footing. The reference's square stepped plinth, octagonal tapered pedestal, long faceted shaft, turned capital, tapered four-pane lantern, pyramid canopy and pointed finial are preserved. No brands or markings appear in the reference.

Three rounds: initial silhouette; bevel budget and bronze/emission adjustment with baked AO; thicker corner stiles and slightly steeper roof. Static bronze geometry is joined as `body`; `lantern` is independently switchable with its origin at the lower frame. `light:lantern` contains the runtime light contract; `col:post` is an empty collider. The static fixture requires no movable-body physics extras. Pane faces are recessed more than 14 mm behind their frames. Materials are scalar Principled BSDF with emission and no images.

The bronze uses a darker tuned woodWarm palette value to match the aged metal reference. AO is deterministically Cycles-baked into the `ao` corner color attribute at 32 samples.
