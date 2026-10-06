// GPU-only environmental motion, following Bruno's shared Wind.js phase pattern (MIT).
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicNodeMaterial, Vector2 } from 'three/webgpu';
import { attribute, mix, cos, positionGeometry, sin, uniform, vec3 } from 'three/tsl';
import { Rng } from '../core/Rng';
import { worldLook } from '../data/worldLook';
import type { Materials } from './Materials';

/** One local field: drifting leaves/petals, warm dust and a small flock. No per-particle CPU updates. */
export class AmbientLife extends Group {
  readonly focus = uniform(new Vector2());
  private readonly meshes: Mesh[] = [];
  constructor(materials: Materials) {
    super(); this.name = 'ambient-gpu-life';
    const rng = new Rng(14, 'morning-air');
    for (const kind of ['leaf', 'dust', 'bird'] as const) {
      const positions: number[] = [], offsets: number[] = [], colors: number[] = [], petals: number[] = [];
      const count = kind === 'bird' ? 3 : 100;
      for (let i = 0; i < count; i++) {
        const offset = [rng.next() * 25, rng.next() * Math.PI * 2, rng.next() * 25];
        const size = kind === 'bird' ? .23 : kind === 'leaf' ? .025 + rng.next() * .04 : .018;
        const c = new Color(kind === 'leaf' && i % 3 === 0 ? worldLook.petal : worldLook[kind]);
        const vertices = kind === 'bird' ? [-size, 0, 0, 0, .06, .1, 0, 0, 0, 0, 0, 0, 0, .06, .1, size, 0, 0] : [-size, 0, 0, size, 0, 0, 0, size * 1.4, size * .6];
        positions.push(...vertices);
        for (let v = 0; v < vertices.length / 3; v++) { offsets.push(...offset); colors.push(...c.toArray()); petals.push(kind === 'leaf' && i % 3 === 0 ? 1 : 0); }
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('_drift', new Float32BufferAttribute(offsets, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      geometry.setAttribute('_petal', new Float32BufferAttribute(petals, 1));
      const material = new MeshBasicNodeMaterial({ side: DoubleSide });
      const petal = attribute('_petal', 'float');
      material.colorNode = mix(materials.look.nodes[kind], materials.look.nodes.petal, petal);
      const seed = attribute('_drift', 'vec3'), t = materials.wind, x = seed.x.add(t.mul(kind === 'bird' ? 1.6 : .22)).mod(25).sub(12.5), z = seed.z.add(t.mul(.12)).mod(25).sub(12.5);
      const y = kind === 'bird' ? sin(t.mul(.3).add(seed.y)).mul(.5).add(4.5) : sin(t.mul(.5).add(seed.y)).mul(.6).add(kind === 'dust' ? 1.2 : .9);
      const flutter = sin(t.mul(kind === 'bird' ? 8 : 2).add(seed.y));
      material.positionNode = vec3(positionGeometry.x.mul(cos(t.add(seed.y))).add(x).add(this.focus.x), positionGeometry.y.add(y).add(positionGeometry.x.abs().mul(flutter)), positionGeometry.z.add(z).add(this.focus.y));
      const mesh = new Mesh(geometry, material); mesh.frustumCulled = false; this.meshes.push(mesh); this.add(mesh);
    }
  }
  setQuality(low: boolean): void { for (const mesh of this.meshes) mesh.geometry.setDrawRange(0, low && mesh.geometry.getAttribute('position').count > 100 ? 90 : Infinity); }
  dispose(): void { for (const mesh of this.meshes) { mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); } this.clear(); }
}
