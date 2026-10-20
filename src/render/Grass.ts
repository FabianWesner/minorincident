import { weatherSurface } from './WeatherView';
// Adapted from Bruno Simon folio-2025 World/Grass.js and Wind.js (MIT, commit 41046b5).
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh } from 'three/webgpu';
import { attribute, cos, mix, positionLocal, sin, uniform, renderGroup, vec3, cameraViewMatrix } from 'three/tsl';
import { Rng } from '../core/Rng';
import { worldLook } from '../data/worldLook';
import type { DistrictLayout } from '../levels/districts/types';
import type { Materials } from './Materials';

/** Dense, crossed tapered blades. Sparse prefix covers every lawn for mobile. */
export class Grass extends Mesh {
  private readonly fullCount: number;
  private readonly sparseCount: number;
  static material(materials: Materials, phase: ReturnType<typeof windPhase>) {
    const tip = attribute('tip', 'float'), weight = tip.mul(tip).mul(.08).mul(materials.look.nodes.windStrength).mul(weatherSurface.windStrength);
    const material = materials.shaded(mix(materials.look.nodes.grassRoot, materials.look.nodes.grassTip, tip)); material.side = DoubleSide;
    material.normalNode = vec3(0, 1, 0).transformDirection(cameraViewMatrix);
    const gust = sin(positionLocal.x.mul(.8).add(positionLocal.z.mul(.35)).add(phase.mul(1.6)))
      .add(sin(positionLocal.z.mul(1.7).sub(phase.mul(.9))).mul(.35));
    material.positionNode = vec3(positionLocal.x.add(gust.mul(weight)), positionLocal.y.mul(materials.look.nodes.grassHeight.div(.41)), positionLocal.z.add(cos(phase.add(positionLocal.x)).mul(weight).mul(.45)));
    return material;
  }
  /** Lawns longer than this are cut into tiles, so frustum culling drops the grass far from the camera (one district-wide mesh drew every blade, ~200k triangles on L10). */
  static readonly tileM = 40;
  /** One mesh per lawn tile; the blade-validity grid (footprints, paving) is built once and shared. */
  static tiles(layout: DistrictLayout, material: ReturnType<typeof Grass.material>, seed: number): Grass[] {
    const valid = Grass.validity(layout), out: Grass[] = [];
    for (const [index, lawn] of layout.lawns.entries()) {
      const w = lawn.max[0] - lawn.min[0], d = lawn.max[1] - lawn.min[1];
      const nx = Math.max(1, Math.ceil(w / Grass.tileM)), nz = Math.max(1, Math.ceil(d / Grass.tileM));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const piece = { min: [lawn.min[0] + w * i / nx, lawn.min[1] + d * j / nz] as [number, number], max: [lawn.min[0] + w * (i + 1) / nx, lawn.min[1] + d * (j + 1) / nz] as [number, number] };
        out.push(new Grass(layout, material, seed, [piece], valid, `${index}:${i}:${j}`));
      }
    }
    return out;
  }
  /** Keep grass out of solid footprints and pedestrian paths. Bounds are precomputed and bucketed in a 4 m grid (D-GROVE: ~1.6 s -> a few ms per district). */
  private static validity(layout: DistrictLayout): (x: number, z: number) => boolean {
    const cell = 4, grid = new Map<number, (((x: number, z: number) => boolean))[]>();
    const key = (cx: number, cz: number) => cx * 100003 + cz;
    const insert = (minX: number, maxX: number, minZ: number, maxZ: number, test: (x: number, z: number) => boolean) => {
      for (let cx = Math.floor(minX / cell); cx <= Math.floor(maxX / cell); cx++) for (let cz = Math.floor(minZ / cell); cz <= Math.floor(maxZ / cell); cz++) {
        const list = grid.get(key(cx, cz)); if (list) list.push(test); else grid.set(key(cx, cz), [test]);
      }
    };
    for (const p of layout.placements) {
      if (p.assetId === 'prop.flower') continue;
      if (p.assetId.includes('tree')) { const px = p.position[0], pz = p.position[2]; insert(px - .36, px + .36, pz - .36, pz + .36, (x, z) => Math.abs(x - px) < .35 && Math.abs(z - pz) < .35); continue; }
      const minX = p.visualAabb.min[0] - .1, maxX = p.visualAabb.max[0] + .1, minZ = p.visualAabb.min[2] - .1, maxZ = p.visualAabb.max[2] + .1;
      insert(minX, maxX, minZ, maxZ, (x, z) => x > minX && x < maxX && z > minZ && z < maxZ);
    }
    for (const s of layout.surfaces) {
      if (s.surface !== 'tile' && s.surface !== 'asphalt') continue;
      const minX = Math.min(...s.polygon.map(p => p[0])), maxX = Math.max(...s.polygon.map(p => p[0])), minZ = Math.min(...s.polygon.map(p => p[1])), maxZ = Math.max(...s.polygon.map(p => p[1]));
      insert(minX, maxX, minZ, maxZ, (x, z) => x > minX && x < maxX && z > minZ && z < maxZ);
    }
    return (x: number, z: number) => !(grid.get(key(Math.floor(x / cell), Math.floor(z / cell))) ?? []).some(test => test(x, z));
  }
  constructor(layout: DistrictLayout, material: ReturnType<typeof Grass.material>, seed: number, lawns: DistrictLayout['lawns'] = layout.lawns, valid: (x: number, z: number) => boolean = Grass.validity(layout), tile = '') {
    const rng = new Rng(seed, `grass:${layout.district}${tile ? ':' + tile : ''}`), positions: number[] = [], tips: number[] = [];
    const blade = (x: number, z: number, angle: number, height: number, width: number) => {
      const dx = Math.cos(angle) * width, dz = Math.sin(angle) * width;
      positions.push(x - dx, .015, z - dz, x + dx, .015, z + dz, x, height, z);
      tips.push(0, 0, 1);
    };
    let sparseCount = 0;
    for (const density of [5, 23]) {
      for (const lawn of lawns) {
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
export const windPhase = () => uniform(0).setGroup(renderGroup);
