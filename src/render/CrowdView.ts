// Adapted from Bruno Simon InstancedGroup.js (MIT, 41046b5), using E17 GPU crowdMatrix/clipTexture.
import { CircleGeometry, Color, ConeGeometry, Group, InstancedBufferAttribute, InstancedInterleavedBuffer, InstancedMesh, Matrix4, Mesh, MeshLambertNodeMaterial, MeshBasicNodeMaterial, RingGeometry, type BufferGeometry } from 'three/webgpu';
import { attribute, instancedBufferAttribute, mat4, normalGeometry, positionGeometry, mix, vec4 } from 'three/tsl';
import { clipTexture, crowdMatrix, crowdPosition } from '../assets/crowd';
import { AssetRegistry } from '../assets/registry';
import { infectedDefinitions } from '../data/infected';
import type { SimWorld } from '../sim/world/SimWorld';
import { createInfectedPlaceholder } from './characters/infectedPlaceholder';
import { bakeInfected, framesPerClip, infectedClips } from './characters/bakeInfected';
interface Batch { mesh: InstancedMesh; frame: InstancedBufferAttribute; tint: InstancedBufferAttribute; shirt: Color; windup: number; limb: InstancedBufferAttribute; texture: import('three').DataTexture; count: number; placeholders: boolean }
const variantShirts: Record<string, Color> = { 'inf.jogger': new Color('#3178ac'), 'inf.cashier': new Color('#e5d9b9'), 'inf.delivery-driver': new Color('#d4ad32'), 'inf.suburban-mom': new Color('#79865b'), 'inf.bbq-dad': new Color('#a86645'), 'inf.bathrobe-neighbor': new Color('#ac7a91') };
/** One instanced, rigid-part GPU batch per archetype. Scene graph size never grows with infected population. */
export class CrowdView extends Group {
  private readonly registry: AssetRegistry;
  private readonly batches = new Map<string, Batch>();
  private readonly transform = new Matrix4();
  private readonly telegraphs: InstancedMesh[] = [];
  private readonly shadows: InstancedMesh;
  private readonly logs: { id: string; reason: string }[] = [];
  constructor(private readonly world: SimWorld) {
    super(); this.name = 'infected-crowd';
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
      const frame = new InstancedBufferAttribute(new Float32Array(capacity), 1), limb = new InstancedBufferAttribute(new Float32Array(capacity), 1);
      baked.geometry.setAttribute('_variant', tint); baked.geometry.setAttribute('_clip_frame', frame); baked.geometry.setAttribute('_limb', limb);
      const material = Object.assign(new MeshLambertNodeMaterial({ vertexColors: false }), { colorNode: mix(attribute('color', 'vec3'), attribute('_variant', 'vec3'), attribute('_shirt', 'float')), emissiveNode: attribute('color', 'vec3').mul(attribute('_emissive', 'float')).mul(3) });
      const matrix = crowdMatrix(texture, attribute('_part_index', 'float'), attribute('_clip_frame', 'float'));
      const part = attribute('_part_index', 'float'), leg = baked.clip.parts.indexOf('legL'), shin = baked.clip.parts.indexOf('shinL'), foot = baked.clip.parts.indexOf('footL');
      const visible = part.equal(leg).or(part.equal(shin)).or(part.equal(foot)).select(attribute('_limb', 'float').oneMinus(), 1);
      const mesh = new InstancedMesh(baked.geometry as BufferGeometry, material, capacity); mesh.name = def.id; mesh.frustumCulled = false; mesh.count = 0;
      // E17's explicit instance * part order: positionNode runs after default instancing.
      const matrices = new InstancedInterleavedBuffer(mesh.instanceMatrix.array, 16, 1);
      mesh.onBeforeRender = () => { matrices.version = mesh.instanceMatrix.version; };
      const column = (offset: number) => instancedBufferAttribute(matrices, 'vec4' as const, 16, offset);
      const instance = mat4(column(0), column(4), column(8), column(12));
      material.positionNode = crowdPosition(instance, texture, part, attribute('_clip_frame', 'float'), positionGeometry.mul(visible));
      material.normalNode = instance.mul(matrix.mul(vec4(normalGeometry, 0))).xyz.normalize();
      this.batches.set(def.id, { mesh, frame, limb, tint, shirt: baked.shirtColor ?? new Color(1, 1, 1), windup: def.windup, texture, count: 0, placeholders: fallback }); this.add(mesh);
      if (fallback) model.traverse((n) => { if (n instanceof Mesh) { n.geometry.dispose(); for (const m of Array.isArray(n.material) ? n.material : [n.material]) m.dispose(); } });
    }
    this.update();
  }
  update(): void {
    for (const batch of this.batches.values()) batch.count = 0;
    for (const mesh of this.telegraphs) mesh.count = 0; this.shadows.count = 0;
    const player = this.world.entities.get(1)!;
    for (const e of this.world.infected!.active) {
      const b = e.infected!, batch = this.batches.get(e.archetype)!;
      const distance = Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z);
      if (b.hidden || distance > 60) continue;
      const tick = distance > 35 ? Math.floor(this.world.tick / 2) * 2 : this.world.tick;
      let clip: typeof infectedClips[number] = b.state === 'dead' ? 'die' : b.legLost || e.archetype === 'infected.crawler' ? 'crawl' : b.state === 'attack' ? this.world.tick < b.until ? 'windup' : 'swing' : b.state === 'stagger' ? 'hurt' : (b.state === 'chase' || b.state === 'migration' || b.state === 'scatter' || b.state === 'wander') ? 'run' : 'idle';
      if (b.special === 'dive') clip = 'run';
      const phase = clip === 'die' ? Math.min(23, Math.floor((this.world.tick - b.deadAt) / 36 * 23)) : clip === 'windup' ? Math.min(23, Math.floor((1 - (b.until - this.world.tick) / (batch.windup * 60)) * 23)) : Math.floor((tick + e.id * 7) % 60 / 60 * 24);
      const frame = infectedClips.indexOf(clip) * framesPerClip + phase, tint = variantShirts[b.variant] ?? batch.shirt;
      if (e.archetype === 'infected.crow') {
        for (let bird = 0; bird < 20; bird++) if (b.birdAlive[bird]) { this.transform.makeTranslation(b.birdPositions[bird * 3], b.birdPositions[bird * 3 + 1], b.birdPositions[bird * 3 + 2]); batch.mesh.setMatrixAt(batch.count, this.transform); batch.frame.setX(batch.count, frame); batch.tint.setXYZ(batch.count, tint.r, tint.g, tint.b); batch.limb.setX(batch.count++, 0); }
      } else {
        this.transform.makeRotationY(e.transform.yaw); this.transform.setPosition(e.transform.x, e.transform.y - 0.7, e.transform.z);
        batch.mesh.setMatrixAt(batch.count, this.transform); batch.frame.setX(batch.count, frame); batch.tint.setXYZ(batch.count, tint.r, tint.g, tint.b); batch.limb.setX(batch.count++, Number(b.detached));
      }
      if (e.health.current > 0 && e.archetype !== 'infected.crow') { this.transform.makeTranslation(e.transform.x, 0.018, e.transform.z); this.shadows.setMatrixAt(this.shadows.count++, this.transform); }
      if (b.state === 'attack' && this.world.tick < b.until) {
        const mesh = this.telegraphs[b.special === 'charge' || b.special === 'pin' || b.special === 'pounce' ? 1 : 0]; this.transform.makeRotationY(-Math.atan2(b.dz, b.dx)); this.transform.setPosition(e.transform.x, 0.06, e.transform.z); mesh.setMatrixAt(mesh.count++, this.transform);
      }
    }
    for (const batch of this.batches.values()) { batch.mesh.count = batch.count; if (batch.count) { batch.mesh.instanceMatrix.needsUpdate = true; batch.frame.needsUpdate = true; batch.tint.needsUpdate = true; batch.limb.needsUpdate = true; } }
    for (const mesh of this.telegraphs) if (mesh.count) mesh.instanceMatrix.needsUpdate = true;
    if (this.shadows.count) this.shadows.instanceMatrix.needsUpdate = true;
  }
  getState() {
    let instances = 0, draws = 0, objects = 0, nonInstanced = 0;
    this.traverse((node) => { if (node !== this) objects++; if (node instanceof InstancedMesh) { instances += node.count; if (node.count) draws++; } else if (node instanceof Mesh) nonInstanced++; });
    return { instances, meshDrawCalls: draws, objects, nonInstancedMeshes: nonInstanced, batches: [...this.batches].map(([id, b]) => ({ id, instances: b.count, source: b.placeholders ? 'placeholder' : 'glb' })), assets: this.logs };
  }
  dispose(): void {
    for (const batch of this.batches.values()) { batch.mesh.geometry.dispose(); (batch.mesh.material as MeshLambertNodeMaterial).dispose(); batch.mesh.dispose(); batch.texture.dispose(); }
    for (const mesh of [...this.telegraphs, this.shadows]) { mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); mesh.dispose(); }
    this.batches.clear(); this.clear(); void this.registry.dispose();
  }
}
