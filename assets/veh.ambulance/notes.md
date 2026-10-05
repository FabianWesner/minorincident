# Ambulance production notes

Reference: `reference-upscaled.png`, white patient box and forward cab, broad
red waist stripe, six-arm blue medical emblems, five front lightbar modules
(red/red/blue/red/red), corner scene lights, steel wheels, compartment framing.

Blender coordinates: +X front, +Z up, metres. Wheel tread ground contact is
z=0. Overall envelope is approximately 6.659 × 2.74 × 3.375 m (including mirrors and bumpers); axle centres
are x=-1.95 and x=2.12. Patient box is 3.75 × 2.24 × 2.78 m. Cab side skin
is |y|=1.02, patient skin |y|=1.12. Stripe bases clear the body by 5 mm;
lettering and emblems use thicker offsets. Stripes are cut around arches and
moving doors rather than overlaid across them. Door stripes remain attached
to their own door panels.

Purposeful parts: beveled body and roof cap, chrome rails and arch trims,
locker frames/handles, patient entry and paired rear doors, cab entry doors,
glazed cabin with seats/headrests/steering/dashboard, grille slats and medical
roundel (fictional, no vehicle brand), headlamps/indicators, wipers, mirrors,
hood vents, footstep tread plate, mudflaps, shaped tyres/steel rims/lugs,
LED lightbar and side emergency lights, marker lamps and roof edging.
Opposite box flank has equipment compartments. Text uses AMBULANCE and
SUNSET GROVE only. The blue grille roundel is circular, without a brand mark.

Motion joints: four wheel centres; front cab-door hinges; patient side-door
hinge; two outer rear-door hinges; independent headlight, brake and siren
assemblies. Static meshes are joined by material, moving groups separately
by material. Door trim uses white paint to keep total draw calls <=40.
Light semantics and two cuboid colliders are exported in extras.

The shared sslib is not present in this checkout, so this build uses local
bpy helpers and named palette materials. It learns from the sol study but
corrects surface clearance, arch stripe overlap, branding, pivots, node
contracts and draw-call batching. The referenced mid study is absent.

LOD1/LOD2 preserve named motion joints and use deterministic collapse decimation.
LOD0 includes a 32-sample, seed-0 Cycles vertex AO bake, exported as colors.
