import { infectedContactDistance } from '../sim/ai/CharacterSeparation';
import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CrowdVisibility } from './CrowdVisibility';
import { crowdModelKey, registerCrowdModel } from './crowdModels';
import { simplifyCrowdLod } from './characters/crowdLodGeometry';
import { crowdLod } from './lodPolicy';
import { StaticCorpses } from './characters/StaticCorpses';
import { CrowdFootwork, CrowdLocomotion } from './characters/CrowdLocomotion';
import { InfectedMoves, getUpSpan } from './characters/InfectedMoves';
import { GaitPhase } from './characters/GaitPhase';
import { CrowdFigureProbe } from './characters/CrowdFigureProbe';
import { contactShadowMaterial } from './ContactShadows';
import { qualityBudgets, type QualityTier } from '../core/Quality';
// Adapted from Bruno Simon InstancedGroup.js (MIT, 41046b5), using E17 GPU crowdMatrix/clipTexture.
import { BoxGeometry, BufferGeometry, PlaneGeometry, Color, ConeGeometry, DoubleSide, FrontSide, Group, InstancedBufferAttribute, InstancedInterleavedBuffer, InstancedMesh, Matrix4, Mesh, MeshLambertNodeMaterial, MeshBasicNodeMaterial, RingGeometry, Frustum, Sphere, Vector3, StreamDrawUsage } from 'three/webgpu';
import { attribute, instancedBufferAttribute, mat4, normalGeometry, vec3, positionGeometry, mix, vec4, float, cameraViewMatrix, luminance, screenCoordinate, uniform } from 'three/tsl';
import { crowdBlendedMatrix, packCrowdParts } from '../assets/crowd';
import type { Materials } from './Materials';
import { AssetRegistry } from '../assets/registry';
import manifest from '../assets/manifest.json';
import { civilianRoles } from '../data/npcs';
import { infectedDefinitions } from '../data/infected';
import type { EntitySnapshot } from '../sim/world/types';
import { isOutbreakDistrict } from '../levels/districts/types';
import type { SimWorld } from '../sim/world/SimWorld';
import { createInfectedPlaceholder } from './characters/infectedPlaceholder';
import type { View } from './View';
import { bakeInfected, framesPerClip, infectedClips } from './characters/bakeInfected';
import { loadGate } from '../assets/loadGate';
import { authoredClips, strides } from './characters/clips';
import { CrowdPosePalette } from './characters/CrowdPosePalette';
import { MotionPresentation, crowdTurnRate } from './characters/MotionPresentation';
import { MotionPhase } from './characters/MotionPhase';
import { loadMeasure } from '../assets/loadTiming';
import { keepsLook } from '../sim/outbreak/appearance';
interface Batch { animal: boolean; locomotion: CrowdLocomotion; probe: CrowdFigureProbe; poses: CrowdPosePalette; mesh: InstancedMesh; state: InstancedBufferAttribute; tint: InstancedBufferAttribute; shirt: Color; strideScale: number; windup: number; texture: import('three').DataTexture; count: number; placeholders: boolean; lod: string; role: string }
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
  private readonly modelAliases = new Map<string, string>();
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
  /** Displayed turn rate cap (rad/s): sim facing snaps become stepped turns. */
  private readonly presentation = new MotionPresentation(crowdTurnRate);
  private readonly motion = new MotionPhase();
  private readonly gait = new GaitPhase();
  /** Courier footwork for the infected inside the close pixel band (budgeted per frame; phones solve fewer). */
  private readonly footwork = new CrowdFootwork(40);
  private readonly footBands = new Map<number, 'lod1' | 'lod2'>();
  private readonly moves = new InfectedMoves();
  /** Corpses persist until a level/checkpoint resets their sim IDs. */
  private get corpseTicks(): number { return Infinity; }
  private readonly staticCorpses = new StaticCorpses();
  private readonly corpseGeometry = new Map<string, BufferGeometry>();
  private readonly corpses = new Map<number, { x: number; z: number; sourceX: number; sourceZ: number; deadAt: number }>();
  private readonly elephantArrowScale = new Matrix4().makeScale(1, 1, 3.5 / (1.1 * 1.8));
  private readonly physicalArrowTail = new Matrix4();
  private readonly physicalArrowScale = new Matrix4().makeScale(1.15, .025, 1.8);
  private readonly telegraphs: InstancedMesh[] = [];
  private readonly shadows: InstancedMesh;
  private readonly feedback = new Map<number, { mask: number; strength: number }>();
  private readonly caps = new InstancedMesh(new BoxGeometry(.18, .06, .18), new MeshBasicNodeMaterial({ color: '#b3121f' }), 1750);
  private goreEnabled = true;
  private cullDistance = 60;
  setQuality(tier: QualityTier): void { this.cullDistance = qualityBudgets[tier].cullDistance; this.low = tier === 'low'; this.footwork.cap = this.low ? 12 : 40; }
  private readonly logs: { id: string; reason: string }[] = [];
  constructor(private readonly world: SimWorld, private low = false, private readonly shading?: Materials) {
    super(); this.name = 'infected-crowd'; this.add(this.staticCorpses);
    this.caps.frustumCulled = false; this.caps.count = 0; this.add(this.caps);
    this.registry = new AssetRegistry((event) => this.logs.push(event));
    const ring = new RingGeometry(0.7, 0.8, 24); ring.rotateX(-Math.PI / 2);
    const arrow = new ConeGeometry(0.55, 2.5, 3); arrow.rotateZ(-Math.PI / 2); arrow.translate(1.3, 0, 0);
    for (const geometry of [ring, arrow]) { const mesh = new InstancedMesh(geometry, new MeshBasicNodeMaterial({ color: new Color('#ffb32d').multiplyScalar(1.6), transparent: true, depthWrite: false }), 1400); mesh.frustumCulled = false; mesh.count = 0; this.telegraphs.push(mesh); this.add(mesh); }
    const shadow = new PlaneGeometry(1.2, 1.2); shadow.rotateX(-Math.PI / 2);
    this.shadows = new InstancedMesh(shadow, contactShadowMaterial(), 350); this.shadows.frustumCulled = false; this.shadows.count = 0; this.add(this.shadows);
  }
  async init(): Promise<void> {
    const started = performance.now();
    const variants = manifest.filter(a => a.status === 'integrated' && a.category === 'infected' && !infectedDefinitions.some(d => d.asset === a.id) && a.id !== 'inf.corpse-poses');
    const models = new Set([...this.world.entities.iterate()].flatMap(e => e.civilian?.schedule && e.civilian.model ? [e.civilian.model] : []));
    const animals = [...new Set([...this.world.entities.iterate()].flatMap(e => e.civilian?.zooAnimal ? [e.civilian.zooAnimal] : []))];
    const healthyDefinitions = animals.map(species => ({ ...infectedDefinitions.find(d => d.id === `infected.${species}`)!, id: `healthy.${species}`, asset: `amb.${species}` }));
    // Healthy amb.* assets are catalog props, so register their real rigs explicitly as animated crowds.
    const allDefinitions = [...healthyDefinitions, ...[...models].map(model => ({ ...infectedDefinitions[0], id: model, asset: model })), ...infectedDefinitions, { ...infectedDefinitions[0], id: 'infected.patient-zero', asset: 'npc.patient-zero-courier' }, ...variants.map(a => ({ ...infectedDefinitions[0], id: a.id, asset: a.id }))];
    // L1 v2: every infected is a pedestrian that keeps its look and is drawn by the civilian crowd (lane D); this view
    // only needs the plain runner fallback plus scripted infected actors. Without the outbreak layer keep the old set.
    const regularCrowd = this.world.scenario === 'L7' || this.world.scenario?.startsWith('perf-horde-');
    const actors = Object.values(this.world.missions?.def.actors ?? {}).map(actor => actor.archetype);
    const l1Roles = new Set<string>(regularCrowd || this.world.scenario === 'L6' || this.world.npcs?.civilians.outbreak || this.world.districts?.districts.some(d => isOutbreakDistrict(d.id)) ? ['infected.runner', ...actors] : ['infected.runner', ...actors, ...civilianRoles.map(role => role.variant), ...models]);
    for (const species of animals) { l1Roles.add(`healthy.${species}`); l1Roles.add(`infected.${species}`); }
    for (const entity of this.world.entities.iterate()) if (entity.infected) {
      l1Roles.add(entity.archetype);
      const model = entity.infected.model ?? entity.infected.variant;
      if (model) l1Roles.add(model);
    }
    // First Alphas emerge after the Fairhaven crowd has initialized. Warm the
    // derived model now, including its sim definition when A-S1 registers it.
    if (this.world.scenario === 'L4' || this.world.scenario === 'L5' || this.world.scenario === 'L7')
      for (const def of allDefinitions) if (def.asset === 'inf.alpha') l1Roles.add(def.id);
    const grove = this.world.scenario === 'L1' || this.world.scenario === 'L2' || this.world.scenario === 'L3' || this.world.scenario === 'L4' || this.world.scenario === 'L5' || this.world.scenario === 'L6';
    const definitions = grove || regularCrowd ? allDefinitions.filter(def => l1Roles.has(def.id) || l1Roles.has(def.asset)) : allDefinitions;
    for (const def of definitions) {
      // Registrations must not remove the asset spelling used by model overrides.
      const key = def.id.startsWith('healthy.') ? def.id : registerCrowdModel(this.modelAliases, def);
      if (def.id.startsWith('healthy.')) this.modelAliases.set(def.id, key);
      this.definitions.set(key, def);
      if (!this.low) {
        const mesh = new InstancedMesh(new BufferGeometry(), this.shading?.shaded(vec3(1)) ?? new MeshBasicNodeMaterial(), 350);
        mesh.count = 0; mesh.visible = false; this.heroSlots.set(key, mesh); this.add(mesh);
      }
    }
    // The low tier only ever draws LOD2 (see update); it never loads LOD0/LOD1.
    const lods: ('lod0' | 'lod1' | 'lod2')[] = this.low ? ['lod2'] : grove ? ['lod0', 'lod1', 'lod2'] : ['lod1', 'lod2'];
    await Promise.all(definitions.flatMap(def => lods.map(lod => this.loadBatch(def, lod))));
    loadMeasure('view:infected-crowd', started);
    this.update();
  }
  private async loadBatch(def: { id: string; asset: string; windup: number }, lod: 'lod0' | 'lod1' | 'lod2'): Promise<void> {
      const key = crowdModelKey(def);
      const role = def.id.startsWith('infected.') ? def.id.slice(9) : 'runner', asset = def.asset;
      const loaded = await this.registry.loadAsset(asset, lod) as Group;
      await loadGate.foreground(); await loadGate.wait(); // bakes wait for the level pick, then one per frame
      if (this.disposed) return;
      const healthy = def.id.startsWith('healthy.');
      const fallback = Boolean(loaded.userData.placeholder), model = fallback ? createInfectedPlaceholder(role) : loaded;
      const baked = bakeInfected(model, this.registry.definition(asset).animatedNodes, role === 'crawler' && !fallback, undefined, fallback ? undefined : `${asset}:${lod}`), capacity = role === 'crow' ? 800 : 350;
      const locomotion = new CrowdLocomotion(model, baked.clip, this.footwork);
      const probe = new CrowdFigureProbe(); probe.lod = lod; probe.sole = locomotion.sole; if (model.getObjectByName('legFL')) probe.animal(model);
      // Baking expands rigid parts to triangle soup. Index identical vertices before
      // instanced attributes are attached: same surfaces, fewer animated vertices.
      deinterleaveGeometry(baked.geometry);
      const indexed = mergeVertices(baked.geometry); baked.geometry.dispose(); baked.geometry = indexed;
      if (lod === 'lod2' && !fallback) {
        // Phone crowd silhouettes tolerate a 2.5 cm surface bound; preserve colors, eyes and rigid-part ownership.
        await simplifyCrowdLod(baked.geometry, this.low ? .025 : .01, this.low ? .2 : .35);
        // Settled bodies retain identity and color but need no living figure detail.
        const corpse = baked.geometry.clone(); await simplifyCrowdLod(corpse, .04, .1);
        if (this.disposed) { corpse.dispose(); baked.geometry.dispose(); return; }
        packCrowdParts(corpse);
        this.corpseGeometry.set(key, corpse);
      }
      const poses = new CrowdPosePalette(baked.clip, capacity), texture = poses.texture;
      packCrowdParts(baked.geometry);
      const tint = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(StreamDrawUsage);
      // Pack frame, detached leg, gore mask and flash into one slot: WebGL2 guarantees 16 attributes.
      const state = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(StreamDrawUsage);
      baked.geometry.setAttribute('_state', state); baked.geometry.setAttribute('_variant', tint);
      const feedbackState = attribute('_state', 'vec4'), parts = attribute('_parts', 'vec4'), variant = attribute('_variant', 'vec4');
      const opacity = feedbackState.w.div(2).floor().div(255).oneMinus();
      const sourceColor = mix(attribute('color', 'vec3'), variant.xyz, parts.y.max(0));
      const base = healthy ? mix(sourceColor, vec3(.26, .3, .22), feedbackState.z.mul(.4)) : sourceColor, glow = attribute('color', 'vec3').div(luminance(attribute('color', 'vec3')).max(.25)).mul(parts.z).mul(1.2).add(feedbackState.w.mod(2));
      const material = this.shading?.shaded(base, glow) ?? Object.assign(new MeshLambertNodeMaterial({ vertexColors: false }), { colorNode: base, emissiveNode: glow });
      // E25 night readability: crowd silhouettes take the preset's moonlit rim.
      if ('figureRim' in material) material.figureRim.value = 1;
      // Instances cannot be sorted independently in the transparent render list.
      // A shared 4x4 screen-door threshold keeps every surface of a corpse at
      // a pixel together, unlike a 3D hash that exposes its deeper body parts.
      // Living actors keep every pixel; discarded pixels never write depth.
      const pixel = screenCoordinate.xy.floor();
      const bayer2 = (p: typeof pixel) => p.x.mod(2).mul(2).add(p.y.mod(2).mul(3)).mod(4);
      const threshold = bayer2(pixel).mul(4).add(bayer2(pixel.div(2).floor())).add(.5).div(16);
      material.maskNode = opacity.greaterThan(threshold);
      material.depthTest = material.depthWrite = true;
      material.side = baked.doubleSided ? DoubleSide : FrontSide;
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
      const slot = lod === 'lod0' ? this.heroSlots.get(key) : undefined;
      const mesh = slot ?? new InstancedMesh(baked.geometry, material, capacity); mesh.userData.preRenderTextures = [texture];
      mesh.instanceMatrix.setUsage(StreamDrawUsage);
      if (slot) { mesh.geometry.dispose(); (mesh.material as MeshLambertNodeMaterial).dispose(); mesh.geometry = baked.geometry; mesh.material = material; this.heroSlots.delete(key); } mesh.userData.preRenderSolo = true; mesh.name = key; mesh.frustumCulled = false; mesh.count = 0;
      // E17's explicit instance * part order: positionNode runs after default instancing.
      const matrices = new InstancedInterleavedBuffer(mesh.instanceMatrix.array, 16, 1).setUsage(StreamDrawUsage);
      mesh.onBeforeRender = () => { matrices.version = mesh.instanceMatrix.version; matrices.clearUpdateRanges(); matrices.addUpdateRange(0, mesh.count * 16); };
      const column = (offset: number) => instancedBufferAttribute(matrices, 'vec4' as const, 16, offset);
      const instance = mat4(column(0), column(4), column(8), column(12));
      material.positionNode = instance.mul(matrix.mul(vec4(positionGeometry.mul(visible), 1))).xyz;
      material.normalNode = instance.mul(matrix.mul(vec4(normalGeometry, 0))).xyz.transformDirection(cameraViewMatrix);
      mesh.onAfterRender = () => probe.draw();
      this.batches.set(`${key}:${lod}`, { animal: !!model.getObjectByName('legFL'), locomotion, probe, poses, lod, role: key, mesh, state, tint, shirt: baked.shirtColor ?? new Color(1, 1, 1), strideScale: baked.strideScale, windup: def.windup, texture, count: 0, placeholders: fallback }); this.add(mesh);
      if (fallback) model.traverse((n) => { if (n instanceof Mesh) { n.geometry.dispose(); for (const m of Array.isArray(n.material) ? n.material : [n.material]) m.dispose(); } });
  }
  private modelKey(id: string): string | undefined {
    const key = this.modelAliases.get(id);
    return key && (this.batches.has(`${key}:lod1`) || this.batches.has(`${key}:lod2`)) ? key : undefined;
  }
  async ready(): Promise<void> { await Promise.all(this.pending.values()); }
  update(view?: View, alpha = 1): void {
    this.staticCorpses.begin(id => this.world.entities.get(id));
    for (const [id, pose] of this.corpses) if (!this.world.entities.get(id)?.infected || this.world.entities.get(id)!.health.current > 0 || this.world.tick - pose.deadAt > this.corpseTicks) this.corpses.delete(id);
    for (const batch of this.batches.values()) { batch.count = 0; batch.probe.begin(); }
    this.footwork.begin(Math.max(0, this.world.tick + alpha - 1) / 60);
    for (const mesh of this.telegraphs) mesh.count = 0; this.shadows.count = 0; this.caps.count = 0;
    for (const [id, feedback] of this.feedback) { const e = this.world.entities.get(id); if (!e?.combat || e.hidden || e.infected?.hidden) this.feedback.delete(id); else if (e.health.current > 0) feedback.mask = 0; }
    const player = this.world.entities.get(1)!;
    const focus = view?.cameraTarget ?? player.transform;
    if (view) this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse));
    this.visibility.begin(view?.camera, typeof innerHeight === 'number' ? innerHeight : 900, view?.lodCamera);
    const heroes = this.heroIds; this.previousHeroes.clear();
    for (const id of heroes) this.previousHeroes.add(id);
    heroes.clear(); this.nearest.length = 0; this.rolePixels.clear();
    if (!this.low) for (const e of this.world.entities.iterate()) {
      if (e.faction !== 'infected' && !e.civilian?.zooAnimal || !e.combat || e.hidden || e.infected?.hidden || e.archetype === 'infected.crow' || e.corpse || keepsLook(e)) continue;
      if (e.health.current <= 0 && this.world.tick - (e.infected?.deadAt ?? 0) >= this.corpseTicks) continue;
      const distance = Math.hypot(e.transform.x - focus.x, e.transform.z - focus.z);
      if (distance > this.cullDistance) continue;
      const variant = e.infected?.model ?? e.infected?.variant;
      const role = this.modelKey(e.civilian?.zooAnimal ? `healthy.${e.civilian.zooAnimal}` : e.archetype) ?? this.modelKey('infected.runner')!;
      const key = (variant && this.modelKey(variant)) || role;
      const d = this.registry.definition(this.definitions.get(key)!.asset).dimensions;
      if (!this.visibility.visible(e.transform.x, e.transform.y - .7 + d.y / 2, e.transform.z, Math.hypot(d.x, d.y, d.z) / 2 + .75)) continue;
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
    for (const [role, pixels] of this.rolePixels) this.roleLods.set(role, crowdLod(pixels, this.roleLods.get(role)));
    for (const e of this.nearest) heroes.add(e.id);
    for (const e of this.world.entities.iterate()) {
      if (e.id === 1 || e.faction !== 'infected' && !e.civilian?.zooAnimal || !e.combat) continue;
      const distance = Math.hypot(e.transform.x - focus.x, e.transform.z - focus.z);
      if (e.hidden || e.infected?.hidden || !view && distance > this.cullDistance && !e.corpse || e.infected?.state === 'dead' && this.world.tick - e.infected.deadAt > this.corpseTicks) continue;
      // L1 v2: a pedestrian who turned keeps its own body and clothes (NpcView's civilian crowd); only the contact shadow is drawn here.
      if (keepsLook(e)) { if (!e.corpse && this.shadows.count < 350) { this.transform.makeTranslation(e.transform.x, (this.world.districts?.groundHeight(e.transform.x, e.transform.z) ?? 0) + .018, e.transform.z); this.shadows.setMatrixAt(this.shadows.count++, this.transform); } continue; }
      if (e.corpse && this.staticCorpses.has(e.id)) continue;
      const availableLod = this.low ? 'lod2' : 'lod1';
      const role = this.modelKey(e.civilian?.zooAnimal ? `healthy.${e.civilian.zooAnimal}` : e.archetype) ?? this.modelKey('infected.runner')!;
      const variant = e.infected?.model ?? e.infected?.variant;
      const key = (variant && this.modelKey(variant)) || role;
      const def = this.definitions.get(key)!;
      const dimensions = this.registry.definition(def.asset).dimensions;
      this.bounds.center.set(e.transform.x, e.transform.y - .7 + dimensions.y / 2, e.transform.z);
      this.bounds.radius = Math.hypot(dimensions.x, dimensions.y, dimensions.z) / 2 + .75;
      if (e.archetype === 'infected.crow' && e.infected) for (let bird = 0; bird < 20; bird++) {
        if (!e.infected.birdAlive[bird] && !((e.infected.birdDeadMask ?? 0) & 1 << bird)) continue;
        const p = e.infected.birdPositions;
        this.bounds.radius = Math.max(this.bounds.radius, Math.hypot(p[bird * 3] - this.bounds.center.x, p[bird * 3 + 1] - this.bounds.center.y, p[bird * 3 + 2] - this.bounds.center.z) + .5);
      }
      if (view && !e.corpse && !this.frustum.intersectsSphere(this.bounds)) continue;
      let lod: 'lod0' | 'lod1' | 'lod2' = this.low || e.health.current <= 0 || (this.world.infected?.active.length ?? 0) >= 100 ? 'lod2' : this.roleLods.get(key) ?? 'lod2';
      if (e.health.current > 0 && heroes.has(e.id)) {
        if (this.batches.has(`${key}:lod0`)) lod = 'lod0';
        else if (!this.pending.has(key)) {
          this.pending.set(key, this.loadBatch(def, 'lod0').finally(() => this.pending.delete(key)));
        }
      }
      // Quality changes/streaming may not have the requested tier yet. Keep the loaded figure.
      const batch = this.batches.get(`${key}:${lod}`) ?? this.batches.get(`${key}:${availableLod}`) ?? this.batches.get(`${key}:lod2`) ?? this.batches.get(`${key}:lod1`);
      if (!batch) continue;
      const b = e.infected ?? { state: e.health.current <= 0 || e.civilian?.state === 'finished' ? 'dead' : e.combat.attacking ? 'attack' : 'idle', until: 0, deadAt: e.civilian?.entered ?? 0, legLost: false, special: '', detached: false, variant: '', birdAlive: [], birdPositions: [], dx: 0, dz: 0 };
      const specialAttack = e.infected?.specialAttack;
      const physical = specialAttack && ['alpha.charge', 'alpha.ground-slam', 'lion.pounce', 'lion.flank', 'gorilla.pound', 'gorilla.roar', 'elephant.charge', 'elephant.swipe', 'zebra.stampede'].includes(specialAttack.move) ? specialAttack : undefined;
      const feedback = this.feedback.get(e.id);
      const renderTick = Math.max(0, this.world.tick + alpha - 1);
      const tick = distance > 35 ? Math.floor(this.world.tick / 2) * 2 : this.world.tick;
      const motion = e.motion ?? this.motion.sample(e.id, tick, e.transform.x, e.transform.z), gaitDistance = Math.max(0, motion.distance - motion.speed * (1 - alpha) / 60), reaction = e.combat.reaction;
      const age = reaction ? (this.world.tick - reaction.started) / 60 : Infinity;
      const death = e.archetype === 'infected.crawler' ? 'death-side' : 'death-back';
      let clip: typeof infectedClips[number] = b.state === 'dead' ? death : (b.legLost || e.archetype === 'infected.crawler') && motion.speed <= .06 ? 'crawl' : b.state === 'attack' && motion.speed <= .06 ? this.world.tick < b.until ? 'windup' : 'swing' : motion.speed > 2 ? tierGait(b as { speed?: number; tier?: string; l1?: { tier: string } }) : motion.speed > .06 ? 'shamble' : (b.state as string) === 'search' || (b.state as string) === 'attracted' ? 'infected-search' : 'infected-idle';
      // Heavy reactions (deaths, finishers, kicks, blasts) knock down and get up, also while knocked back; light hits only flinch (InfectedMoves).
      const heavy = !!reaction?.heavy && tick < reaction.until && b.state !== 'dead';
      if (heavy) clip = age < .48 ? reaction!.index % 2 ? 'knockdown' : 'flung' : age < .7 ? 'knockdown' : 'get-up';
      if (physical?.stage === 'telegraph') clip = 'windup';
      else if ((physical?.move === 'alpha.ground-slam' || physical?.move === 'gorilla.pound') && physical.stage === 'recovery') clip = 'swing';
      else if (physical?.move === 'elephant.swipe' && physical.stage === 'recovery') clip = 'swing';
      if (e.civilian?.zooAnimal) clip = e.civilian.state === 'finished' ? death : e.infection ? 'idle' : motion.speed > .06 ? 'walk' : 'idle';
      if (e.infectionRise) clip = 'infection-rise';
      if (b.special === 'dive') clip = 'run';
      if (e.infected?.specialAttack?.stage === 'telegraph') clip = 'windup';
      if (specialAttack?.move === 'zebra.kick') clip = 'zebra-rear-kick';
      if (specialAttack?.move === 'zebra.stampede' && specialAttack.stage === 'active') clip = 'zebra-stampede';
      if (specialAttack?.move === 'flamingo.dive' && specialAttack.stage === 'active') clip = 'run';
      const duration = authoredClips.get(clip)?.duration ?? 1;
      const phase = clip === 'zebra-rear-kick' && specialAttack ? Math.min(1, (renderTick - specialAttack.startTick) / (specialAttack.activeTick - specialAttack.startTick + 36)) : clip === 'zebra-stampede' && specialAttack ? .5 + ((renderTick - specialAttack.activeTick) / 32 % 1) / 3 : e.infectionRise ? Math.min(1, (this.world.tick - e.infectionRise.started) / (e.infectionRise.until - e.infectionRise.started)) : b.state === 'dead' ? (reaction?.groundDeath ? 1 : Math.min(1, (this.world.tick - b.deadAt) / 60 / duration)) - InfectedMoves.stir(e, renderTick, duration) : clip === 'windup' ? e.infected?.specialAttack ? Math.min(1, (renderTick - e.infected.specialAttack.startTick) / (e.infected.specialAttack.activeTick - e.infected.specialAttack.startTick)) : Math.max(0, Math.min(1, 1 - (b.until - this.world.tick) / (batch.windup * 60))) : reaction && clip === 'get-up' ? Math.min(1, (age - .7) / getUpSpan(reaction)) : reaction && ['flung', 'knockdown', 'stagger-left', 'stagger-right'].includes(clip) ? Math.min(1, age / (reaction.heavy ? .48 : (reaction.until - reaction.started) / 60)) : strides[clip] ? this.gait.sample(e.id, gaitDistance, batch.animal ? 'corgi-trot' : clip, batch.strideScale, motion.speed) : (renderTick / 60 + e.id * .137) / duration % 1;
      let frame = infectedClips.indexOf(clip) * framesPerClip + phase * (framesPerClip - 1);
      const tint = variantShirts[b.variant] ?? batch.shirt;
      const presented = this.presentation.sample(e.id, e.transform, this.world.tick, alpha);
      const resting = b.state === 'dead' ? this.corpsePosition(e, b.deadAt) : e.transform;
      const settle = b.state === 'dead' ? reaction?.groundDeath ? 1 : Math.min(1, (this.world.tick - b.deadAt) / 60) : 0;
      const x = presented.x + (resting.x - e.transform.x) * settle, z = presented.z + (resting.z - e.transform.z) * settle;
      const blend = batch.poses.sample(e.id, clip, frame, renderTick / 60);
      const fade = 0;
      if (e.archetype === 'infected.crow') {
        for (let bird = 0; bird < 20; bird++) if ((e.infected?.birdDeadMask ?? 0) & 1 << bird) {
          const x = b.birdPositions[bird * 3], z = b.birdPositions[bird * 3 + 2]; this.transform.makeTranslation(x, this.world.districts?.groundHeight(x, z) ?? 0, z);
          this.staticCorpses.place(e, `${key}:bird`, batch.mesh.geometry, batch.mesh.material as MeshLambertNodeMaterial, batch.poses.clip, infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1, this.transform, tint, [0, 0, 0], `${e.id}/${bird}`);
        }
        for (let bird = 0; bird < 20; bird++) if (b.birdAlive[bird]) { this.transform.makeTranslation(b.birdPositions[bird * 3], b.birdPositions[bird * 3 + 1], b.birdPositions[bird * 3 + 2]); batch.mesh.setMatrixAt(batch.count, this.transform); batch.tint.setXYZW(batch.count, tint.r, tint.g, tint.b, blend[0] * 2 + blend[1]); batch.state.setXYZW(batch.count++, frame, 0, 0, feedback?.strength ?? 0); }
      } else {
        this.transform.makeRotationY(presented.yaw + (e.civilian?.zooAnimal && e.infection ? Math.sin(renderTick * .5 + e.id) * .018 * e.infection.progress : 0)); this.transform.setPosition(x, Math.max(presented.y - 0.7, this.world.districts?.pavingHeight(x, z) ?? 0) + (reaction?.heavy && age < .48 ? Math.max(0, .16 * (1 - Math.abs(age / .24 - 1))) : 0), z);
        if (e.corpse) {
          const mask = (feedback?.mask ?? 0) | (b.detached && this.goreEnabled ? 4 : 0);
          const hiddenParts = [['armL', 'foreArmL', 'handL'], ['armR', 'foreArmR', 'handR'], ['legL', 'shinL', 'footL'], ['legR', 'shinR', 'footR'], ['head']].flatMap((parts, bit) => mask & 1 << bit ? parts : []);
          this.staticCorpses.place(e, `${key}:${death}:${mask}`, this.corpseGeometry.get(key) ?? batch.mesh.geometry, batch.mesh.material as MeshLambertNodeMaterial, batch.poses.clip, infectedClips.indexOf(death) * framesPerClip + framesPerClip - 1, this.transform, tint, [0, 0, 0], String(e.id), hiddenParts);
          continue;
        }
        // Close pixel band (hysteresis): the courier's footwork plus the zombie move set; further out stance plants only.
        const band = crowdLod(this.visibility.pixels(e.transform.x, e.transform.y, e.transform.z, dimensions.y), this.footBands.get(e.id)); this.footBands.set(e.id, band);
        const crawling = b.legLost || e.archetype === 'infected.crawler' || clip === 'crawl', moving = !!strides[clip] && motion.speed > .06;
        const { layers, style } = this.moves.sample(e, b.state, b.until, batch.windup, renderTick, presented.yaw, motion.speed, moving ? clip : undefined);
        // The baked hunch already reaches toward the victim. Keep the added pelvis/torso lunge
        // inside the reserved contact space; distant windups retain their full coil and extension.
        const target = this.world.entities.get(e.infected?.heardTargetId || e.infected?.l1?.targetId || 1);
        if (target?.survivor && Math.hypot(x - target.transform.x, z - target.transform.z) < infectedContactDistance(e.combat!.radius) + .15) layers.lunge = Math.min(layers.lunge ?? 0, .04);
        const layered = !crawling && (layers.lunge || layers.flinch || layers.lurch || layers.chestBeat || layers.trunkSwipe || layers.throwPose) ? layers : undefined;
        // Wide Roar framing still needs planted turns and grounded convergence.
        frame = batch.locomotion.present(e.id, batch.poses, frame, blend, clip, phase, this.transform, batch.strideScale, motion.speed, renderTick / 60, (band === 'lod1' || !moving || !!specialAttack || !!e.infected?.roar) && !crawling, layered, style);
        batch.probe.add(e.id, clip, phase, this.transform, batch.poses, frame, ...blend, batch.mesh.geometry);
        batch.mesh.setMatrixAt(batch.count, this.transform); batch.tint.setXYZW(batch.count, tint.r, tint.g, tint.b, blend[0] * 2 + blend[1]); batch.state.setXYZW(batch.count++, frame, Number(b.detached && this.goreEnabled), e.civilian?.zooAnimal ? e.infection?.progress ?? 0 : feedback?.mask ?? 0, (feedback?.strength ?? 0) + Math.round(fade * 255) * 2);
        for (let limb = 0; limb < 5; limb++) if ((feedback?.mask ?? 0) & (1 << limb)) { const p = this.limbPosition(e.id, limb)!; this.transform.makeRotationY(e.transform.yaw); this.transform.setPosition(p.x, p.y + (limb === 4 ? -.17 : .18), p.z); this.caps.setMatrixAt(this.caps.count++, this.transform); }
      }
      if (e.archetype !== 'infected.crow') { this.transform.makeTranslation(e.transform.x, (this.world.districts?.groundHeight(e.transform.x, e.transform.z) ?? 0) + .018, e.transform.z); this.shadows.setMatrixAt(this.shadows.count++, this.transform); }
      if (physical && physical.stage !== 'recovery' && physical.move !== 'elephant.swipe') {
        const area = physical.area, ground = (this.world.districts?.groundHeight(area.x, area.z) ?? 0) + .065;
        if (physical.move === 'alpha.ground-slam' || physical.move === 'gorilla.pound' || physical.move === 'gorilla.roar') {
          this.transform.makeScale(area.radius / .8, 1, area.radius / .8); this.transform.setPosition(area.x, ground, area.z);
          this.telegraphs[0].setMatrixAt(this.telegraphs[0].count++, this.transform);
          if (physical.move === 'gorilla.roar') {
            this.transform.makeScale(1.5 / .8, 1, 1.5 / .8); this.transform.setPosition(area.x, ground, area.z);
            this.telegraphs[0].setMatrixAt(this.telegraphs[0].count++, this.transform);
          }
        } else {
          // A sequence of fixed, two-metre-wide arrows shows the entire locked twelve-metre corridor.
          const length = physical.move === 'lion.pounce' ? Math.min(8, Math.hypot(physical.target.x - area.x, physical.target.z - area.z)) : physical.destination ? Math.hypot(physical.destination.x - area.x, physical.destination.z - area.z) : physical.move === 'elephant.charge' ? 16 : physical.move === 'zebra.stampede' ? 15 : 12;
          for (let i = 0; i < Math.ceil(length / 3); i++) {
            this.transform.makeRotationY(-Math.atan2(area.dz, area.dx)); this.transform.multiply(this.physicalArrowScale);
            if (physical.move === 'elephant.charge' || physical.move === 'zebra.stampede') {
              if (physical.move === 'elephant.charge') this.transform.multiply(this.elephantArrowScale);
              else this.transform.multiply(this.physicalArrowTail.makeScale(1, 1, 1.5 / (1.1 * 1.8)));
              this.physicalArrowTail.makeScale(Math.min(3, length - i * 3) / 3, 1, 1); this.transform.multiply(this.physicalArrowTail);
            }
            this.transform.setPosition(area.x + area.dx * i * 3, ground, area.z + area.dz * i * 3);
            this.telegraphs[1].setMatrixAt(this.telegraphs[1].count++, this.transform);
          }
        }
      }
      if ((b.state === 'attack' || (b.state === 'dead' && b.special === 'explode')) && this.world.tick < b.until) {
        const mesh = this.telegraphs[b.special === 'charge' || b.special === 'pin' || b.special === 'pounce' ? 1 : 0]; if (b.special === 'explode') this.transform.makeScale(3.75, 1, 3.75); else this.transform.makeRotationY(-Math.atan2(b.dz, b.dx)); this.transform.setPosition(e.transform.x, 0.06, e.transform.z); mesh.setMatrixAt(mesh.count++, this.transform);
      }
    }
    for (const batch of this.batches.values()) {
      batch.mesh.count = batch.count; batch.mesh.visible = batch.count > 0;
      if (batch.count) {
        batch.mesh.instanceMatrix.clearUpdateRanges(); batch.mesh.instanceMatrix.addUpdateRange(0, batch.count * 16); batch.mesh.instanceMatrix.needsUpdate = true;
        for (const attribute of [batch.state, batch.tint]) { attribute.clearUpdateRanges(); attribute.addUpdateRange(0, batch.count * 4); attribute.needsUpdate = true; }
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
    if (e.corpseThrown) return e.transform;
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
  clearGore(): void { for (const feedback of this.feedback.values()) feedback.mask = 0; this.staticCorpses.reset(); }
  setGoreEnabled(enabled: boolean): void { if (this.goreEnabled !== enabled) this.staticCorpses.reset(); this.goreEnabled = enabled; }
  getGoreState() { return [...this.feedback].map(([id, f]) => ({ id, detached: ['armL', 'armR', 'legL', 'legR', 'head'].filter((_, i) => f.mask & (1 << i)), caps: ['armL_cap', 'armR_cap', 'legL_cap', 'legR_cap', 'head_cap'].filter((_, i) => f.mask & (1 << i)), visible: !this.world.entities.get(id)?.infected?.hidden })); }
  getState() {
    let instances = 0, draws = 0, objects = 0, nonInstanced = 0;
    this.traverse((node) => { if (node !== this) objects++; if (node instanceof InstancedMesh) { instances += node.count; if (node.count) draws++; } else if (node instanceof Mesh) nonInstanced++; });
    return { telegraphs: this.telegraphs.map(mesh => mesh.count), figures: [...this.batches.values()].flatMap(b => b.probe.figures).concat(this.staticCorpses.snapshot().figures), instances, meshDrawCalls: draws, objects, nonInstancedMeshes: nonInstanced, caps: this.caps.count, flashes: [...this.feedback.values()].filter(f => f.strength > 0).length, batches: [...this.batches.values()].map((b) => ({ id: b.role, lod: b.lod, instances: b.count, source: b.placeholders ? 'placeholder' : 'glb' })).concat([...this.heroSlots.keys()].map(id => ({ id, lod: 'lod0', instances: 0, source: 'pending' }))), assets: this.logs };
  }
  dispose(): void {
    this.disposed = true; this.staticCorpses.dispose();
    for (const mesh of this.heroSlots.values()) { mesh.geometry.dispose(); (mesh.material as MeshLambertNodeMaterial).dispose(); mesh.dispose(); }
    this.heroSlots.clear();
    for (const geometry of this.corpseGeometry.values()) geometry.dispose();
    this.corpseGeometry.clear();
    for (const batch of this.batches.values()) { batch.mesh.geometry.dispose(); (batch.mesh.material as MeshLambertNodeMaterial).dispose(); batch.mesh.dispose(); batch.texture.dispose(); }
    for (const mesh of [...this.telegraphs, this.shadows, this.caps]) { mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); mesh.dispose(); }
    this.batches.clear(); this.corpses.clear(); this.clear(); void this.registry.dispose();
  }
}
