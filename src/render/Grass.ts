// Adapted from Bruno Simon folio-2025 World/Grass.js and Wind.js (MIT, commit 41046b5).
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh } from 'three/webgpu';
import { attribute, cos, mix, positionLocal, sin, uniform, vec3, cameraViewMatrix } from 'three/tsl';
import { Rng } from '../core/Rng';
import { worldLook } from '../data/worldLook';
import type { DistrictLayout } from '../levels/districts/types';
import type { Materials } from './Materials';

/** Dense, crossed tapered blades. Sparse prefix covers every lawn for mobile. */
export class Grass extends Mesh {
  private readonly fullCount: number;
  private readonly sparseCount: number;
  static material(materials: Materials, phase: ReturnType<typeof windPhase>) {
    const tip = attribute('tip', 'float'), weight = tip.mul(tip).mul(.08).mul(materials.look.nodes.windStrength);
    const material = materials.shaded(mix(materials.look.nodes.grassRoot, materials.look.nodes.grassTip, tip)); material.side = DoubleSide;
    material.normalNode = vec3(0, 1, 0).transformDirection(cameraViewMatrix);
    const gust = sin(positionLocal.x.mul(.8).add(positionLocal.z.mul(.35)).add(phase.mul(1.6)))
      .add(sin(positionLocal.z.mul(1.7).sub(phase.mul(.9))).mul(.35));
    material.positionNode = vec3(positionLocal.x.add(gust.mul(weight)), positionLocal.y.mul(materials.look.nodes.grassHeight.div(.41)), positionLocal.z.add(cos(phase.add(positionLocal.x)).mul(weight).mul(.45)));
    return material;
  }
  constructor(layout: DistrictLayout, material: ReturnType<typeof Grass.material>, seed: number) {
    const rng = new Rng(seed, `grass:${layout.district}`), positions: number[] = [], tips: number[] = [];
    const blade = (x: number, z: number, angle: number, height: number, width: number) => {
      const dx = Math.cos(angle) * width, dz = Math.sin(angle) * width;
      positions.push(x - dx, .015, z - dz, x + dx, .015, z + dz, x, height, z);
      tips.push(0, 0, 1);
    };
    // Keep grass out of solid footprints and pedestrian paths.
    const valid = (x: number, z: number) => !layout.placements.some(p => p.assetId !== 'prop.flower' && x > p.visualAabb.min[0] - .1 && x < p.visualAabb.max[0] + .1 && z > p.visualAabb.min[2] - .1 && z < p.visualAabb.max[2] + .1)
      && !layout.surfaces.some(s => (s.surface === 'tile' || s.surface === 'asphalt') && x > Math.min(...s.polygon.map(p => p[0])) && x < Math.max(...s.polygon.map(p => p[0])) && z > Math.min(...s.polygon.map(p => p[1])) && z < Math.max(...s.polygon.map(p => p[1])));
    let sparseCount = 0;
    for (const density of [5, 23]) {
      for (const lawn of layout.lawns) {
        const count = Math.ceil((lawn.max[0] - lawn.min[0]) * (lawn.max[1] - lawn.min[1]) * density);
        for (let i = 0; i < count; i++) {
          const x = lawn.min[0] + rng.next() * (lawn.max[0] - lawn.min[0]), z = lawn.min[1] + rng.next() * (lawn.max[1] - lawn.min[1]);
          if (!valid(x, z)) continue;
          const height = .15 + rng.next() ** 2 * .26, angle = rng.next() * Math.PI, width = .045 + rng.next() * .035;
          blade(x, z, angle, height, width); blade(x, z, angle + Math.PI / 2, height * .85, width);
        }
      }
      if (density === 5) sparseCount = positions.length / 3;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('tip', new Float32BufferAttribute(tips, 1));
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    super(geometry, material); this.fullCount = positions.length / 3; this.sparseCount = sparseCount;
    this.name = 'grass-gpu-wind'; this.receiveShadow = true;
  }
  setQuality(low: boolean, density: number = low ? worldLook.grassDensityLow : worldLook.grassDensity): void {
    const maximum = low ? this.sparseCount : this.fullCount, ratio = density / (low ? 5 : 28);
    this.geometry.setDrawRange(0, Math.floor(maximum * Math.min(1, ratio) / 6) * 6);
  }
  dispose(): void { this.geometry.dispose(); }
}
export const windPhase = () => uniform(0);
