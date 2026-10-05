import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { compositions } from "../../src/levels/compositions";
import { districtGameplay } from "../../src/levels/districts";
import {
  districtIds,
  type DistrictLayout,
} from "../../src/levels/districts/types";
import {
  resolvePosition,
  resolveDecay,
} from "../../src/levels/districts/validate";
import { bakeNav } from "../../src/sim/world/NavGrid";
const layouts = Object.fromEntries(
  districtIds.map((id) => [
    id,
    JSON.parse(
      readFileSync(`public/assets/layouts/${id}.layout.json`, "utf8"),
    ) as DistrictLayout,
  ]),
);
test("T-E10-02 @E10 @E10-AC02 deterministic nav connects every composition objective from player start at every tier", () => {
  for (const level of Object.values(compositions))
    for (const tier of [0, 1, 2, 3, 4, 5] as const) {
      const inputs = level.districts.map((d) => ({
        layout: layouts[d.id],
        origin: d.origin,
        colliders: resolveDecay(layouts[d.id], tier)
          .colliders.map((c) => c.aabb)
          .concat(
            districtGameplay[d.id].decay
              .filter((d) => d.tier <= tier)
              .flatMap((d) => d.blockers),
          ),
      }));
      for (const seed of [1, 42, 2026]) {
        const nav = bakeNav(inputs, seed);
        expect(bakeNav(inputs, seed).hash).toBe(nav.hash);
        const first = level.districts[0],
          start = resolvePosition(
            districtGameplay[first.id].playerStart,
            layouts[first.id],
          );
        const reached = nav.flood([
          start[0] + first.origin[0],
          start[1] + first.origin[1],
        ]);
        for (const d of level.districts)
          for (const obj of districtGameplay[d.id].objectives) {
            const p = resolvePosition(obj.position, layouts[d.id]);
            expect(
              reached[nav.index(p[0] + d.origin[0], p[1] + d.origin[1])],
              `${level.id}/${d.id}/${obj.id}/W${tier}`,
            ).toBe(1);
          }
      }
    }
});

test("T-E10-runtime @E10 gameplay blockers have Rapier colliders, fires damage only in range, and unload releases resources", async () => {
  const { SimWorld } = await import("../../src/sim/world/SimWorld");
  const world = new SimWorld();
  await world.init();
  try {
    const comp = { ...compositions.L6, tier: 5 as const };
    world.loadComposition(comp, Object.values(layouts), 42);
    expect(world.districts!.getState().districts).toHaveLength(8);
    const start = world.districts!.playerStart;
    expect(
      world
        .query({ within: { x: start[0], z: start[1], r: 1 } })
        .map((entity) => entity.id),
    ).toEqual([1]);
    expect(world.player).not.toBeNull();
    expect(world.physics.characterController).not.toBeNull();
    const colliderCount =
      2 +
      world.districts!.districts.reduce(
        (n, d) => n + d.decay.colliders.length + d.blockers.length,
        0,
      );
    expect(world.physics.colliderCount).toBe(colliderCount);
    for (let i = 0; i < 60; i++) world.update();
    expect(world.entities.get(1)!.health.current).toBe(100);
    const fire = world.districts!.fires[0];
    Object.assign(world.entities.get(1)!.transform, {
      x: fire.x,
      y: 0.705,
      z: fire.z,
    });
    world.physics.playerBody!.setTranslation(
      { x: fire.x, y: 0.5, z: fire.z },
      true,
    );
    for (let i = 0; i < 60; i++) world.update();
    expect(world.entities.get(1)!.health.current).toBeLessThan(100);
    world.reset();
    expect(world.districts).toBeNull();
    expect(world.physics.colliderCount).toBe(0);
  } finally {
    world.dispose();
  }
});
