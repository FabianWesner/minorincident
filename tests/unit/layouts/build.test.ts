import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "vitest";
import { buildLayout, layoutSourceHash } from "../../../tools/layouts/build";

test("T-E10-12 @E10 @E10-AC12 headless Blender rebuild is deterministic and TS gameplay does not rebuild", () => {
  buildLayout("D-RES", true);
  const path = "public/assets/layouts/D-RES.layout.json",
    first = readFileSync(path, "utf8");
  const hash = JSON.parse(first).geometryHash;
  buildLayout("D-RES", true);
  expect(readFileSync(path, "utf8")).toBe(first);
  expect(JSON.parse(readFileSync(path, "utf8")).geometryHash).toBe(hash);
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
  } finally {
    writeFileSync(layout, script);
  }
}, 120_000);
