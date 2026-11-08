# World destruction

## Ownership and district rollout

L3 opts in two Oak Street `bld.house-a` placements (`407`, `457`) and its two abandoned blue/green sedans. Other L3 buildings and vehicles explicitly carry `indestructible: true`. Mission actors, gates, road supports, and objective geometry retain their existing owners.

A placement opts in with `destruction: { class: 'timber' }`. Classes are `timber`, `masonry`, `concrete`, `vehicle`, `wood-prop`, and `metal-prop`; material, part HP, burn duration, and collapse threshold live in `src/data/destructionModel.ts`. The system is not tied to L3 IDs. The district chooses its safe rollout set.

The r12 `PropSystem` owns parked-car rigid bodies, movement, settling, and navigation. Destruction borrows those poses and never creates a second car body. `movableProps` exposes r12's wider catalog; the existing `pushableProps` catalog remains the default for layout clearance. Extra movable placements opt in explicitly, avoiding changes to other districts' parked-car clearance.

## Parts and weapons

`tools/assets/bake-destruction-parts.ts` reads authored door, window and roof bounds from the existing GLBs into a small sim-only JSON file. Optimized sedan meshes retain empty door anchors, so shared cabin-glass and panel zones provide their parts. A fixed structural grid partitions the remaining occupied collision shell. Floors below 45 cm stay intact as walkable supports.

`src/data/destruction.ts` scales authored weapon damage by material: glass, wood, metal, brick, concrete. Handguns make bounded impact marks and break glass; shotgun pellets hit separate parts; axes cut timber doors; sustained machine-gun fire removes thin wood sections; grenades, pipe bombs and rockets damage parts with radial falloff. Incendiary zones ignite timber and cars. The `weapon.flamethrower` fire-response ID is supported for future callers; the game does not currently have a carried flamethrower action.

Combat compares environmental hits with actor and cover distances. Projectiles, shotgun pellets, melee strikes, explosions, and the mounted gun share the same placement damage owner. Entity damage skips placement-owned cars to prevent double damage. Environmental chain blasts retain their existing authored damage curves.

Breaking a structural part removes its Rapier collider and navigation/visibility blocker in the same tick. Lost structural support drops the roof. Fire runs on fixed ticks: timber burns through, a car burns for five seconds and explodes once, and nearby existing fire zones can ignite other opted-in objects. Explosion impulses use the existing r12 body and pooled debris; detached door panels have their own larger collision shape.

## Presentation and budgets

Intact neighbours stay in their shared district batches. On first damage, only the hit instance is extracted. Its existing LOD1 prototype is clipped at the sim's part boundaries, preserving vertex attributes and materials. Subsequent part changes rewrite triangle indices without splitting geometry again. Up to eight local impact/scorch marks are retained per object. The car's existing burned variant replaces its broken shell after explosion and follows the same rigid body.

The district preloads only its opted-in prototypes and burned-car variants. The pilot has four objects, so its split buffers and marks are bounded. Cosmetic debris reuses the existing 32-body pool on both tiers (below the low-tier cap), expires after eight seconds, and never blocks characters. The system owns and disposes extracted buffers; asset-cache materials and prototypes remain borrowed.

## Persistence and extension

Per-part HP, burn clock, collapse/explosion state and marks are copied into mission checkpoint seams and game-state hashes. Restore rebinds props and rebuilds only surviving blockers, including after physics-world/tier replacement. Cosmetic debris and pending cosmetic kicks are discarded on rebuild, as with the existing explosion system.

To extend the rollout:

1. Flag ordinary placements with a class and explicitly protect story-critical geometry. Keep floors and required bridges/supports immutable.
2. Bake semantic bounds for the new asset, or supply zones matching its authored geometry. Inspect both intact and breached views; generic bounds do not replace asset review.
3. Add explicit weapon response rows when the conservative fallback is unsuitable.
4. Exercise real input, same-tick collider/nav removal, protected neighbours, checkpoint replay, and fire expiry in the existing world-system tests. Run the scene and full threat gates before expanding the district set.

The model is discrete part destruction, not arbitrary continuous mesh deformation. Vehicle hull collision remains with the parked-car body after its panels break and after the burned-variant swap.
