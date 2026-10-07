import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CrowdVisibility } from './CrowdVisibility';
import { simplifyCrowdLod } from './characters/crowdLodGeometry';
import { crowdLod } from './lodPolicy';
import { contactShadowMaterial } from './ContactShadows';
import { qualityBudgets, type QualityTier } from '../core/Quality';
// Adapted from Bruno Simon InstancedGroup.js (MIT, 41046b5), using E17 GPU crowdMatrix/clipTexture.
import { BoxGeometry, BufferGeometry, PlaneGeometry, Color, ConeGeometry, Group, InstancedBufferAttribute, InstancedInterleavedBuffer, InstancedMesh, Matrix4, Mesh, MeshLambertNodeMaterial, MeshBasicNodeMaterial, RingGeometry, Frustum, Sphere, Vector3, StreamDrawUsage } from 'three/webgpu';
import { attribute, instancedBufferAttribute, mat4, normalGeometry, vec3, positionGeometry, mix, vec4, float, cameraViewMatrix, luminance, screenCoordinate, uniform } from 'three/tsl';
import { crowdBlendedMatrix, packCrowdParts } from '../assets/crowd';
import type { Materials } from './Materials';
import { AssetRegistry } from '../assets/registry';
import manifest from '../assets/manifest.json';
import { civilianRoles } from '../data/npcs';
import { infectedDefinitions } from '../data/infected';
import type { EntitySnapshot } from '../sim/world/types';
import type { SimWorld } from '../sim/world/SimWorld';
import { createInfectedPlaceholder } from './characters/infectedPlaceholder';
import type { View } from './View';
import { bakeInfected, framesPerClip, infectedClips } from './characters/bakeInfected';
import { loadGate } from '../assets/loadGate';
import { authoredClips, cadenceStride, strides } from './characters/clips';
import { CrowdPosePalette } from './characters/CrowdPosePalette';
import { MotionPresentation } from './characters/MotionPresentation';
import { MotionPhase } from './characters/MotionPhase';
import { loadMeasure } from '../assets/loadTiming';
import { keepsLook } from '../sim/outbreak/appearance';
interface Batch { poses: CrowdPosePalette; mesh: InstancedMesh; state: InstancedBufferAttribute; tint: InstancedBufferAttribute; shirt: Color; strideScale: number; windup: number; texture: import('three').DataTexture; count: number; placeholders: boolean; lod: string; role: string }
const variantShirts: Record<string, Color> = { 'inf.jogger': new Color('#3178ac'), 'inf.cashier': new Color('#e5d9b9'), 'inf.delivery-driver': new Color('#d4ad32'), 'inf.suburban-mom': new Color('#79865b'), 'inf.bbq-dad': new Color('#a86645'), 'inf.bathrobe-neighbor': new Color('#ac7a91') };
/** One instanced, rigid-part GPU batch per archetype. Scene graph size never grows with infected population. */
/** E19 §5.4: the speed tier must read from the silhouette. Prefer the sim's tier,
 * else the brain's jittered run speed (frail 4.7, average 5.1, athletic 5.6 m/s). */
function tierGait(b: { speed?: number; tier?: string; l1?: { tier: string } }): 'infected-frail' | 'infected-lurch' | 'infected-sprint' {
  const tier = b.l1?.tier ?? b.tier, speed = b.speed ?? 5;
  if (tier === 'frail' || tier === 'athletic' || tier === 'average') return tier === 'frail' ? 'infected-frail' : tier === 'athletic' ? 'infected-sprint' : 'infected-lurch';
  return speed >= 5.35 ? 'infected-sprint' : speed >= 4.4 && speed < 4.92 ? 'infected-frail' : 'infected-lurch';
}
export class CrowdView extends Group {
  private readonly registry: AssetRegistry;
  private readonly definitions = new Map<string, { id: string; asset: string; windup: number }>();
  private readonly pending = new Map<string, Promise<void>>();
  private readonly heroSlots = new Map<string, InstancedMesh>();
  private readonly visibility = new CrowdVisibility();
  private readonly heroIds = new Set<number>();
  private readonly previousHeroes = new Set<number>();
  private readonly nearest: { id: number; distance: number }[] = [];
  private readonly heroBands = new Map<number, boolean>();
  private readonly rolePixels = new Map<string, number>();
  private readonly roleLods = new Map<string, 'lod1' | 'lod2'>();
  private readonly frustum = new Frustum();
  private readonly projection = new Matrix4();
  private readonly bounds = new Sphere(new Vector3(), 1);
  private disposed = false;
  private readonly batches = new Map<string, Batch>();
  private readonly transform = new Matrix4();
  private readonly presentation = new MotionPresentation();
  private readonly motion = new MotionPhase();
  /** L1 v2: corpses persist (pause/resume, checkpoint restore) until the sim's corpse cap recycles the oldest; other levels fade at 9 s. */
  private get corpseTicks(): number { return this.world.infected?.l1 ? Infinity : 540; }
  private readonly corpses = new Map<number, { x: number; z: number; sourceX: number; sourceZ: number; deadAt: number }>();
  private readonly telegraphs: InstancedMesh[] = [];
  private readonly shadows: InstancedMesh;
  private readonly feedback = new Map<number, { mask: number; strength: number }>();
  private readonly caps = new InstancedMesh(new BoxGeometry(.18, .06, .18), new MeshBasicNodeMaterial({ color: '#b3121f' }), 1750);
  private goreEnabled = true;
  private cullDistance = 60;
  setQuality(tier: QualityTier): void { this.cullDistance = qualityBudgets[tier].cullDistance; this.low = tier === 'low'; }
  private readonly logs: { id: string; reason: string }[] = [];
  constructor(private readonly world: SimWorld, private low = false, private readonly shading?: Materials) {
    super(); this.name = 'infected-crowd';
    this.caps.frustumCulled = false; this.caps.count = 0; this.add(this.caps);
    this.registry = new AssetRegistry((event) => this.logs.push(event));
    const ring = new RingGeometry(0.7, 0.8, 24); ring.rotateX(-Math.PI / 2);
    const arrow = new ConeGeometry(0.55, 2.5, 3); arrow.rotateZ(-Math.PI / 2); arrow.translate(1.3, 0, 0);
    for (const geometry of [ring, arrow]) { const mesh = new InstancedMesh(geometry, new MeshBasicNodeMaterial({ color: new Color('#ffb32d').multiplyScalar(1.6), transparent: true, depthWrite: false }), 350); mesh.frustumCulled = false; mesh.count = 0; this.telegraphs.push(mesh); this.add(mesh); }
    const shadow = new PlaneGeometry(1.2, 1.2); shadow.rotateX(-Math.PI / 2);
    this.shadows = new InstancedMesh(shadow, contactShadowMaterial(), 350); this.shadows.frustumCulled = false; this.shadows.count = 0; this.add(this.shadows);
  }
  async init(): Promise<void> {
    const started = performance.now();
    const variants = manifest.filter(a => a.status === 'integrated' && a.category === 'infected' && !infectedDefinitions.some(d => d.asset === a.id) && a.id !== 'inf.corpse-poses');
    const models = new Set([...this.world.entities.iterate()].flatMap(e => e.civilian?.schedule && e.civilian.model ? [e.civilian.model] : []));
    const allDefinitions = [...[...models].map(model => ({ ...infectedDefinitions[0], id: model, asset: model })), ...infectedDefinitions, { ...infectedDefinitions[0], id: 'infected.patient-zero', asset: 'npc.patient-zero-courier' }, ...variants.map(a => ({ ...infectedDefinitions[0], id: a.id, asset: a.id }))];
    // L1 v2: every infected is a pedestrian that keeps its look and is drawn by the civilian crowd (lane D); this view
    // only needs the plain runner fallback plus scripted infected actors. Without the outbreak layer keep the old set.
    const actors = Object.values(this.world.missions?.def.actors ?? {}).map(actor => actor.archetype);
    const l1Roles = new Set<string>(this.world.npcs?.civilians.outbreak || this.world.districts?.districts.some(d => d.id === 'D-GROVE') ? ['infected.runner', ...actors] : ['infected.runner', ...actors, ...civilianRoles.map(role => role.variant), ...models]);
    const definitions = this.world.scenario === 'L1' ? allDefinitions.filter(def => l1Roles.has(def.id)) : allDefinitions;
    for (const def of definitions) {
      this.definitions.set(def.id, def);
      if (!this.low) {
        const mesh = new InstancedMesh(new BufferGeometry(), this.shading?.shaded(vec3(1)) ?? new MeshBasicNodeMaterial(), 350);
        mesh.count = 0; mesh.visible = false; this.heroSlots.set(def.id, mesh); this.add(mesh);
      }
    }
    // The low tier only ever draws LOD2 (see update); it never loads LOD0/LOD1.
    const lods: ('lod0' | 'lod1' | 'lod2')[] = this.low ? ['lod2'] : this.world.scenario === 'L1' ? ['lod0', 'lod1', 'lod2'] : ['lod1', 'lod2'];
    await Promise.all(definitions.flatMap(def => lods.map(lod => this.loadBatch(def, lod))));
    loadMeasure('view:infected-crowd', started);
    this.update();
  }
  private async loadBatch(def: { id: string; asset: string; windup: number }, lod: 'lod0' | 'lod1' | 'lod2'): Promise<void> {
      const role = def.id.startsWith('infected.') ? def.id.slice(9) : 'runner', asset = def.asset;
      const loaded = await this.registry.loadAsset(asset, lod) as Group;
      await loadGate.foreground(); await loadGate.wait(); // bakes wait for the level pick, then one per frame
      if (this.disposed) return;
      const fallback = Boolean(loaded.userData.placeholder), model = fallback ? createInfectedPlaceholder(role) : loaded;
      const baked = bakeInfected(model, this.registry.definition(asset).animatedNodes, role === 'crawler' && !fallback), capacity = role === 'crow' ? 800 : 350;
      // Baking expands rigid parts to triangle soup. Index identical vertices before
      // instanced attributes are attached: same surfaces, fewer animated vertices.
      deinterleaveGeometry(baked.geometry);
      const indexed = mergeVertices(baked.geometry); baked.geometry.dispose(); baked.geometry = indexed;
      if (lod === 'lod2' && !fallback) {
        await simplifyCrowdLod(baked.geometry);
        if (this.disposed) { baked.geometry.dispose(); return; }
      }
      const poses = new CrowdPosePalette(baked.clip, capacity), texture = poses.texture;
      packCrowdParts(baked.geometry);
      const tint = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(StreamDrawUsage);
      // Pack frame, detached leg, gore mask and flash into one slot: WebGL2 guarantees 16 attributes.
      const state = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(StreamDrawUsage);
      baked.geometry.setAttribute('_state', state); baked.geometry.setAttribute('_variant', tint);
      const feedbackState = attribute('_state', 'vec4'), parts = attribute('_parts', 'vec4'), variant = attribute('_variant', 'vec4');
      const opacity = feedbackState.w.div(2).floor().div(255).oneMinus();
      const base = mix(attribute('color', 'vec3'), variant.xyz, parts.y.max(0)), glow = attribute('color', 'vec3').div(luminance(attribute('color', 'vec3')).max(.25)).mul(parts.z).mul(1.2).add(feedbackState.w.mod(2));
      const material = this.shading?.shaded(base, glow) ?? Object.assign(new MeshLambertNodeMaterial({ vertexColors: false }), { colorNode: base, emissiveNode: glow });
      // Instances cannot be sorted independently in the transparent render list.
      // A shared 4x4 screen-door threshold keeps every surface of a corpse at
      // a pixel together, unlike a 3D hash that exposes its deeper body parts.
      // Living actors keep every pixel; discarded pixels never write depth.
      const pixel = screenCoordinate.xy.floor();
      const bayer2 = (p: typeof pixel) => p.x.mod(2).mul(2).add(p.y.mod(2).mul(3)).mod(4);
      const threshold = bayer2(pixel).mul(4).add(bayer2(pixel.div(2).floor())).add(.5).div(16);
      material.maskNode = opacity.greaterThan(threshold);
      material.depthTest = material.depthWrite = true;
      const outgoing = variant.w.div(2).floor(), weight = variant.w.mod(2);
      const matrix = crowdBlendedMatrix(texture, parts.x, feedbackState.x, outgoing, weight);
      // Part indices are uniforms, not shader constants: every archetype/LOD compiles to the same program (one shared
      // pipeline), only the uniform values differ. Missing parts get -1 and never match.
      const part = parts.x, index = (name: string) => uniform(baked.clip.parts.indexOf(name));
      let visible = part.equal(index('legL')).or(part.equal(index('shinL'))).or(part.equal(index('footL'))).select(feedbackState.y.oneMinus(), 1);
      const groups = [['armL', 'foreArmL', 'handL'], ['armR', 'foreArmR', 'handR'], ['legL', 'shinL', 'footL'], ['legR', 'shinR', 'footR'], ['head']];
      groups.forEach((names, bit) => {
        let hidden = float(0).equal(1);
        for (const name of names) hidden = hidden.or(part.equal(index(name)));
        const detached = feedbackState.z.div(2 ** bit).floor().mod(2);
        visible = hidden.select(visible.mul(detached.oneMinus()), visible);
      });
      const slot = lod === 'lod0' ? this.heroSlots.get(def.id) : undefined;
      const mesh = slot ?? new InstancedMesh(baked.geometry, material, capacity);
      mesh.instanceMatrix.setUsage(StreamDrawUsage);
      if (slot) { mesh.geometry.dispose(); (mesh.material as MeshLambertNodeMaterial).dispose(); mesh.geometry = baked.geometry; mesh.material = material; this.heroSlots.delete(def.id); } mesh.userData.preRenderSolo = true; mesh.name = def.id; mesh.frustumCulled = false; mesh.count = 0;
      // E17's explicit instance * part order: positionNode runs after default instancing.
      const matrices = new InstancedInterleavedBuffer(mesh.instanceMatrix.array, 16, 1).setUsage(StreamDrawUsage);
      mesh.onBeforeRender = () => { matrices.version = mesh.instanceMatrix.version; matrices.clearUpdateRanges(); matrices.addUpdateRange(0, mesh.count * 16); };
      const column = (offset: number) => instancedBufferAttribute(matrices, 'vec4' as const, 16, offset);
      const instance = mat4(column(0), column(4), column(8), column(12));
      material.positionNode = instance.mul(matrix.mul(vec4(positionGeometry.mul(visible), 1))).xyz;
      material.normalNode = instance.mul(matrix.mul(vec4(normalGeometry, 0))).xyz.transformDirection(cameraViewMatrix);
      this.batches.set(`${def.id}:${lod}`, { poses, lod, role: def.id, mesh, state, tint, shirt: baked.shirtColor ?? new Color(1, 1, 1), strideScale: baked.strideScale, windup: def.windup, texture, count: 0, placeholders: fallback }); this.add(mesh);
      if (fallback) model.traverse((n) => { if (n instanceof Mesh) { n.geometry.dispose(); for (const m of Array.isArray(n.material) ? n.material : [n.material]) m.dispose(); } });
  }
  private hasRole(id: string): boolean { return this.batches.has(`${id}:lod1`) || this.batches.has(`${id}:lod2`); }
  async ready(): Promise<void> { await Promise.all(this.pending.values()); }
  update(view?: View, alpha = 1): void {
    for (const [id, pose] of this.corpses) if (!this.world.entities.get(id)?.infected || this.world.entities.get(id)!.health.current > 0 || this.world.tick - pose.deadAt > this.corpseTicks) this.corpses.delete(id);
    for (const batch of this.batches.values()) batch.count = 0;
    for (const mesh of this.telegraphs) mesh.count = 0; this.shadows.count = 0; this.caps.count = 0;
    for (const [id, feedback] of this.feedback) { const e = this.world.entities.get(id); if (!e?.combat || e.hidden || e.infected?.hidden) this.feedback.delete(id); else if (e.health.current > 0) feedback.mask = 0; }
    const player = this.world.entities.get(1)!;
    const focus = view?.cameraTarget ?? player.transform;
    if (view) this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse));
    this.visibility.begin(view?.camera, typeof innerHeight === 'number' ? innerHeight : 900);
    const heroes = this.heroIds; this.previousHeroes.clear();
    for (const id of heroes) this.previousHeroes.add(id);
    heroes.clear(); this.nearest.length = 0; this.rolePixels.clear();
    if (!this.low) for (const e of this.world.entities.iterate()) {
      if (e.faction !== 'infected' || !e.combat || e.hidden || e.infected?.hidden || e.archetype === 'infected.crow' || keepsLook(e)) continue;
      if (e.health.current <= 0 && this.world.tick - (e.infected?.deadAt ?? 0) >= this.corpseTicks) continue;
      const distance = Math.hypot(e.transform.x - focus.x, e.transform.z - focus.z);
      if (distance > this.cullDistance) continue;
      const variant = e.infected?.model ?? e.infected?.variant;
      const role = this.hasRole(e.archetype) ? e.archetype : 'infected.runner';
      const key = variant && this.hasRole(variant) ? variant : role;
      const d = this.registry.definition(this.definitions.get(key)!.asset).dimensions;
      if (!this.visibility.visible(e.transform.x, e.transform.y - .7 + d.y / 2, e.transform.z, Math.hypot(d.x, d.y, d.z) / 2 + .6)) continue;
      const pixels = this.visibility.pixels(e.transform.x, e.transform.y, e.transform.z, d.y);
      this.rolePixels.set(key, Math.max(this.rolePixels.get(key) ?? 0, pixels));
      if (distance > (this.previousHeroes.has(e.id) ? 13 : 12)) continue;
      const hero = !view || pixels > (this.heroBands.get(e.id) ? 164 : 196);
      this.heroBands.set(e.id, hero); if (!hero) continue;
      // Hold an existing hero until a replacement is clearly closer.
      const score = distance - (this.previousHeroes.has(e.id) ? .75 : 0);
      let at = 0; while (at < this.nearest.length && this.nearest[at].distance <= score) at++;
      if (at < 8) { this.nearest.splice(at, 0, { id: e.id, distance: score }); if (this.nearest.length > 8) this.nearest.pop(); }
    }
    // One background tier per role protects the largest visible silhouette and
    // avoids a third active draw for every archetype in a mixed horde.
    for (const [role, pixels] of this.rolePixels) this.roleLods.set(role, crowdLod(pixels, this.roleLods.get(role), false));
    for (const e of this.nearest) heroes.add(e.id);
    for (const e of this.world.entities.iterate()) {
      if (e.id === 1 || e.faction !== 'infected' || !e.combat) continue;
      const distance = Math.hypot(e.transform.x - focus.x, e.transform.z - focus.z);
      if (e.hidden || e.infected?.hidden || distance > this.cullDistance || e.infected?.state === 'dead' && this.world.tick - e.infected.deadAt > this.corpseTicks) continue;
      // L1 v2: a pedestrian who turned keeps its own body and clothes (NpcView's civilian crowd); only the contact shadow is drawn here.
      if (keepsLook(e)) { this.transform.makeTranslation(e.transform.x, (this.world.districts?.groundHeight(e.transform.x, e.transform.z) ?? 0) + .018, e.transform.z); this.shadows.setMatrixAt(this.shadows.count++, this.transform); continue; }
      const availableLod = this.low ? 'lod2' : 'lod1';
      const role = this.hasRole(e.archetype) ? e.archetype : 'infected.runner';
      const variant = e.infected?.model ?? e.infected?.variant;
      const key = variant && this.hasRole(variant) ? variant : role;
      const def = this.definitions.get(key)!;
      const dimensions = this.registry.definition(def.asset).dimensions;
      this.bounds.center.set(e.transform.x, e.transform.y - .7 + dimensions.y / 2, e.transform.z);
      this.bounds.radius = Math.hypot(dimensions.x, dimensions.y, dimensions.z) / 2;
      if (view && !this.frustum.intersectsSphere(this.bounds)) continue;
      let lod: 'lod0' | 'lod1' | 'lod2' = this.low ? 'lod2' : this.roleLods.get(key) ?? 'lod2';
      if (heroes.has(e.id)) {
        if (this.batches.has(`${key}:lod0`)) lod = 'lod0';
        else if (!this.pending.has(key)) {
          this.pending.set(key, this.loadBatch(def, 'lod0').finally(() => this.pending.delete(key)));
        }
      }
      // Quality changes/streaming may not have the requested tier yet. Keep the loaded figure.
      const batch = this.batches.get(`${key}:${lod}`) ?? this.batches.get(`${key}:${availableLod}`) ?? this.batches.get(`${key}:lod2`) ?? this.batches.get(`${key}:lod1`);
      if (!batch) continue;
      const b = e.infected ?? { state: e.health.current <= 0 ? 'dead' : e.combat.attacking ? 'attack' : 'idle', until: 0, deadAt: 0, legLost: false, special: '', detached: false, variant: '', birdAlive: [], birdPositions: [], dx: 0, dz: 0 };
      const feedback = this.feedback.get(e.id);
      const renderTick = Math.max(0, this.world.tick + alpha - 1);
      const tick = distance > 35 ? Math.floor(this.world.tick / 2) * 2 : this.world.tick;
      const motion = e.motion ?? this.motion.sample(e.id, tick, e.transform.x, e.transform.z), gaitDistance = Math.max(0, motion.distance - motion.speed * (1 - alpha) / 60), reaction = e.combat.reaction;
      const age = reaction ? (this.world.tick - reaction.started) / 60 : Infinity;
      const death = e.archetype === 'infected.crawler' ? 'death-side' : 'death-back';
      let clip: typeof infectedClips[number] = b.state === 'dead' ? death : b.legLost || e.archetype === 'infected.crawler' ? 'crawl' : b.state === 'attack' && motion.speed < 1.2 ? this.world.tick < b.until ? 'windup' : 'swing' : motion.speed > 2 ? tierGait(b as { speed?: number; tier?: string; l1?: { tier: string } }) : motion.speed > .2 ? 'shamble' : (b.state as string) === 'search' || (b.state as string) === 'attracted' ? 'infected-search' : 'infected-idle';
      if (reaction && tick < reaction.until && b.state !== 'dead') clip = reaction.heavy ? age < .48 ? reaction.index % 2 ? 'knockdown' : 'flung' : age < .7 ? 'knockdown' : 'get-up' : reaction.index % 2 ? 'stagger-left' : 'stagger-right';
      if (e.infectionRise) clip = 'infection-rise';
      if (b.special === 'dive') clip = 'run';
      const duration = authoredClips.get(clip)!.duration;
      const phase = e.infectionRise ? Math.min(1, (this.world.tick - e.infectionRise.started) / (e.infectionRise.until - e.infectionRise.started)) : b.state === 'dead' ? reaction?.groundDeath ? 1 : Math.min(1, (this.world.tick - b.deadAt) / 60 / duration) : clip === 'windup' ? Math.max(0, Math.min(1, 1 - (b.until - this.world.tick) / (batch.windup * 60))) : reaction && clip === 'get-up' ? Math.min(1, (age - .7) / .64) : reaction && ['flung', 'knockdown', 'stagger-left', 'stagger-right'].includes(clip) ? Math.min(1, age / (reaction.heavy ? .48 : (reaction.until - reaction.started) / 60)) : strides[clip] ? gaitDistance / cadenceStride(clip, batch.strideScale, motion.speed) % 1 : (renderTick / 60 + e.id * .137) / duration % 1;
      const frame = infectedClips.indexOf(clip) * framesPerClip + phase * (framesPerClip - 1), tint = variantShirts[b.variant] ?? batch.shirt;
      const flight = reaction ? Math.max(0, 1 - age / (reaction.heavy ? .28 : Math.min(.2, (reaction.until - reaction.started) / 60))) : 0;
      const presented = this.presentation.sample(e.id, e.transform, this.world.tick, alpha);
      const resting = b.state === 'dead' ? this.corpsePosition(e, b.deadAt) : e.transform;
      const settle = b.state === 'dead' ? Math.min(1, (this.world.tick - b.deadAt) / 60) : 0;
      const x = presented.x + (resting.x - e.transform.x) * settle + (reaction ? (reaction.from.x - reaction.to.x) * flight * flight : 0), z = presented.z + (resting.z - e.transform.z) * settle + (reaction ? (reaction.from.z - reaction.to.z) * flight * flight : 0);
      const blend = batch.poses.sample(e.id, clip, frame, renderTick / 60);
      const fade = b.state === 'dead' ? Math.max(0, Math.min(1, (this.world.tick - b.deadAt - 360) / 180)) : 0;
      if (e.archetype === 'infected.crow') {
        for (let bird = 0; bird < 20; bird++) if (b.birdAlive[bird]) { this.transform.makeTranslation(b.birdPositions[bird * 3], b.birdPositions[bird * 3 + 1], b.birdPositions[bird * 3 + 2]); batch.mesh.setMatrixAt(batch.count, this.transform); batch.tint.setXYZW(batch.count, tint.r, tint.g, tint.b, blend[0] * 2 + blend[1]); batch.state.setXYZW(batch.count++, frame, 0, 0, feedback?.strength ?? 0); }
      } else {
        this.transform.makeRotationY(presented.yaw); this.transform.setPosition(x, presented.y - 0.7 + (reaction?.heavy && age < .48 ? Math.max(0, .16 * (1 - Math.abs(age / .24 - 1))) : 0), z);
        batch.mesh.setMatrixAt(batch.count, this.transform); batch.tint.setXYZW(batch.count, tint.r, tint.g, tint.b, blend[0] * 2 + blend[1]); batch.state.setXYZW(batch.count++, frame, Number(b.detached && this.goreEnabled), feedback?.mask ?? 0, (feedback?.strength ?? 0) + Math.round(fade * 255) * 2);
        for (let limb = 0; limb < 5; limb++) if ((feedback?.mask ?? 0) & (1 << limb)) { const p = this.limbPosition(e.id, limb)!; this.transform.makeRotationY(e.transform.yaw); this.transform.setPosition(p.x, p.y + (limb === 4 ? -.17 : .18), p.z); this.caps.setMatrixAt(this.caps.count++, this.transform); }
      }
      if (e.archetype !== 'infected.crow') { this.transform.makeTranslation(e.transform.x, (this.world.districts?.groundHeight(e.transform.x, e.transform.z) ?? 0) + .018, e.transform.z); this.shadows.setMatrixAt(this.shadows.count++, this.transform); }
      if ((b.state === 'attack' || (b.state === 'dead' && b.special === 'explode')) && this.world.tick < b.until) {
        const mesh = this.telegraphs[b.special === 'charge' || b.special === 'pin' || b.special === 'pounce' ? 1 : 0]; if (b.special === 'explode') this.transform.makeScale(3.75, 1, 3.75); else this.transform.makeRotationY(-Math.atan2(b.dz, b.dx)); this.transform.setPosition(e.transform.x, 0.06, e.transform.z); mesh.setMatrixAt(mesh.count++, this.transform);
      }
    }
    for (const batch of this.batches.values()) {
      batch.mesh.count = batch.count; batch.mesh.visible = batch.count > 0;
      if (batch.count) {
        batch.mesh.instanceMatrix.clearUpdateRanges(); batch.mesh.instanceMatrix.addUpdateRange(0, batch.count * 16); batch.mesh.instanceMatrix.needsUpdate = true;
        for (const attribute of [batch.state, batch.tint]) { attribute.clearUpdateRanges(); attribute.addUpdateRange(0, batch.count * 4); attribute.needsUpdate = true; }
        const first = batch.poses.clip.frames * batch.texture.image.width * 4;
        batch.texture.clearUpdateRanges(); batch.texture.addUpdateRange(first, batch.texture.image.data!.length - first);
      }
    }
    for (const mesh of this.telegraphs) { mesh.visible = mesh.count > 0; if (mesh.count) mesh.instanceMatrix.needsUpdate = true; }
    this.caps.visible = this.caps.count > 0; this.shadows.visible = this.shadows.count > 0;
    if (this.caps.count) this.caps.instanceMatrix.needsUpdate = true;
    if (this.shadows.count) this.shadows.instanceMatrix.needsUpdate = true;
  }
  /** Keep settled bodies on clear ground, giving each a readable footprint.
   * This is presentation only; damage and revive continue to use sim transforms. */
  private corpsePosition(e: EntitySnapshot, deadAtTick: number) {
    const deadAt = deadAtTick, previous = this.corpses.get(e.id);
    if (previous?.deadAt === deadAt && previous.sourceX === e.transform.x && previous.sourceZ === e.transform.z) return previous;
    const pose = { x: e.transform.x, z: e.transform.z, sourceX: e.transform.x, sourceZ: e.transform.z, deadAt };
    // The body lies ~0.9 m behind its hips (death poses fall backwards): that strip must be clear too, so a
    // corpse never lies through a fence or wall (PO #14).
    const bx = -Math.cos(e.transform.yaw), bz = Math.sin(e.transform.yaw), nav = this.world.infected?.nav;
    const clear = (x: number, z: number) => !!nav?.clear(x, z, .6) && nav.clear(x + bx * .5, z + bz * .5, .3) && nav.clear(x + bx * .95, z + bz * .95, .25) && [...this.corpses].every(([id, p]) => id === e.id || Math.hypot(x - p.x, z - p.z) >= 1.25);
    if (!clear(pose.x, pose.z)) search: for (const radius of [.7, 1.4, 2.1]) for (let i = 0; i < 8; i++) {
      const angle = e.transform.yaw + Math.PI / 2 + i * Math.PI / 4;
      const x = e.transform.x + Math.cos(angle) * radius, z = e.transform.z + Math.sin(angle) * radius;
      if (clear(x, z) && this.world.infected!.nav.visible(e.transform, { x, z }, .35)) { pose.x = x; pose.z = z; break search; }
    }
    this.corpses.set(e.id, pose); return pose;
  }
  flash(id: number, strength: number): void {
    const e = this.world.entities.get(id); if (!e?.combat || e.faction !== 'infected') return;
    const feedback = this.feedback.get(id) ?? { mask: 0, strength: 0 }; feedback.strength = strength; this.feedback.set(id, feedback);
  }
  private limbPosition(id: number, limb: number) {
    const e = this.world.entities.get(id); if (!e?.combat || e.faction !== 'infected') return;
    const z = limb < 2 ? (limb === 0 ? -.3 : .3) : limb < 4 ? (limb === 2 ? -.12 : .12) : 0;
    return { x: e.transform.x + Math.sin(e.transform.yaw) * z, y: e.transform.y - .7 + (e.health.current <= 0 ? .18 : limb < 2 ? .65 : limb < 4 ? .25 : 1.15), z: e.transform.z + Math.cos(e.transform.yaw) * z };
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
    return { instances, meshDrawCalls: draws, objects, nonInstancedMeshes: nonInstanced, caps: this.caps.count, flashes: [...this.feedback.values()].filter(f => f.strength > 0).length, batches: [...this.batches.values()].map((b) => ({ id: b.role, lod: b.lod, instances: b.count, source: b.placeholders ? 'placeholder' : 'glb' })).concat([...this.heroSlots.keys()].map(id => ({ id, lod: 'lod0', instances: 0, source: 'pending' }))), assets: this.logs };
  }
  dispose(): void {
    this.disposed = true;
    for (const mesh of this.heroSlots.values()) { mesh.geometry.dispose(); (mesh.material as MeshLambertNodeMaterial).dispose(); mesh.dispose(); }
    this.heroSlots.clear();
    for (const batch of this.batches.values()) { batch.mesh.geometry.dispose(); (batch.mesh.material as MeshLambertNodeMaterial).dispose(); batch.mesh.dispose(); batch.texture.dispose(); }
    for (const mesh of [...this.telegraphs, this.shadows, this.caps]) { mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); mesh.dispose(); }
    this.batches.clear(); this.corpses.clear(); this.clear(); void this.registry.dispose();
  }
}
