# E15 · VFX, Blood and Feedback

## Goal
Juicy, readable feedback: hit flashes, hit-stop, **heavy stylized gore** (blood sprays, pools, accumulation, dismemberment, gibs; setting-controlled, see `01-art-direction.md` §7), muzzle flashes, tracers, explosions, fire, smoke, toxic clouds, sparks, telegraphs, and decay ambience (ash, smoke columns). All VFX are **views** driven by sim events, with no gameplay effect.

## Depends on / Enables
E05 / all levels, E18.

## Scope
**In:**
- A GPU particle system (TSL, pooled emitters, instanced quads/meshes) and a decal system (projected quads on the ground plane, pooled, cap 600, fade 120 s).
- Effects: hit flash (an emissive pulse on the target), hit-stop (sim-visual time dilation **in the render layer only**, so the sim stays deterministic), blood sprays + arterial arcs + droplets + pooling floor decals (cap 600, fade 120 s), blood trails from wounded infected, **blood accumulation** masks on weapons, the player, and vehicles, **dismemberment** (detach limb node → physics gib, stump cap shown, cap 80 gibs) on heavy melee, close shotgun, explosive, and high-speed vehicle kills, chunky gibs for explosions, muzzle flash + tracer, shell casings (high tier), explosion (fireball, shockwave ring, debris, scorch decal, camera shake), fire (small, medium, building), smoke columns, car damage smoke and fire, toxic cloud, electric arc, screamer ring, telegraph decals (lunge line, charge lane, splash circle, Bloated warning), objective sparkle, and pickup glow.
- **Gore setting:** Full (everything) / Reduced (blood only, no dismemberment or gibs) / Off (dark-gray splats, no decals, no dismemberment).
- Colorblind-safe telegraphs (shape + color).
- **Explosions, fire, and smoke** are specified in detail in **E27** (seven-beat blast anatomy, smoke types). E15 provides the particle, decal, and pooling infrastructure they use (soft particles, light-field sampling hook, flipbook-free TSL noise).

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Noises.js`](../folio-2025/sources/Game/Noises.js): noise textures
- [`World/Leaves.js`](../folio-2025/sources/Game/World/Leaves.js): leaves and ash scatter
- [`World/Confetti.js`](../folio-2025/sources/Game/World/Confetti.js): burst particles → sparks and gibs
- [`Trails.js`](../folio-2025/sources/Game/Trails.js): tracers
- [`Materials/MeshDefaultMaterial.js`](../folio-2025/sources/Game/Materials/MeshDefaultMaterial.js): blood mask hook

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E15-AC01 | VFX never change sim state: the state hash after a 60 s combat script is identical with VFX on, VFX off, and every gore setting | sim/e2e |
| E15-AC02 | Pools: 10 minutes of the `vfx-stress` scenario keep particle and decal counts ≤ caps, with no growth in GPU geometries or textures after warm-up (`perf()` stable) | e2e/perf |
| E15-AC03 | Blood Off: no pixels with hue 345–15°, S > 0.6, V > 0.4 inside decal areas in the `blood-probe` spot; Full: such pixels exist | visual |
| E15-AC04 | Every `telegraph` event spawns a telegraph decal within 1 frame that lasts until the attack resolves; screenshots of each telegraph type are captured | e2e/visual |
| E15-AC05 | Explosion VFX scales with radius (the shockwave ring's max screen radius ∝ splash radius ±15%) | visual |
| E15-AC06 | Hit-stop on melee hits lasts 40–70 ms of render time and is skipped when 8+ hits occur in a 200 ms window (no stutter in crowds) | e2e |
| E15-AC07 | Effects read in the golden-hour and night tiers: the vision checklist §7.1, Checklist D passes on `vfx-showcase` spots for L4 and L6 lighting | vision |
| E15-AC08 | Flash reduction setting caps the full-screen brightness delta per frame to ≤ 20% (measured on explosion frames) | visual |
| E15-AC09 | Dismemberment: in `gore-probe`, machete kills detach a limb in 35% ±5% of 200 kills (seeded); explosions detach all limbs; detached limbs spawn gibs that despawn after 30 s; with gore Reduced or Off, no limb detaches, while the kill counts and sim state hash are unchanged | sim/e2e |
| E15-AC10 | Blood accumulation: after 30 melee kills, the weapon and player blood masks reach ≥ 50% coverage; they reset at level start; disabled with gore Off | e2e |
