import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Mesh, Raycaster, Vector3 } from "three";
import { worldAssets as manifest } from "../../../src/assets/worldDefinitions";
import {
  districtIds,
  type DistrictLayout,
} from "../../../src/levels/districts/types";
import {
  validateLayout,
  minimapData,
  resolveDecay,
} from "../../../src/levels/districts/validate";
const layouts = districtIds.map(
  (id) =>
    JSON.parse(
      readFileSync(`public/assets/layouts/${id}.layout.json`, "utf8"),
    ) as DistrictLayout,
);

test("T-E10-01 @E10 @E10-AC01 closed bounds, connected roads, manifest references and lane exclusion", () => {
  for (const layout of layouts)
    expect(validateLayout(layout, manifest), layout.district).toEqual([]);
  const bad = structuredClone(layouts[0]);
  bad.bounds.pop();
  bad.placements[0].assetId = "missing";
  bad.placements[0].position = [0, 0, 0];
  bad.placements[0].visualAabb = { min: [-1, 0, -1], max: [1, 1, 1] };
  bad.roads.edges = bad.roads.edges.filter((e) => e.end !== "north");
  const errors = validateLayout(bad, manifest);
  for (const text of ["bounds", "road graph", "asset", "lane"])
    expect(errors.join(" ")).toContain(text);
});
test("T-E10-03 @E10 @E10-AC03 cumulative decay grows wrecks, removes base nodes and disables lights monotonically", () => {
  for (const layout of layouts) {
    const states = ([0, 1, 2, 3, 4, 5] as const).map((tier) =>
      resolveDecay(layout, tier),
    );
    for (let t = 1; t < 6; t++) {
      expect(states[t].placements.length).toBeGreaterThan(
        states[t - 1].placements.length,
      );
      expect(
        states[t].placements.filter((p) => p.assetId === "veh.wreck").length,
      ).toBeGreaterThan(
        states[t - 1].placements.filter((p) => p.assetId === "veh.wreck")
          .length,
      );
      expect(states[t].lights.length).toBeLessThanOrEqual(
        states[t - 1].lights.length,
      );
      const emitters = (state: (typeof states)[number]) =>
        state.placements.filter(
          (p) =>
            (p.assetId.startsWith("bld.") ||
              ["prop.street-lamp", "veh.sedan-red"].includes(p.assetId)) &&
            state.lights.includes(p.lightGroup),
        ).length;
      expect(emitters(states[t])).toBeLessThanOrEqual(emitters(states[t - 1]));
    }
    expect(states[0].lights).toHaveLength(4);
    expect(states[3].lights).toHaveLength(2);
    expect(states[5].lights).toHaveLength(0);
    expect(states[5].removed).toContain("collapse-canopy");
  }
});
test("T-E10-07 @E10 @E10-AC07 every building/heavy prop collider matches transformed manifest AABB within 10%", () => {
  for (const layout of layouts)
    for (const p of layout.placements) {
      const def = manifest[p.assetId as keyof typeof manifest];
      if (!def.world.solid) continue;
      const c = layout.colliders.find((c) => c.id === p.id)!;
      expect(c).toBeDefined();
      const sx =
        Math.abs(Math.cos(p.yaw)) * def.dimensions.x * p.scale[0] +
        Math.abs(Math.sin(p.yaw)) * def.dimensions.z * p.scale[2];
      const sz =
        Math.abs(Math.sin(p.yaw)) * def.dimensions.x * p.scale[0] +
        Math.abs(Math.cos(p.yaw)) * def.dimensions.z * p.scale[2];
      for (const [axis, extent] of [
        [0, sx],
        [2, sz],
      ]) {
        expect(
          Math.abs(c.aabb.max[axis] - c.aabb.min[axis] - extent) / extent,
        ).toBeLessThanOrEqual(0.1);
        expect(
          Math.abs(
            (c.aabb.max[axis] + c.aabb.min[axis]) / 2 - p.position[axis],
          ),
        ).toBeLessThanOrEqual(extent * 0.1);
      }
    }
});
test("T-E10-10 @E10 @E10-AC10 vector minimap overlays exported 3D roads within one metre", async () => {
  for (const layout of layouts) {
    const map = minimapData(layout);
    const buffer = readFileSync(
      `public/assets/layouts/${layout.district}.base.glb`,
    );
    const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ),
      "",
    );
    scene.updateMatrixWorld(true);
    const roadMeshes: Mesh[] = [];
    scene.traverse((node) => {
      if (
        node instanceof Mesh &&
        !Array.isArray(node.material) &&
        node.material.name === "pal_asphalt"
      )
        roadMeshes.push(node);
    });
    expect(roadMeshes.length).toBeGreaterThan(0);
    const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0), 0, 5);
    for (const road of map.roads)
      for (let i = 1; i < road.length; i++) {
        const a = road[i - 1],
          b = road[i],
          length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let distance = 0.5; distance < length; distance += 1) {
          const x = a[0] + ((b[0] - a[0]) * distance) / length,
            z = a[1] + ((b[1] - a[1]) * distance) / length;
          ray.ray.origin.set(x, 2, z);
          const hit = ray.intersectObjects(roadMeshes, false)[0];
          expect(hit, `${layout.district} road at ${x},${z}`).toBeDefined();
          expect(
            Math.hypot(hit.point.x - x, hit.point.z - z),
          ).toBeLessThanOrEqual(1);
        }
      }
    expect(map.buildings).toHaveLength(layout.buildings.length);
    map.roads.forEach((road, i) =>
      road.forEach((point, j) =>
        expect(
          Math.hypot(
            point[0] - layout.roads.edges[i].points[j][0],
            point[1] - layout.roads.edges[i].points[j][1],
          ),
        ).toBeLessThanOrEqual(1),
      ),
    );
  }
});
