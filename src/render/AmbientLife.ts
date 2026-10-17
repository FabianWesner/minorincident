// GPU-only environmental motion, following Bruno's shared Wind.js phase pattern (MIT).
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicNodeMaterial, Vector2, Vector4 } from 'three/webgpu';
import { attribute, mix, cos, positionGeometry, sin, uniform, uniformArray, vec3 } from 'three/tsl';
import { Rng } from '../core/Rng';
import { worldLook } from '../data/worldLook';
import type { Materials } from './Materials';
import type { TimeOfDayPreset } from '../data/timeOfDay';
import type { PlacedLight } from '../data/placedLights';

/** One local field: drifting leaves/petals, warm dust and a small flock. No per-particle CPU updates. */
export class AmbientLife extends Group {
  readonly focus = uniform(new Vector2());
  private readonly meshes: Mesh[] = [];
  constructor(materials: Materials, counts: NonNullable<TimeOfDayPreset['ambient']> = { leaf: 100, dust: 100, bird: 3 }) {
    super(); this.name = 'ambient-gpu-life';
    const rng = new Rng(14, 'morning-air');
    for (const kind of ['leaf', 'dust', 'bird'] as const) {
      const positions: number[] = [], offsets: number[] = [], colors: number[] = [], petals: number[] = [];
      const count = counts[kind];
      if (!count) continue;
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
  setQuality(low: boolean): void { for (const mesh of this.meshes) mesh.geometry.setDrawRange(0, low ? Math.min(90, mesh.geometry.getAttribute('position').count) : Infinity); }
  dispose(): void { for (const mesh of this.meshes) { mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); } this.clear(); }
}

/** Twenty-four tiny moths at at most six powered lamps. Orbiting happens on the GPU;
 * low tier omits the draw and power-off clears the associated swarm immediately. */
export class LampInsects extends Mesh<BufferGeometry, MeshBasicNodeMaterial> {
  private readonly positions = Array.from({ length: 6 }, () => new Vector4(0, -100, 0, 0));
  private readonly anchors = uniformArray<'vec4'>(this.positions, 'vec4');
  private readonly clock = uniform(0);
  constructor() {
    const geometry = new BufferGeometry(), positions: number[] = [], indices: number[] = [];
    for (let i = 0; i < 24; i++) { positions.push(-.025, 0, 0, .025, 0, 0, 0, .025, .02); indices.push(i, i, i); }
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('_insect', new Float32BufferAttribute(indices, 1));
    const material = new MeshBasicNodeMaterial({ color: '#b6a37c', side: DoubleSide, transparent: true, depthWrite: false });
    super(geometry, material);
    const seed = attribute('_insect', 'float'), anchor = this.anchors.element(seed.div(4).floor());
    const phase = this.clock.mul(1.6).add(seed.mul(2.4));
    material.positionNode = positionGeometry.add(anchor.xyz).add(vec3(sin(phase).mul(.35), sin(phase.mul(1.7)).mul(.18), cos(phase.mul(.9)).mul(.3)));
    material.opacityNode = anchor.w.mul(.65);
    this.name = 'lamp-insects'; this.frustumCulled = false; this.visible = false;
  }
  update(lights: readonly PlacedLight[], seconds: number, enabled: boolean): void {
    this.clock.value = seconds;
    let count = 0;
    if (enabled) for (const light of lights) {
      if (!light.assetId.includes('lamp') || light.position[1] - light.ground < 2) continue;
      this.positions[count++].set(light.position[0], light.position[1] - .35, light.position[2], 1);
      if (count === 6) break;
    }
    for (let i = count; i < 6; i++) this.positions[i].set(0, -100, 0, 0);
    this.visible = count > 0;
    this.geometry.setDrawRange(0, count * 4 * 3);
  }
  dispose(): void { this.geometry.dispose(); this.material.dispose(); }
}
