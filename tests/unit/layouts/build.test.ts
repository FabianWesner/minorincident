import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  buildLayout,
  districts,
  layoutSourceHash,
} from "../../../tools/layouts/build";

test("T-E10-12 @E10 @E10-AC12 headless Blender rebuild is deterministic and TS gameplay does not rebuild", () => {
  for (const id of districts) {
    buildLayout(id, true);
    const path = `public/assets/layouts/${id}.layout.json`,
      first = readFileSync(path, "utf8");
    const hash = JSON.parse(first).geometryHash;
    buildLayout(id, true);
    expect(readFileSync(path, "utf8"), id).toBe(first);
    expect(JSON.parse(readFileSync(path, "utf8")).geometryHash, id).toBe(hash);
  }
  const gameplay = "src/levels/districts/D-RES.ts",
    source = readFileSync(gameplay, "utf8"),
    key = layoutSourceHash("D-RES");
  try {
    writeFileSync(
      gameplay,
      source + "\n// gameplay tuning: no static layout change\n",
    );
    expect(layoutSourceHash("D-RES")).toBe(key);
    expect(buildLayout("D-RES").rebuilt).toBe(false);
  } finally {
    writeFileSync(gameplay, source);
  }
  const layout = "layouts/D-RES/layout.py",
    script = readFileSync(layout, "utf8");
  try {
    writeFileSync(layout, script + "\n# authoring change\n");
    expect(layoutSourceHash("D-RES")).not.toBe(key);
    writeFileSync(
      layout,
      'raise RuntimeError("intentional E10 build failure probe")\n' + script,
    );
    expect(() => buildLayout("D-RES", true)).toThrow();
  } finally {
    writeFileSync(layout, script);
  }
}, 180_000);
