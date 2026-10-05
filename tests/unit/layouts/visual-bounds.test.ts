import { expect, test } from "vitest";
import { Box3, Scene, Vector3 } from "three/webgpu";
import manifest from "../../../src/assets/manifest.json";
import { placeholder } from "../../../src/assets/placeholders";
import { Lighting } from "../../../src/render/Lighting";
import { Materials } from "../../../src/render/Materials";

test("T-E10-07b @E10 @E10-AC07 actual placeholder geometry and collider contract agree in X/Z within 10%", () => {
  const lighting = new Lighting(new Scene()),
    materials = new Materials(lighting);
  try {
    for (const def of Object.values(manifest))
      if (def.solid) {
        const root = placeholder(def, materials),
          bounds = new Box3().setFromObject(root),
          size = bounds.getSize(new Vector3());
        for (const axis of ["x", "z"] as const) {
          expect(
            Math.abs(size[axis] - def.dimensions[axis]) / def.dimensions[axis],
            `${def.id}/${axis}`,
          ).toBeLessThanOrEqual(0.1);
          expect(
            Math.abs(bounds.getCenter(new Vector3())[axis]),
          ).toBeLessThanOrEqual(def.dimensions[axis] * 0.1);
        }
        root.traverse((o) => {
          if ("geometry" in o)
            (o.geometry as import("three").BufferGeometry).dispose();
        });
      }
  } finally {
    materials.dispose();
    lighting.dispose();
  }
});
