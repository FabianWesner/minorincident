import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "vitest";
import { Box3, Mesh, MeshBasicMaterial } from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { batchRigidParts } from "../../../src/render/characters/batchRigidParts";
import {
  resolveRig,
  disposeCharacter,
} from "../../../src/render/characters/rig";

test("T-E10-rigid-batches @E10 @E10-AC05 character batching preserves joint animation, geometry and authored color separation", async () => {
  const bytes = readFileSync("assets/char.survivor-female/model.glb");
  const { scene } = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  const reference = scene.clone(true),
    material = new MeshBasicMaterial({ vertexColors: true });
  material.userData.sharedPalette = true;
  const count = () => {
    let n = 0;
    scene.traverse((node) => {
      if (node instanceof Mesh) n++;
    });
    return n;
  };
  const before = count();
  batchRigidParts(scene, material);
  expect(count()).toBeLessThan(before / 2);
  const actualRig = resolveRig(scene),
    referenceRig = resolveRig(reference);
  for (const rig of [actualRig, referenceRig]) {
    rig.head.rotation.y = 0.6;
    rig.armL.rotation.z = -0.8;
    rig.shinR.rotation.z = 0.4;
  }
  scene.updateMatrixWorld(true);
  reference.updateMatrixWorld(true);
  const actual = new Box3().setFromObject(scene, true),
    expected = new Box3().setFromObject(reference, true);
  expect(actual.min.distanceTo(expected.min)).toBeLessThan(0.00001);
  expect(actual.max.distanceTo(expected.max)).toBeLessThan(0.00001);
  const swatches = new Set<string>();
  scene.traverse((node) => {
    if (!(node instanceof Mesh) || node.material !== material) return;
    const colors = node.geometry.getAttribute("color");
    for (let i = 0; i < colors.count; i++)
      swatches.add(`${colors.getX(i)},${colors.getY(i)},${colors.getZ(i)}`);
  });
  expect(swatches.size).toBeGreaterThan(10);
  mkdirSync("test-results/epics/E10", { recursive: true });
  writeFileSync(
    "test-results/epics/E10/rigid-batches.json",
    JSON.stringify(
      {
        variant: "female",
        meshesBefore: before,
        meshesAfter: count(),
        swatches: swatches.size,
        animatedBoundsMaxError: Math.max(
          actual.min.distanceTo(expected.min),
          actual.max.distanceTo(expected.max),
        ),
      },
      null,
      2,
    ) + "\n",
  );
  disposeCharacter(scene);
  disposeCharacter(reference);
  material.dispose();
});
