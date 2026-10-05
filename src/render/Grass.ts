// Adapted from Bruno Simon folio-2025 World/Grass.js and Wind.js (MIT, commit 41046b5).
import { BufferGeometry, Float32BufferAttribute, Mesh } from "three/webgpu";
import { attribute, cos, positionLocal, sin, uniform, vec3 } from "three/tsl";
import { Rng } from "../core/Rng";
import type { DistrictLayout } from "../levels/districts/types";
import type { Materials } from "./Materials";
/** GPU tip bending from a lawn mask. One triangle per blade; CPU only updates a shared phase uniform. */
export class Grass extends Mesh {
  static material(materials: Materials, phase: ReturnType<typeof windPhase>) {
    const material = materials.unique("grass");
    const tip = attribute("tip", "float"),
      bend = tip.mul(0.14);
    material.positionNode = positionLocal.add(
      vec3(
        sin(positionLocal.x.mul(0.4).add(phase)).mul(bend),
        0,
        cos(positionLocal.z.mul(0.3).add(phase)).mul(bend),
      ),
    );
    return material;
  }
  constructor(
    layout: DistrictLayout,
    material: ReturnType<typeof Grass.material>,
    seed: number,
  ) {
    const rng = new Rng(seed, `grass:${layout.district}`),
      positions: number[] = [],
      tips: number[] = [];
    for (const lawn of layout.lawns)
      for (let i = 0; i < 200; i++) {
        const x = lawn.min[0] + rng.next() * (lawn.max[0] - lawn.min[0]),
          z = lawn.min[1] + rng.next() * (lawn.max[1] - lawn.min[1]),
          height = 0.15 + rng.next() * 0.22;
        positions.push(x - 0.04, 0.02, z, x + 0.04, 0.02, z, x, height, z);
        tips.push(0, 0, 1);
      }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("tip", new Float32BufferAttribute(tips, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    super(geometry, material);
    this.name = "grass-gpu-wind";
    this.receiveShadow = true;
  }
  dispose(): void {
    this.geometry.dispose();
  }
}
export const windPhase = () => uniform(0);
