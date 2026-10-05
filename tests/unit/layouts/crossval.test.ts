import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  districtIds,
  type DistrictLayout,
} from "../../../src/levels/districts/types";
import { districtGameplay } from "../../../src/levels/districts";
import { crossValidate } from "../../../src/levels/districts/crossValidate";
import { bakeNav } from "../../../src/sim/world/NavGrid";
import { resolveDecay } from "../../../src/levels/districts/validate";

test("T-E10-11 @E10 @E10-AC11 all TS anchor references, spawn volumes, triggers and objectives validate against layout/nav", () => {
  for (const id of districtIds) {
    const layout = JSON.parse(
      readFileSync(`public/assets/layouts/${id}.layout.json`, "utf8"),
    ) as DistrictLayout;
    for (const tier of [0, 1, 2, 3, 4, 5] as const) {
      const data = districtGameplay[id],
        blockers = data.decay
          .filter((d) => d.tier <= tier)
          .flatMap((d) => d.blockers);
      const nav = bakeNav(
        [
          {
            layout,
            origin: [0, 0],
            colliders: resolveDecay(layout, tier)
              .colliders.map((c) => c.aabb)
              .concat(blockers),
          },
        ],
        1,
      );
      const result = crossValidate(data, layout, nav);
      expect(result.errors, `${id}/W${tier}`).toEqual([]);
      expect(result.warnings).toContain(`Orphan anchor: ${id}/cat-perch`);
      const bad = structuredClone(data);
      bad.spawns = [
        { anchor: "missing" },
        { x: 1000, z: 1000 },
        { x: -14, z: -14 },
      ];
      expect(crossValidate(bad, layout, nav).errors.join(" ")).toMatch(
        /Missing anchor/,
      );
      expect(crossValidate(bad, layout, nav).errors.join(" ")).toMatch(
        /outside bounds/,
      );
      expect(crossValidate(bad, layout, nav).errors.join(" ")).toMatch(
        /not walkable/,
      );
    }
  }
});
