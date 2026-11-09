# World destruction

## Ownership and district rollout

L3 opts in two Oak Street `bld.house-a` placements (`407`, `457`) and its two abandoned blue/green sedans. Other L3 buildings and vehicles explicitly carry `indestructible: true`. Mission actors, gates, road supports, and objective geometry retain their existing owners.

`src/levels/destructionRollout.ts` extends the opt-ins before district collision is constructed. L1/L2 and L4/L5 use ordinary parked civilian cars and small sheds. Fairhaven's authored `l4-*`/`l5-*` combat dressing remains intact to preserve accepted threat numbers. L9 adds parked civilian cars, sheds/garages and roadside barricades. L10 adds abandoned cars, farm ruins/sheds, checkpoint huts, and the dispersal complex's machinery/fuel tanks (x ≥ 3750); the console and required supports retain their existing ownership. L3 retains its reviewed pilot set.

A placement opts in with `destruction: { class: 'timber' }`. Classes are `timber`, `masonry`, `concrete`, `vehicle`, `wood-prop`, and `metal-prop`; material, part HP, burn duration, and collapse threshold live in `src/data/destructionModel.ts`. The system is not tied to L3 IDs. The district chooses its safe rollout set.

The r12 `PropSystem` owns parked-car rigid bodies, movement, settling, and navigation. Destruction borrows those poses and never creates a second car body. The shared `pushableProps` catalog is the completed r12 catalog from main, including parked vehicles.

## Parts and weapons

`tools/assets/bake-destruction-parts.ts` reads authored door, window and roof bounds from the existing GLBs into a small sim-only JSON file. Optimized sedan meshes retain empty door anchors, so shared cabin-glass and panel zones provide their parts. A fixed structural grid partitions the remaining occupied collision shell. Floors below 45 cm stay intact as walkable supports.

`src/data/destruction.ts` scales authored weapon damage by material: glass, wood, metal, brick, concrete. Handguns make bounded impact marks and break glass; shotgun pellets hit separate parts; axes cut timber doors; sustained machine-gun fire removes thin wood sections; grenades, pipe bombs and rockets damage parts with radial falloff. Incendiary zones ignite timber and cars. The `weapon.flamethrower` fire-response ID is supported for future callers; the game does not currently have a carried flamethrower action.

Combat compares environmental hits with actor and cover distances. Projectiles, shotgun pellets, melee strikes, explosions, and the mounted gun share the same placement damage owner. Entity damage skips placement-owned cars to prevent double damage. Environmental chain blasts retain their existing authored damage curves.

Breaking a structural part removes its Rapier collider and navigation/visibility blocker in the same tick. Lost structural support drops the roof. Fire runs on fixed ticks: timber burns through, a car burns for five seconds and explodes once, and nearby existing fire zones can ignite other opted-in objects. The owned fire follows a moving car and uses the existing 24-fire cap. Explosion impulses use the existing r12 body and pooled debris; detached door panels have their own larger collision shape.

## Presentation and budgets

Intact neighbours stay in their shared district batches. On first damage, only the hit instance is extracted. Its existing LOD1 prototype is clipped at the sim's part boundaries, preserving vertex attributes and materials. Subsequent part changes rewrite triangle indices without splitting geometry again. Up to eight local impact/scorch marks are retained per object. The car's existing burned variant replaces its broken shell after explosion and follows the same rigid body.

The district preloads only its opted-in prototypes and burned-car variants. Split buffers and marks are bounded by the authored opt-in set; first damage allocates the split buffers. Cosmetic debris reuses the existing 32-body pool on both tiers (below the low-tier cap), expires after eight seconds, and never blocks characters. The system owns and disposes extracted buffers; asset-cache materials and prototypes remain borrowed.

## Persistence and extension

Per-part HP, burn clock, collapse/explosion state and marks are copied into mission checkpoint seams and game-state hashes. Restore rebinds props, rebases owned-fire expiry to the restored burn clock, and rebuilds only surviving blockers, including after physics-world/tier replacement. Placements absent at the current decay tier retain their saved damage but stop rendering, blocking, burning and receiving damage. Cosmetic debris and pending cosmetic kicks are discarded on rebuild, as with the existing explosion system.

To extend the rollout:

1. Flag ordinary placements with a class and explicitly protect story-critical geometry. Keep floors and required bridges/supports immutable.
2. Bake semantic bounds for the new asset, or supply zones matching its authored geometry. Inspect both intact and breached views; generic bounds do not replace asset review.
3. Add explicit weapon response rows when the conservative fallback is unsuitable.
4. Exercise real input, same-tick collider/nav removal, protected neighbours, checkpoint replay, and fire expiry in the existing world-system tests. Run the scene and full threat gates before expanding the district set.

The model is discrete part destruction, not arbitrary continuous mesh deformation. Vehicle hull collision remains with the parked-car body after its panels break and after the burned-variant swap.

## Boss integration

`pillar` (concrete), `machinery` (metal), and `fuel-tank` (metal) policies use a single structural zone and no synthetic roof. They require an asset with baked static collision, just like buildings. Opt in arena placements before district construction; keep the console, gate and required arena supports protected. These policies do not place new objects in L8/L10 or implement the boss move state machines.

After its telegraph and physical contact resolve, the boss lane calls `world.destruction?.impact(placementId, 'boss.gorilla.smash', damage)` or `'boss.mega.charge'`. The stable placement ID includes the district prefix. The boolean reports whether this contact broke a part; the boss controller owns stun/recovery. Damage uses the normal material table, protection rules, debris, blockers and checkpoint seam. Fuel tanks ignite on structural failure or fire, burn for 60 fixed ticks, then trigger one shared car-sized chain explosion. Their exploded flag is set before emitting the blast to prevent recursive detonation. Ordinary machinery does not explode. Destroyed movable props/machinery relinquish their borrowed body and navigation blocker immediately; checkpoint restore re-enables that body. Vehicle wrecks retain their hull.
