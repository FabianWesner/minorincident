# Sunset Grove fire station

Reference: `reference-upscaled.png`. The facade faces +X; the reference camera sees the -Y side. The large apron and planted curbs are included in this building asset. The reference's compact fire house is interpreted with approximately 3.6 m wide apparatus bays, a 5.9 m main parapet, and a 10.5 m tower finial. The building is grounded at z=0 and the paving footprint is centered.

Parts: open masonry shell and interior floor, two sectional apparatus doors, teal personnel door, recessed garage glass, raised panel mouldings, projecting sandstone lintels/copings, cream station sign and geometric fire-service crest, belfry stone arches/columns, cast bell and clapper, hipped roof shingles/hip caps/finial, three rooftop HVAC cabinets with fans and louvers, five wall lamps, glowing side window, four bollards, yellow apron guides, segmented paving/curbs, civic flag, shrubs/weeds/flowers.

All colour is palette material; lettering is extruded mesh. The flag is a fictional Sunset Grove civic flag rather than a real national flag. Decorative wear is represented by brick colour variation and masonry seams, without textures. Relief markings clear backing surfaces by at least 3 mm. Garage door pivots are at their top roller axes; service door pivot is on its vertical hinge; bell origin is its suspension joint. The removable `roof` contains roof decks, caps and rooftop equipment; `interior` contains the floor and door tracks. Collision nodes leave garage apertures free.

Only this folder is changed. Manifest placeholder dimensions are not changed; registry integration remains a separate task.

LOD construction keeps unbeveled closed solids, removes relief bricks and small dressing, reduces round forms individually, and replaces the tower shingles with a solid hip-roof pyramid. LOD2 removes lettering and minor trim and consolidates palette colours. This preserves silhouette and apertures without the shards produced by blanket decimation of disconnected detail. All levels carry baked AO and the same functional pivot nodes.
