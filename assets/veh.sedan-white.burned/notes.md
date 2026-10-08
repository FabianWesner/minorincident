# veh.sedan-white.burned

Base-owned `burned` decay variant of `veh.sedan-white`; no second runtime mesh entry.
Build: `npm run assets:build -- veh.sedan-white --decay burned`, then pack the base.
Source recipe: `tools/blender/sslib/civilian_burned.py`, derived from the base's
closed authored native LOD1 for near/mid and LOD2 for far. No decimation, fit,
scale changes, dependencies or textures. Near/mid split only native painted
panels for authored heat buckling; far omits subdivisions and seat remnants,
and substitutes explicit eight-sided collapsed tyres with six-sided hubs.

Retains original livery, body profile, axle/door/seat/exit sockets and collider
transforms. Doors are frozen as bent static dressing while their hinge empties
remain; wheel owners retain the base animation contract. Static body geometry
is merged by palette material: paint, char, bare metal, plus four wheel draws.
Glazing is physically removed. Real hood/roof tears, an upturned hood lip,
exposed seat frames, soot fields and four flattened tyre carcasses are authored.
Light anchors are non-emitting; no active flames are baked. Root physics is
heavy, non-pushable, non-kickable, non-flammable spent shell.

Runtime interface: request `veh.sedan-white` with decay `burned`; district lane owns at
least ten placements total across these four variants, surrounding fire/smoke,
sound and gameplay. Existing anchor positions are unchanged. The native
collider remains a stable coarse vehicle envelope for static dressing.

Evidence: `test-results/l5-burned-civilian-cars/veh.sedan-white.burned/`.
