# White pickup: production review

Verdict: pass. Three paired reference/game review rounds.

The square single cab, sloped windshield, open ribbed bed, rolled wheel arches,
off-road tread, steel rims, metal bumpers and round lamps match the reference
identity. Warm white paint, geometric rust, shallow hood/door dents and blank
fictional oval badge retain its worn suburban pickup character. No real brands.
Opaque purple-gray glazing is a deliberate stylized rendering choice.

Purposeful details include axle/suspension hardware, lugs, ventilation pockets,
wipers, cowl vents, mirrors, handles, bed ribs/tubs, fuel door, tailgate hinges
and lamp housings. All static geometry is grouped by palette material. Wheels,
doors, tailgate and lamps retain named pivots; driver and exit sockets, collider
and light/physics extras are exported. AO is baked into vertex colors.

LOD0: 73,847 triangles, 37 total draw calls, 5,361,816 bytes.
LOD1: 9,010 triangles (12.2%). LOD2: 2,302 triangles (3.1%).
All levels pass finite geometry, nondegenerate triangles, required nodes,
unit-scale motion pivots, ground contact, manifest bounds and texture-free
palette-material checks. Thin LOD glazing retains separated planes to prevent
decimation from collapsing the glass and gaskets together.

Both WebGPU and WebGL2 loaded all three levels without errors or warnings.
Fixed game-camera frames separated by 1.2 seconds have zero changed pixels on
both backends. All three final GLBs reproduce byte for byte in a second build.

Evidence: renders/round1-ref.png through round3-ref.png and paired game views;
renders/hero.png (1600×900, 96 samples); renders/game.png; renders/three-*.png;
renders/three-lod1-*.png; renders/three-lod2-*.png; validation.json,
rebuild-check.json, browser-check*.jsonl and stability.json.

Source cleanup: shared grid-shell helper for shaped hood/doors; simple chamfer
prisms for tread blocks; micro bevel segment reductions; collapsed-face removal
after fitting; no unused UV or redundant color channels in the export.
