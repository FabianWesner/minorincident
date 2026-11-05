# Reference measurements and part list

The facade is 12 m wide; the main depth is 7.5 m, coping height 5.33 m and central stepped sign 6.14 m. The front faces +X. The floor contacts z=0 through the foundation and entry paving. Two classroom window groups, a narrow entrance sidelight and recessed blue double doors define the facade. Warm brick, cream coping and masonry, dark paw emblems, gold door hardware and two warm lanterns follow the reference. Roof includes a square louvered HVAC unit, two mushroom vents, a capped pipe and a membrane seam grid.

Static geometry joins by palette material within body, roof and interior groups. Door assemblies have vertical hinge origins; lantern assemblies pivot at their wall mounts and have point-light extras. The roof assembly can be hidden without hiding the sign. The inscription uses the correct fictional town name, SUNSET GROVE.

Opaque dark glazing with inset room silhouettes keeps the stylized miniature appearance and avoids transparent-surface sorting. All relief lettering, paw emblems, glazing accents and roof seam geometry have separated visible face planes. Ambient occlusion is baked deterministically with 32 CPU Cycles samples to vertex colors; the GLB carries COLOR_0 and no image textures.

The complete footprint is centered in X/Y, including the projecting entry paving. LOD0 is 88,660 triangles and 29 draws; LOD1 is 11,056 triangles. Far LOD removes brick relief before decimation. All LODs retain the semantic nodes, vertex AO, and light/collider extras. The build script exports all three LODs on every invocation.
