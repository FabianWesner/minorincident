// Adapted from Bruno Simon InstancedGroup.js (MIT, 41046b5), using E17 GPU crowdMatrix/clipTexture.
import { BoxGeometry, CircleGeometry, Color, ConeGeometry, Group, InstancedBufferAttribute, InstancedInterleavedBuffer, InstancedMesh, Matrix4, Mesh, MeshLambertNodeMaterial, MeshBasicNodeMaterial, RingGeometry, type BufferGeometry } from 'three/webgpu';
import { attribute, instancedBufferAttribute, mat4, normalGeometry, positionGeometry, mix, vec4, float } from 'three/tsl';
import { clipTexture, crowdMatrix, crowdPosition } from '../assets/crowd';
import { AssetRegistry } from '../assets/registry';
import { infectedDefinitions } from '../data/infected';
import type { SimWorld } from '../sim/world/SimWorld';
import { createInfectedPlaceholder } from './characters/infectedPlaceholder';
import { bakeInfected, framesPerClip, infectedClips } from './characters/bakeInfected';
interface Batch { mesh: InstancedMesh; parameters: InstancedBufferAttribute; tint: InstancedBufferAttribute; shirt: Color; windup: number; texture: import('three').DataTexture; count: number; placeholders: boolean }
const variantShirts: Record<string, Color> = { 'inf.jogger': new Color('#3178ac'), 'inf.cashier': new Color('#e5d9b9'), 'inf.delivery-driver': new Color('#d4ad32'), 'inf.suburban-mom': new Color('#79865b'), 'inf.bbq-dad': new Color('#a86645'), 'inf.bathrobe-neighbor': new Color('#ac7a91') };
/** One instanced, rigid-part GPU batch per archetype. Scene graph size never grows with infected population. */
export class CrowdView extends Group {
  private readonly registry: AssetRegistry;
  private readonly batches = new Map<string, Batch>();
  private readonly transform = new Matrix4();
  private readonly telegraphs: InstancedMesh[] = [];
  private readonly shadows: InstancedMesh;
  private readonly feedback = new Map<number, { mask: number; strength: number }>();
  private readonly caps = new InstancedMesh(new BoxGeometry(.18, .06, .18), new MeshBasicNodeMaterial({ color: '#b3121f' }), 1750);
  private goreEnabled = true;
  private readonly logs: { id: string; reason: string }[] = [];
  constructor(private readonly world: SimWorld) {
    super(); this.name = 'infected-crowd';
    this.caps.frustumCulled = false; this.caps.count = 0; this.add(this.caps);
    this.registry = new AssetRegistry((event) => this.logs.push(event));
    const ring = new RingGeometry(0.7, 0.8, 24); ring.rotateX(-Math.PI / 2);
    const arrow = new ConeGeometry(0.55, 2.5, 3); arrow.rotateZ(-Math.PI / 2); arrow.translate(1.3, 0, 0);
    for (const geometry of [ring, arrow]) { const mesh = new InstancedMesh(geometry, new MeshBasicNodeMaterial({ color: new Color('#ffb32d').multiplyScalar(1.6), transparent: true, depthWrite: false }), 350); mesh.frustumCulled = false; mesh.count = 0; this.telegraphs.push(mesh); this.add(mesh); }
    const shadow = new CircleGeometry(0.45, 12); shadow.rotateX(-Math.PI / 2);
    this.shadows = new InstancedMesh(shadow, new MeshBasicNodeMaterial({ color: '#5d446d', transparent: true, opacity: 0.25, depthWrite: false }), 350); this.shadows.frustumCulled = false; this.shadows.count = 0; this.add(this.shadows);
  }
  async init(): Promise<void> {
    for (const def of infectedDefinitions) {
      const role = def.id.slice(9), asset = def.asset;
      const loaded = await this.registry.loadAsset(asset, 'low') as Group;
      const fallback = Boolean(loaded.userData.placeholder), model = fallback ? createInfectedPlaceholder(role) : loaded;
      const baked = bakeInfected(model), texture = clipTexture(baked.clip), capacity = role === 'crow' ? 800 : 350;
      const tint = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
      // Frame, limb visibility, gore mask and hit flash share one of WebGL2's 16 slots.
      const parameters = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
      baked.geometry.setAttribute('_variant', tint); baked.geometry.setAttribute('_parameters', parameters);
      const data = attribute('_parameters', 'vec4');
      const material = Object.assign(new MeshLambertNodeMaterial({ vertexColors: false }), { colorNode: mix(attribute('color', 'vec3'), attribute('_variant', 'vec3'), attribute('_shirt', 'float')), emissiveNode: attribute('color', 'vec3').mul(attribute('_emissive', 'float')).mul(3).add(data.w) });
      const matrix = crowdMatrix(texture, attribute('_part_index', 'float'), data.x);
      const part = attribute('_part_index', 'float'), leg = baked.clip.parts.indexOf('legL'), shin = baked.clip.parts.indexOf('shinL'), foot = baked.clip.parts.indexOf('footL');
      let visible = part.equal(leg).or(part.equal(shin)).or(part.equal(foot)).select(data.y.oneMinus(), 1);
      const groups = [/^(arm|foreArm|hand)L$/, /^(arm|foreArm|hand)R$/, /^(leg|shin|foot)L$/, /^(leg|shin|foot)R$/, /^head$/];
      groups.forEach((pattern, index) => {
        let hidden = float(0).equal(1);
        baked.clip.parts.forEach((name, partIndex) => { if (pattern.test(name)) hidden = hidden.or(part.equal(partIndex)); });
        const detached = data.z.div(2 ** index).floor().mod(2);
        visible = hidden.select(visible.mul(detached.oneMinus()), visible);
      });
      const mesh = new InstancedMesh(baked.geometry as BufferGeometry, material, capacity); mesh.name = def.id; mesh.frustumCulled = false; mesh.count = 0;
      // E17's explicit instance * part order: positionNode runs after default instancing.
      const matrices = new InstancedInterleavedBuffer(mesh.instanceMatrix.array, 16, 1);
      mesh.onBeforeRender = () => { matrices.version = mesh.instanceMatrix.version; };
      const column = (offset: number) => instancedBufferAttribute(matrices, 'vec4' as const, 16, offset);
      const instance = mat4(column(0), column(4), column(8), column(12));
      material.positionNode = crowdPosition(instance, texture, part, data.x, positionGeometry.mul(visible));
      material.normalNode = instance.mul(matrix.mul(vec4(normalGeometry, 0))).xyz.normalize();
      this.batches.set(def.id, { mesh, parameters, tint, shirt: baked.shirtColor ?? new Color(1, 1, 1), windup: def.windup, texture, count: 0, placeholders: fallback }); this.add(mesh);
      if (fallback) model.traverse((n) => { if (n instanceof Mesh) { n.geometry.dispose(); for (const m of Array.isArray(n.material) ? n.material : [n.material]) m.dispose(); } });
    }
    this.update();
  }
  update(): void {
    for (const batch of this.batches.values()) batch.count = 0;
    for (const mesh of this.telegraphs) mesh.count = 0; this.shadows.count = 0; this.caps.count = 0;
    for (const [id, feedback] of this.feedback) { const e = this.world.entities.get(id); if (!e?.infected || e.infected.hidden) this.feedback.delete(id); else if (e.health.current > 0) feedback.mask = 0; }
    const player = this.world.entities.get(1)!;
    for (const e of this.world.infected!.active) {
      const b = e.infected!, batch = this.batches.get(e.archetype)!;
      const distance = Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z);
      if (b.hidden || distance > 60) continue;
      const feedback = this.feedback.get(e.id);
      const tick = distance > 35 ? Math.floor(this.world.tick / 2) * 2 : this.world.tick;
      let clip: typeof infectedClips[number] = b.state === 'dead' ? 'die' : b.legLost || e.archetype === 'infected.crawler' ? 'crawl' : b.state === 'attack' ? this.world.tick < b.until ? 'windup' : 'swing' : b.state === 'stagger' ? 'hurt' : (b.state === 'chase' || b.state === 'migration' || b.state === 'scatter' || b.state === 'wander') ? 'run' : 'idle';
      if (b.special === 'dive') clip = 'run';
      const phase = clip === 'die' ? Math.min(23, Math.floor((this.world.tick - b.deadAt) / 36 * 23)) : clip === 'windup' ? Math.min(23, Math.floor((1 - (b.until - this.world.tick) / (batch.windup * 60)) * 23)) : Math.floor((tick + e.id * 7) % 60 / 60 * 24);
      const frame = infectedClips.indexOf(clip) * framesPerClip + phase, tint = variantShirts[b.variant] ?? batch.shirt;
      if (e.archetype === 'infected.crow') {
        for (let bird = 0; bird < 20; bird++) if (b.birdAlive[bird]) { this.transform.makeTranslation(b.birdPositions[bird * 3], b.birdPositions[bird * 3 + 1], b.birdPositions[bird * 3 + 2]); batch.mesh.setMatrixAt(batch.count, this.transform); batch.tint.setXYZ(batch.count, tint.r, tint.g, tint.b); batch.parameters.setXYZW(batch.count++, frame, 0, 0, feedback?.strength ?? 0); }
      } else {
        this.transform.makeRotationY(e.transform.yaw); this.transform.setPosition(e.transform.x, e.transform.y - 0.7, e.transform.z);
        batch.mesh.setMatrixAt(batch.count, this.transform); batch.tint.setXYZ(batch.count, tint.r, tint.g, tint.b); batch.parameters.setXYZW(batch.count++, frame, Number(b.detached && this.goreEnabled), feedback?.mask ?? 0, feedback?.strength ?? 0);
        for (let limb = 0; limb < 5; limb++) if ((feedback?.mask ?? 0) & (1 << limb)) { const p = this.limbPosition(e.id, limb)!; this.transform.makeRotationY(e.transform.yaw); this.transform.setPosition(p.x, p.y + (limb === 4 ? -.17 : .18), p.z); this.caps.setMatrixAt(this.caps.count++, this.transform); }
      }
      if (e.health.current > 0 && e.archetype !== 'infected.crow') { this.transform.makeTranslation(e.transform.x, 0.018, e.transform.z); this.shadows.setMatrixAt(this.shadows.count++, this.transform); }
      if ((b.state === 'attack' || (b.state === 'dead' && b.special === 'explode')) && this.world.tick < b.until) {
        const mesh = this.telegraphs[b.special === 'charge' || b.special === 'pin' || b.special === 'pounce' ? 1 : 0]; if (b.special === 'explode') this.transform.makeScale(3.75, 1, 3.75); else this.transform.makeRotationY(-Math.atan2(b.dz, b.dx)); this.transform.setPosition(e.transform.x, 0.06, e.transform.z); mesh.setMatrixAt(mesh.count++, this.transform);
      }
    }
    for (const batch of this.batches.values()) { batch.mesh.count = batch.count; if (batch.count) { batch.mesh.instanceMatrix.needsUpdate = true; batch.parameters.needsUpdate = true; batch.tint.needsUpdate = true; } }
    for (const mesh of this.telegraphs) if (mesh.count) mesh.instanceMatrix.needsUpdate = true;
    if (this.caps.count) this.caps.instanceMatrix.needsUpdate = true;
    if (this.shadows.count) this.shadows.instanceMatrix.needsUpdate = true;
  }
  flash(id: number, strength: number): void {
    const e = this.world.entities.get(id); if (!e?.infected) return;
    const feedback = this.feedback.get(id) ?? { mask: 0, strength: 0 }; feedback.strength = strength; this.feedback.set(id, feedback);
  }
  private limbPosition(id: number, limb: number) {
    const e = this.world.entities.get(id); if (!e?.infected) return;
    const z = limb < 2 ? (limb === 0 ? -.3 : .3) : limb < 4 ? (limb === 2 ? -.12 : .12) : 0;
    return { x: e.transform.x + Math.sin(e.transform.yaw) * z, y: e.transform.y - .7 + (limb < 2 ? .65 : limb < 4 ? .25 : 1.15), z: e.transform.z + Math.cos(e.transform.yaw) * z };
  }
  detach(id: number, limb: number) {
    const position = this.limbPosition(id, limb); if (!position) return;
    const feedback = this.feedback.get(id) ?? { mask: 0, strength: 0 }; feedback.mask |= 1 << limb; this.feedback.set(id, feedback); return position;
  }
  clearGore(): void { for (const feedback of this.feedback.values()) feedback.mask = 0; }
  setGoreEnabled(enabled: boolean): void { this.goreEnabled = enabled; }
  getGoreState() { return [...this.feedback].map(([id, f]) => ({ id, detached: ['armL', 'armR', 'legL', 'legR', 'head'].filter((_, i) => f.mask & (1 << i)), caps: ['armL_cap', 'armR_cap', 'legL_cap', 'legR_cap', 'head_cap'].filter((_, i) => f.mask & (1 << i)), visible: !this.world.entities.get(id)?.infected?.hidden })); }
  getState() {
    let instances = 0, draws = 0, objects = 0, nonInstanced = 0;
    this.traverse((node) => { if (node !== this) objects++; if (node instanceof InstancedMesh) { instances += node.count; if (node.count) draws++; } else if (node instanceof Mesh) nonInstanced++; });
    return { instances, meshDrawCalls: draws, objects, nonInstancedMeshes: nonInstanced, caps: this.caps.count, flashes: [...this.feedback.values()].filter(f => f.strength > 0).length, batches: [...this.batches].map(([id, b]) => ({ id, instances: b.count, source: b.placeholders ? 'placeholder' : 'glb' })), assets: this.logs };
  }
  dispose(): void {
    for (const batch of this.batches.values()) { batch.mesh.geometry.dispose(); (batch.mesh.material as MeshLambertNodeMaterial).dispose(); batch.mesh.dispose(); batch.texture.dispose(); }
    for (const mesh of [...this.telegraphs, this.shadows, this.caps]) { mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); mesh.dispose(); }
    this.batches.clear(); this.clear(); void this.registry.dispose();
  }
}
