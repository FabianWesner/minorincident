# Police SUV measurements and assembly

Reference: reference-upscaled.png, 1536×1024, main three-quarter view plus side/front/rear turnaround. Approximate production dimensions: body 4.75 m × 1.98 m; wheelbase 2.97 m; tyre diameter 0.92 m; roof 2.12 m; lightbar 2.43 m. Nose +X, left +Y, ground z=0. Push bar adds 0.45 m to the nose.

Parts: sculpted shell with cut wheel wells, white four-door cabin, separate window panes and gaskets, seats/headrests/dashboard/steering wheel, raised POLICE and SUNSET GROVE lettering split between doors, steel wheels with layered profiles/vent wells/hubs/lugs/tread, wheel-arch flares, running boards, mirrors, searchlights, lamps, slatted grille, substantial push bar, rear plates/bumper pads, rear wiper, roof rack/aerial, red/blue LED lightbar.

Four door origins sit at front hinges; wheel origins sit at axle centres. Lamp, searchlight, and siren nodes have local joint origins. Static meshes join by material; moving assemblies join only within their parent. Explicit LOD builds retain these groups and sockets. Every panel and lettering layer is separated from the underlying skin by at least 3 mm. No image textures or real brands.

Final full silhouette bounds, including mirrors/push bar/aerial: 5.292 × 2.483 × 2.500 m. The script centres these bounds on X/Y and lifts the tyre contact to z=0. Explicit LOD1 is 7,872 triangles (10.5%); LOD2 is 2,488 triangles (3.3%). Both retain closed major forms, raised POLICE lettering, windows, wheels, lamps and motion pivots.
