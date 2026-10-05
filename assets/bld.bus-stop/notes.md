# Sunset Grove bus stop

Reference proportions: long barrel canopy, four square posts and stepped feet,
open back rails, three seat and three back slats, framed slogan and route map.
Model is approximately 4.97 m wide, 2.04 m deep and 2.68 m tall. Entrance is +X;
all feet rest on z=0. Roof can be hidden through its named parent. No moving
parts or light emitters are present in the reference, so no animation/light
anchors are needed. Static geometry joins by material within roof/body groups.

Five visual rounds: detailed blockout; wider silhouette and simpler lettering;
bold font, reduced small-part bevels, geometry wear and vertex AO; closed roof
end caps; increased canopy-chip clearance after the final game-camera review. Poster paper, map layers, lettering and paint wear
have at least 3 mm separation from their supporting surfaces. Materials are
exact palette tokens with scalar Principled BSDF shading and no image textures.
Reference surface wear is represented by broad geometric chips and slat scars;
fine mottled paint scratches are deliberately omitted at the Side tier.

Build/render only with experiment/tools/blender_run.py, using slug
../assets/bld.bus-stop. Font uses macOS DIN Condensed Bold when installed,
otherwise Blender's built-in font. Exported GLB contains geometry only, so the
font is not a runtime dependency. Vertex AO bake uses 32 samples and seed 17.
