import { livingStencil } from './characters/figureStencil';
import { K9Vest } from './characters/K9Vest';
import { paintedSkinMask } from './characters/paintedSkin';
import { crowdRegionOf, crowdRegionSkin, crowdRegionTint } from './characters/crowdRegions';
import { crowdLimbParts } from '../assets/crowdParts';
import { crowdTexture, crowdTextureForDraw, interleaveTexturedCrowd, crowdSurfaceBindings } from './characters/crowdTexture';
import { shareDogCoatPalette } from './characters/shareDogCoatPalette';
import { dogCoats, dogCoat } from '../data/dogAppearance';
import { isMega } from '../data/megaPresentation';
import { regularInfectedModels } from '../data/crowdAppearance';
import { l4InfectedArchetypes, l4InfectedLooks, l4FirefighterLooks } from '../data/l4';
import { resolveCrowdAppearance, crowdAppearanceColor, crowdShirt, markCrowdAppearance, writeCrowdAppearance, renderedCrowdLook, crowdVertexLayout, crowdHeadwearVisibility } from './characters/CrowdAppearance';
import type { CrowdAccessories } from './characters/CrowdAccessories';
import { corpseLayout, corpsePose, corpsePoses } from './characters/CorpseLayout';
import { infectedContactDistance } from '../sim/ai/CharacterSeparation';
import { deinterleaveGeometry } from 'three/addons/utils/BufferGeometryUtils.js';
import { CrowdVisibility } from './CrowdVisibility';
import { crowdModelKey, isCrowdVariant, registerCrowdModel } from './crowdModels';
import { compactCrowdGeometry } from './characters/compactCrowdGeometry';
import { cloneCrowdGeometry } from './characters/cloneCrowdGeometry';
import { crowdLod, canHoldCrowdPose, crowdStandingLodHeight } from './lodPolicy';
import { StaticCorpses } from './characters/StaticCorpses';
import { repairDeathPoses, deathReach } from './characters/deathPose';
import { CrowdFootwork, CrowdLocomotion } from './characters/CrowdLocomotion';
import { AnimalMoves, animalSpecies } from './characters/AnimalMoves';
import { InfectedMoves, getUpSpan } from './characters/InfectedMoves';
import { GaitPhase } from './characters/GaitPhase';
import { CrowdFigureProbe } from './characters/CrowdFigureProbe';
import { contactShadowMaterial } from './ContactShadows';
import { qualityBudgets, type QualityTier } from '../core/Quality';
// Adapted from Bruno Simon InstancedGroup.js (MIT, 41046b5), using E17 GPU crowdMatrix/clipTexture.
import { BoxGeometry, BufferGeometry, PlaneGeometry, Color, DoubleSide, FrontSide, Group, InstancedInterleavedBuffer, InterleavedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshLambertNodeMaterial, MeshBasicNodeMaterial, Frustum, Sphere, Vector3, StreamDrawUsage } from 'three/webgpu';
import { varying, mix, attribute, mat4, normalGeometry, vec3, positionGeometry, vec4, float, uint, uniform, cameraViewMatrix, luminance, screenCoordinate, frontFacing, texture as sampleTexture, uv } from 'three/tsl';
import { packCrowdParts, poseTexture } from '../assets/crowd';
import type { Materials } from './Materials';
import { PaletteMaterial } from './PaletteMaterial';
import { AssetRegistry } from '../assets/registry';
import manifest from '../assets/manifest.json' with { type: 'json' };
import { civilianRoles } from '../data/npcs';
import { humanInfected, infectedDefinitions } from '../data/infected';
import type { EntitySnapshot } from '../sim/world/types';
import { isOutbreakDistrict } from '../levels/districts/types';
import type { SimWorld } from '../sim/world/SimWorld';
import type { View } from './View';
import { bakeInfected, bakeInfectedAsync, framesPerClip, infectedClips } from './characters/bakeInfected';
import { loadGate } from '../assets/loadGate';
import { authoredClips, strides } from './characters/clips';
import { CrowdPosePalette } from './characters/CrowdPosePalette';
import { MotionPresentation, crowdTurnRate } from './characters/MotionPresentation';
import { MotionPhase } from './characters/MotionPhase';
import { loadMeasure } from '../assets/loadTiming';
import { keepsLook } from '../sim/outbreak/appearance';
import { alphaLook, alphaLooks, alphaLookAssets } from '../data/alphaLooks';
import { cureEncounters, cureEncounterSlots } from '../levels/L10/encounters';
import { mergeCrowdVertices } from './characters/mergeCrowdVertices';
import { skinnedCrowdMatrix, skinnedWoundNormal } from './characters/skinnedCrowd';
import { loadSkinnedCrowdBake } from '../assets/civilianBake';
import type { Node as TslNode } from 'three/webgpu';
interface Batch { asset: string; animal: boolean; locomotion: CrowdLocomotion; probe: CrowdFigureProbe; poses: CrowdPosePalette; mesh: InstancedMesh; state: InterleavedBufferAttribute; tint: InterleavedBufferAttribute; shirt: Color; strideScale: number; windup: number; texture: import('three').DataTexture; count: number; lod: string; role: string }
type CrowdDef = { id: string; asset: string; windup: number; decay?: string };
type CrowdLod = 'lod0' | 'lod1' | 'lod2';
/** Simulation ticks a hit flash may last at most (Vfx pulses for 0.1 s = 6 ticks at 60 Hz). */
export const hitFlashTicks = 8;
/** L8 arena boss flash/flinch: 0.18 s of render time (Vfx), capped in sim ticks for the same paused-stepping reason. */
export const bossHitFlashTicks = 12;
/** Active infected at which far bodies drop to the flat LOD2 (draw budget). */
export const denseCrowdLod2 = 100;
/** r30-ghosts: in such a dense crowd (high tier) the nearest bodies big enough for LOD1 keep it. At 100+ active every body, also the ring
 * around the courier or the APC, used to fall to LOD2: flat, rim-lit, blue "ghosts" (r28-vqa L9/L10). 40 x ~1.7k triangles is within the budget. */
export const denseNearLod1 = 40;
/** One instanced, skinned GPU batch per archetype. Scene graph size never grows with infected population. */
/** E19 §5.4: the speed tier must read from the silhouette. Prefer the sim's tier,
 * else the brain's jittered run speed (frail 4.7, average 5.1, athletic 5.6 m/s). */
/** Upright human archetypes: their LOD band uses at least the standing height (crawlers stay low to the ground). */
const standingHumans = new Set(humanInfected.filter(def => def.id !== 'infected.crawler').map(def => def.id));
const megaCycleRate = 2.2;
function tierGait(b: { speed?: number; tier?: string; l1?: { tier: string } }): 'infected-frail' | 'infected-lurch' | 'infected-sprint' {
  const tier = b.l1?.tier ?? b.tier, speed = b.speed ?? 5;
  if (tier === 'frail' || tier === 'athletic' || tier === 'average') return tier === 'frail' ? 'infected-frail' : tier === 'athletic' ? 'infected-sprint' : 'infected-lurch';
  return speed >= 5.35 ? 'infected-sprint' : speed >= 4.4 && speed < 4.92 ? 'infected-frail' : 'infected-lurch';
}
type BakedBatch = ReturnType<typeof bakeInfected>;
type PreparedBatch = BakedBatch & { corpse: BufferGeometry | null; corpseClip?: BakedBatch['clip'] };
/** Finished crowd batch geometry per model/LOD/tier, reused across levels (CPU data only; every scene draws a clone).
 * Bounded like the bake cache; the eviction order is least recently used. */
const preparedBatches = new Map<string, PreparedBatch>();
const preparedBatchLimit = 48;
/** A clone with its own userData object: per-level LOD tags must not reach the cached copy. */
const cloneBatchGeometry = cloneCrowdGeometry;
export class CrowdView extends Group {
  private readonly registry: AssetRegistry;
  private readonly definitions = new Map<string, CrowdDef>();
  private readonly plannedLods = new Map<string, CrowdLod[]>();
  private streaming = false;
  private streamingReady?: Promise<void>;
  private streamRevision = -1;
  private streamX = Infinity;
  private streamZ = Infinity;
  private get staged(): boolean { return /^L(?:[1-9]|10)$/.test(this.world.scenario ?? '') && !!this.world.missions; }
  warmBatch?: (batch: import('three').Object3D) => Promise<void>;
  private readonly modelAliases = new Map<string, string>();
  private readonly pending = new Map<string, Promise<void>>();
  private readonly heroSlots = new Map<string, InstancedMesh>();
  private readonly visibility = new CrowdVisibility();
  private readonly heroIds = new Set<number>();
  private readonly previousHeroes = new Set<number>();
  private readonly nearest: { id: number; distance: number; role: string }[] = [];
  private readonly nearBodies: { id: number; distance: number }[] = [];
  private readonly nearIds = new Set<number>();
  private readonly heroBands = new Map<number, boolean>();
  private readonly rolePixels = new Map<string, number>();
  private readonly roleLods = new Map<string, 'lod1' | 'lod2'>();
  private readonly frustum = new Frustum();
  private readonly projection = new Matrix4();
  private readonly arenaScale = new Vector3(1.4, 1.4, 1.4);
  private readonly flinchScale = new Vector3();
  private readonly shadowMatrix = new Matrix4();
  private readonly bounds = new Sphere(new Vector3(), 1);
  private disposed = false;
  private readonly batches = new Map<string, Batch>();
  private readonly sharedSkinMaterials = new Map<string, { material: MeshLambertNodeMaterial; pose: ReturnType<typeof poseTexture>; atlas: ReturnType<typeof sampleTexture> }>();
  private readonly transform = new Matrix4();
  /** Displayed turn rate cap (rad/s): sim facing snaps become stepped turns. */
  private readonly presentation = new MotionPresentation(crowdTurnRate);
  private readonly motion = new MotionPhase();
  private readonly gait = new GaitPhase();
  /** Courier footwork for the infected inside the close pixel band (budgeted per frame; phones solve fewer). */
  private readonly footwork = new CrowdFootwork(40);
  private readonly footBands = new Map<number, 'lod1' | 'lod2'>();
  private readonly moves = new InfectedMoves();
  private readonly animalMoves = new AnimalMoves();
  /** Corpses persist until a level/checkpoint resets their sim IDs. */
  private get corpseTicks(): number { return Infinity; }
  private readonly staticCorpses = new StaticCorpses();
  private sharedDogCoats = false;
  private readonly dogCoatTints = [new Color(0, 0, 0), new Color(1, 0, 0)];
  private readonly corpseGeometry = new Map<string, BufferGeometry>();
  private readonly corpseClips = new Map<string, BakedBatch['clip']>();
  private entityRevision = -1;
  private frozenRevision = -1;
  private readonly figures: EntitySnapshot[] = [];
  private k9Vest?: K9Vest;
  private readonly shadows: InstancedMesh;
  private readonly feedback = new Map<number, { mask: number; strength: number; at: number }>();
  private readonly caps = new InstancedMesh(new BoxGeometry(.18, .06, .18), new MeshBasicNodeMaterial({ color: '#b3121f' }), 1750);
  private goreEnabled = true;
  private texturedCaps = 0;
  private cullDistance = 60;
  setQuality(tier: QualityTier): void { this.cullDistance = qualityBudgets[tier].cullDistance; this.low = tier === 'low'; this.footwork.cap = this.low ? 12 : 40; this.registry.setTextureTier(tier); }
  private readonly logs: { id: string; reason: string }[] = [];
  constructor(private readonly world: SimWorld, private low = false, private readonly shading?: Materials, private readonly accessories?: CrowdAccessories, private readonly sharedRegistry?: AssetRegistry) {
    super(); this.name = 'infected-crowd'; this.add(this.staticCorpses);
    // L4 figures carry world-space instance matrices. These identity roots
    // must not force every permanent corpse page's world matrix each frame.
    if (world.scenario === 'L4') { this.matrixAutoUpdate = this.matrixWorldAutoUpdate = false; this.staticCorpses.matrixAutoUpdate = this.staticCorpses.matrixWorldAutoUpdate = false; }
    this.caps.frustumCulled = false; this.caps.count = 0; this.add(this.caps);
    this.registry = sharedRegistry ?? new AssetRegistry((event) => this.logs.push(event), { materials: this.shading, textureSize: this.low ? 512 : 1024 });
    const shadow = new PlaneGeometry(1.2, 1.2); shadow.rotateX(-Math.PI / 2);
    this.shadows = new InstancedMesh(shadow, contactShadowMaterial(), 350); this.shadows.frustumCulled = false; this.shadows.count = 0; this.add(this.shadows);
  }
  async init(view?: View): Promise<void> {
    const started = performance.now();
    const nativeAssets = new Set(infectedDefinitions.map(d => d.asset));
    const variants = manifest.filter(a => isCrowdVariant(a, nativeAssets));
    const models = new Set([...this.world.entities.iterate()].flatMap(e => e.civilian?.schedule && !e.civilian.pet && e.civilian.model ? [e.civilian.model] : []));
    if (this.world.scenario === 'L4') for (const model of [...l4InfectedLooks, ...l4FirefighterLooks]) if (model.startsWith('npc.')) models.add(model);
    const animals = [...new Set([...this.world.entities.iterate()].flatMap(e => e.civilian?.zooAnimal ? [e.civilian.zooAnimal] : []))];
    const healthyDefinitions = animals.map(species => ({ ...infectedDefinitions.find(d => d.id === `infected.${species}`)!, id: `healthy.${species}`, asset: `amb.${species}` }));
    // Healthy amb.* assets are catalog props, so register their real rigs explicitly as animated crowds.
    const dogDefinitions = dogCoats.slice(1).map(coat => ({ ...infectedDefinitions.find(d => d.id === 'infected.dog')!, id: `inf.dog.${coat}`, decay: coat }));
    const allDefinitions = [...dogDefinitions, ...healthyDefinitions, ...[...models].map(model => ({ ...infectedDefinitions[0], id: model, asset: model })), ...infectedDefinitions, { ...infectedDefinitions[0], id: 'infected.patient-zero', asset: 'npc.patient-zero-courier' }, ...variants.map(a => ({ ...infectedDefinitions[0], id: a.id, asset: a.id }))].filter(def => manifest.find(asset => asset.id === def.asset)?.crowdSkin);
    // L1 v2: every infected is a pedestrian that keeps its look and is drawn by the civilian crowd (lane D); this view
    // only needs the plain runner fallback plus scripted infected actors. Without the outbreak layer keep the old set.
    const regularCrowd = this.world.scenario === 'L7' || this.world.scenario === 'L10' || this.world.scenario?.startsWith('perf-horde-');
    // L9's future chunk encounters contain runners and Alphas (l9Groups),
    // never the global zoo/finale cast. Keep every resident override too.
    const crossingCrowd = this.world.scenario === 'L9';
    const actors = Object.values(this.world.missions?.def.actors ?? {}).map(actor => actor.archetype);
    const l1Roles = new Set<string>(regularCrowd || crossingCrowd || this.world.scenario === 'L6' || this.world.npcs?.civilians.outbreak || this.world.districts?.districts.some(d => isOutbreakDistrict(d.id)) ? ['infected.runner', ...actors] : ['infected.runner', ...actors, ...civilianRoles.map(role => role.variant), ...models]);
    if (regularCrowd) for (const model of regularInfectedModels) l1Roles.add(model);
    // L4 sprinters always wear a shared soldier/civilian/suit skin.
    // Their unused default batch need not delay the level's loading card.
    if (this.world.scenario === 'L4') for (const model of [...l4InfectedArchetypes.filter(id => id !== 'infected.sprinter'), ...l4InfectedLooks, ...l4FirefighterLooks]) l1Roles.add(model);
    // Register the later shielded subway responder in the streamed cast plan.
    if (this.world.scenario === 'L5') l1Roles.add('infected.butcher');
    if (this.world.scenario === 'L6') for (const role of ['infected.riot', 'infected.armored']) l1Roles.add(role);
    // Ordinary and turned pedestrians keep their CivilianCrowd batches (keepsLook
    // below). Only explicit infected model overrides need this view's NPC assets.
    for (const species of animals) { l1Roles.add(`healthy.${species}`); l1Roles.add(`infected.${species}`); }
    for (const entity of this.world.entities.iterate()) {
      // A future pet turn or another seeded spawn may use any coat of the same dog rig.
      if (entity.archetype === 'infected.dog' || entity.civilian?.pet === 'dog') l1Roles.add('inf.dog');
      if (!entity.infected) continue;
      l1Roles.add(entity.archetype);
      const model = entity.infected.model ?? entity.infected.variant;
      if (model) l1Roles.add(model);
    }
    // Register future Alpha looks before their encounters become resident.
    const alphaLevel = ['L4', 'L5', 'L7', 'L8', 'L9', 'L10'].includes(this.world.scenario ?? '');
    if (this.world.scenario === 'L10') {
      // Include every future region/console encounter, not only the spawn chunk.
      for (const group of cureEncounters) for (const slot of cureEncounterSlots(group, this.low ? 'low' : 'high')) l1Roles.add(slot.archetype);
      for (const asset of alphaLooks['inf.mega-alpha']) l1Roles.add(asset);
      l1Roles.add('inf.dog');
    }
    if (this.world.scenario === 'L8') {
      // These story actors enter after Begin; register their actual models
      // behind the loading card along with the healthy sanctuary animals.
      l1Roles.add('infected.dog'); l1Roles.add('inf.dog-k9');
      l1Roles.add('inf.mega-alpha');
    }
    if (alphaLevel)
      for (const def of allDefinitions) if (alphaLooks['inf.alpha'].includes(def.asset)) l1Roles.add(def.id);
    const grove = this.world.scenario === 'L1' || this.world.scenario === 'L2' || this.world.scenario === 'L3' || this.world.scenario === 'L4' || this.world.scenario === 'L5' || this.world.scenario === 'L6';
    const definitions = grove || regularCrowd || crossingCrowd || this.world.scenario === 'L8' ? allDefinitions.filter(def => l1Roles.has(def.id) || l1Roles.has(def.asset)) : allDefinitions;
    for (const def of definitions) {
      // Registrations must not remove the asset spelling used by model overrides.
      const independent = def.id.startsWith('healthy.') || dogCoat(def.id);
      const key = independent ? def.id : registerCrowdModel(this.modelAliases, def);
      if (independent) this.modelAliases.set(def.id, key);
      this.definitions.set(key, def);
      if (!this.low) {
        const mesh = new InstancedMesh(new BufferGeometry(), this.shading?.shaded(vec3(1)) ?? new MeshBasicNodeMaterial(), 350);
        mesh.count = 0; mesh.visible = false; this.heroSlots.set(key, mesh); this.add(mesh);
      }
    }
    if (this.world.scenario === 'L8') {
      this.modelAliases.set('inf.dog-k9', this.modelAliases.get('infected.dog')!);
      this.k9Vest = new K9Vest(); this.add(this.k9Vest); await this.k9Vest.init(this.registry, this.shading);
    }
    // Both tiers need a clean near silhouette; Alpha bodies and corpses retain the authored model.
    const lods: ('lod0' | 'lod1' | 'lod2')[] = !this.low && grove ? ['lod0', 'lod1', 'lod2'] : ['lod1', 'lod2'];
    // Preserve the full prewarm plan for each model. Campaign startup requests
    // only the selected visible tiers; the rest follow after Begin.
    const residents = new Set<string>();
    for (const entity of this.world.entities.iterate()) {
      const role = entity.civilian?.zooAnimal ? `healthy.${entity.civilian.zooAnimal}` : entity.archetype;
      const variant = entity.appearance?.asset ?? entity.infected?.model ?? entity.infected?.variant;
      const key = variant && this.modelAliases.get(variant) || this.modelAliases.get(role);
      if (key) residents.add(key);
    }
    await Promise.all(definitions.flatMap(def => {
      const warmHero = !this.low && !grove && residents.has(this.modelAliases.get(def.id)!);
      // A zoo turn can put the infected body in the close band immediately.
      // Prepare both forms behind the loading card, including their LOD0 material.
      const zooHero = !this.low && this.world.scenario === 'L8' && /^(infected|healthy)\.(lion|gorilla|elephant|zebra|flamingo|monkey|lioness)$/.test(def.id);
      // perf-w6: Alpha bodies draw LOD0 (heroes, and their corpses on both tiers). In L4/L5/L7 the Alphas arrive during play
      // (the L4 waves); the first death baked that batch synchronously (~200 ms at low/4x CPU). Bake it while loading there too.
      const alpha = (alphaLooks['inf.alpha'].includes(def.asset) || alphaLooks['inf.mega-alpha'].includes(def.asset)) && (residents.has(this.modelAliases.get(def.id)!) || alphaLevel);
      const planned = [...new Set(warmHero || zooHero || alpha ? ['lod0' as const, ...lods] : lods)];
      const key = crowdModelKey(def); this.plannedLods.set(key, planned);
      return this.staged ? [] : planned.map(lod => this.requestBatch(def, lod));
    }));
    if (this.world.scenario === 'L8') {
      // The brief wall shot cannot wait for first-visibility streaming.
      await Promise.all([['inf.mega-alpha', 'lod0'], ['infected.dog', 'lod1']].map(([id, lod]) =>
        this.requestBatch(this.definitions.get(this.modelAliases.get(id)!)!, lod as CrowdLod)));
    }
    const dog = this.batches.get('inf.dog:lod1'), cream = this.batches.get('inf.dog.cream:lod1');
    if (dog && cream && !dog.mesh.geometry.hasAttribute('uv')) this.sharedDogCoats = shareDogCoatPalette(dog.mesh.geometry, cream.mesh.geometry, dog.poses.clip, cream.poses.clip);
    loadMeasure('view:infected-crowd', started);
    if (this.staged) {
      // A nearby actor can die before its living LOD changes. Keep its settled
      // body tier in the loading barrier, including the director's runner
      // fallback when the opening camera contains no infected yet.
      await Promise.all([...this.neededModels(view)].map(key => {
        const def = this.definitions.get(key)!;
        // L7 starts in a fight. All nearby living/death tiers belong to the
        // loading draw, rather than the first pickup/shot's background queue.
        const lods: CrowdLod[] = this.world.scenario === 'L7' ? this.plannedLods.get(key)! : [alphaLookAssets.includes(def.asset) ? 'lod0' : 'lod2'];
        return Promise.all(lods.map(lod => this.requestBatch(def, lod)));
      }));
    }
    this.update(view);
    if (this.staged) { await this.ready(); this.update(view); }
  }
  /** Same authored tiers, prepared after the first gameplay frames. Visible
   * arrivals can join these deduplicated requests ahead of the background queue. */
  startStreaming(): void {
    if (this.streaming || !this.staged) return;
    this.streaming = true;
    // update() already requests every tier as actors approach. Do not bake
    // the whole city's future Alpha wardrobe during L7's opening combat.
    if (this.world.scenario === 'L7') return;
    this.streamingReady = (async () => {
      for (const [key, lods] of this.plannedLods) {
        if (this.disposed) return;
        await Promise.all(lods.map(lod => this.requestBatch(this.definitions.get(key)!, lod)));
      }
    })().catch(error => { if (!this.disposed) console.error(error); });
  }
  private requestBatch(def: CrowdDef, lod: CrowdLod): Promise<void> {
    const key = `${crowdModelKey(def)}:${lod}`;
    if (this.batches.has(key)) return Promise.resolve();
    const previous = this.pending.get(key); if (previous) return previous;
    const pending = this.loadBatch(def, lod).finally(() => this.pending.delete(key));
    this.pending.set(key, pending); return pending;
  }
  private neededModels(view?: View, radius = 64): Set<string> {
    const needed = new Set<string>(), player = this.world.entities.get(1)?.transform;
    const fallback = this.modelAliases.get('infected.runner'); if (fallback) needed.add(fallback);
    this.visibility.begin(view?.camera, typeof innerHeight === 'number' ? innerHeight : 900, view?.lodCamera);
    for (const e of this.world.entities.iterate()) {
      if ((!e.infected && !e.civilian?.zooAnimal) || e.hidden || e.infected?.hidden || keepsLook(e) && e.appearance?.asset !== 'inf.common-worker') continue;
      const nearby = !player || Math.hypot(e.transform.x - player.x, e.transform.z - player.z) <= radius;
      if (!nearby && view && !this.visibility.visible(e.transform.x, e.transform.y + .2, e.transform.z, 3)) continue;
      const role = e.civilian?.zooAnimal ? `healthy.${e.civilian.zooAnimal}` : e.archetype;
      const variant = e.appearance?.asset ?? e.infected?.model ?? e.infected?.variant;
      const key = variant && this.modelAliases.get(variant) || this.modelAliases.get(role);
      if (!key) continue;
      needed.add(key);
      // alphaKey chooses the authored sibling by entity ID unless overridden.
      const look = alphaLook(key, e.id); if (this.definitions.has(look)) needed.add(look);
    }
    return needed;
  }
  private async loadBatch(def: { id: string; asset: string; windup: number; decay?: string }, lod: 'lod0' | 'lod1' | 'lod2'): Promise<void> {
      const key = crowdModelKey(def);
      const role = dogCoat(def.id) ? 'dog' : def.id.startsWith('infected.') ? def.id.slice(9) : 'runner', asset = def.asset;
      const cpuKey = `${def.id}|${asset}|${def.decay ?? ''}|${lod}|${this.low ? 'low' : 'high'}`;
      // The retained far surface of an ordinary body is LOD2. The zebra's LOD2 (647 triangles of thin leg and flank strips, hooves
      // cut loose) read as a pile of striped shards once frozen; its permanent corpse is the 1.7k-triangle LOD1 (r27-visp2).
      const corpseLod: CrowdLod = role === 'zebra' ? 'lod1' : 'lod2';
      // Keep the selected CPU data across the async model load. The zoo can
      // evict it from the bounded cache meanwhile; a second lookup then used
      // neither the cached body nor a delivery and rebaked every Alpha.
      const prepared = preparedBatches.get(cpuKey);
      const prebuilt = !prepared ? loadSkinnedCrowdBake(asset, lod) : undefined;
      const [loaded, delivered] = await Promise.all([
        this.registry.loadAsset(asset, lod, def.decay) as Promise<Group>,
        this.world.scenario === 'L4' ? prebuilt : undefined,
      ]);
      await loadGate.foreground();
      // Delivered skin batches are already baked. They need foreground admission,
      // but no extra render-frame wait for CPU baking at each new horde LOD.
      if (!delivered) await loadGate.wait();
      if (this.disposed) return;
      if (loaded.userData.placeholder) throw new Error(`${asset} is required for the skinned crowd`);
      const model = loaded;
      const atlas = model.userData.assetTextureMode === 'baseColor' ? crowdTexture(model) : undefined;
      const healthy = def.id.startsWith('healthy.'), human = !dogCoat(def.id) && !/^(infected|healthy)\.(dog|cat|crow|lion|gorilla|elephant|zebra|flamingo|monkey|lioness)$/.test(def.id);
      const alpha = alphaLookAssets.includes(asset), regularAlpha = alphaLooks['inf.alpha'].includes(asset) || alphaLooks['inf.mega-alpha'].includes(asset), capacity = role === 'crow' ? 800 : 350;
      // The retained Alpha corpse is LOD0. Establish its own atlas binding before
      // a far batch prepares pages from that source, regardless of arrival order.
      if (this.world.scenario === 'L10' && alpha && lod === 'lod2') { await this.requestBatch(def, 'lod0'); if (this.disposed) return; }
      if (corpseLod === 'lod1' && lod === 'lod2') { await this.requestBatch(def, 'lod1'); if (this.disposed) return; }
      // Level handover (10-20): the finished batch geometry (baked, merged, simplified, packed, appearance-marked) is
      // immutable CPU data that depends only on the model, LOD and tier. Reusing it across levels skips ~1 s of main-thread
      // work per level at 1x (bake + mergeVertices + marking), four times that on a throttled CPU; the scene gets clones.
      const textured = model.userData.assetTextureMode === 'baseColor';
      const infectedAtlas = textured && human && !healthy;
      // Texture ownership stays with this view's registry, never the CPU geometry cache.
      const preparedKey = cpuKey;
      let baked: BakedBatch, createdCorpse: BufferGeometry | null = null, corpseClip: BakedBatch['clip'] | undefined;
      if (prepared) {
        if (preparedBatches.get(preparedKey) === prepared) { preparedBatches.delete(preparedKey); preparedBatches.set(preparedKey, prepared); }
        // The bake adds every clip part the model lacks as an empty joint at the origin; the locomotion rig expects them.
        for (const name of prepared.clip.parts) if (!model.getObjectByName(name)) { const joint = model.clone(false); joint.name = name; joint.position.set(0, 0, 0); model.add(joint); }
        model.updateMatrixWorld(true);
        baked = { ...prepared, texture: atlas, geometry: cloneBatchGeometry(prepared.geometry), shirtColor: prepared.shirtColor?.clone() };
        if (prepared.corpse && !this.corpseGeometry.has(key)) this.corpseGeometry.set(key, cloneBatchGeometry(prepared.corpse));
        if (prepared.corpseClip && !this.corpseClips.has(key)) this.corpseClips.set(key, prepared.corpseClip);
      } else {
        // The finished geometry is cached below (preparedBatches), so the raw bake is not kept a second time.
        const args = [model, this.registry.definition(asset).animatedNodes, role === 'crawler', undefined, undefined, true, textured] as const;
        const bakeStarted = performance.now();
        const shipped = delivered ?? await prebuilt;
        baked = shipped ? { ...shipped, texture: atlas } : this.world.scenario === 'L8' ? await bakeInfectedAsync(() => loadGate.wait(), ...args) : bakeInfected(...args);
        for (const name of baked.clip.parts) if (!model.getObjectByName(name)) { const joint = model.clone(false); joint.name = name; joint.position.set(0, 0, 0); model.add(joint); }
        loadMeasure(`bake:${asset}:${lod}`, bakeStarted);
        if (this.disposed) { baked.geometry.dispose(); return; }
        // P1-117: Alphas fall onto their faces (live and frozen share the clip).
        repairDeathPoses(baked.clip, baked.geometry, { prone: alpha });
        if (this.world.scenario === 'L8') { await loadGate.wait(); if (this.disposed) { baked.geometry.dispose(); return; } }
      // Weld identical vertices before instanced attributes are attached, retaining
      // the authored indices through the bake: same triangles and vertex values.
      if (!shipped) { deinterleaveGeometry(baked.geometry);
      const indexed = mergeCrowdVertices(baked.geometry); baked.geometry.dispose(); baked.geometry = indexed; }
      if (this.world.scenario === 'L8') { await loadGate.wait(); if (this.disposed) { baked.geometry.dispose(); return; } }
      if (lod === corpseLod) {
        if (atlas && human) {
          // The authored textured tier already meets its budget. Keep its UV
          // surface for both live actors and frozen permanent bodies.
          const corpse = baked.geometry.clone(); packCrowdParts(corpse);
          corpse.userData.crowdLod = lod; corpse.userData.corpseSource = this.registry.definition(asset).lods?.lod2 ?? this.registry.definition(asset).glb;
          this.corpseGeometry.set(key, corpse); createdCorpse = corpse;
        } else {
        const intactSource = role === 'dog' || role === 'firefighter';
        if (intactSource || alpha) {
          // Dogs, industrial firefighters and Alphas retain their intact skinned LOD0.
          const cachedBody = await loadSkinnedCrowdBake(asset, 'lod0');
          const bodyModel = cachedBody ? undefined : await this.registry.loadAsset(asset, 'lod0', def.decay) as Group;
          if (this.disposed) { baked.geometry.dispose(); return; }
          // LOD0 and LOD2 can finish in either order. Both must retain the same
          // intact source, including when a distant victim settles before a hero draw.
          const existing = alpha ? this.corpseGeometry.get(key) : undefined;
          if (existing) { createdCorpse = existing; corpseClip = this.corpseClips.get(key); }
          else {
            const body = cachedBody ?? bakeInfected(bodyModel!, this.registry.definition(asset).animatedNodes, false, undefined, undefined, true, textured);
            repairDeathPoses(body.clip, body.geometry, { prone: alpha });
            if (!cachedBody) deinterleaveGeometry(body.geometry);
            const corpse = cachedBody ? body.geometry : mergeCrowdVertices(body.geometry); if (!cachedBody) body.geometry.dispose();
            if (this.disposed) { corpse.dispose(); baked.geometry.dispose(); return; }
            corpse.userData.crowdLod = lod;
            corpse.userData.corpseSource = this.registry.definition(asset).glb; corpseClip = body.clip; this.corpseClips.set(key, corpseClip);
            packCrowdParts(corpse); if (human) markCrowdAppearance(corpse);
            this.corpseGeometry.set(key, corpse); createdCorpse = corpse;
          }
        }
        if (this.disposed) { baked.geometry.dispose(); return; }
        if (!alpha && !intactSource) {
          const corpse = baked.geometry.clone();
          if (this.disposed) { corpse.dispose(); baked.geometry.dispose(); return; }
          packCrowdParts(corpse); if (human) markCrowdAppearance(corpse);
          this.corpseGeometry.set(key, corpse); createdCorpse = corpse;
        }
        }
      }
      if (alpha && lod === 'lod0') {
        if (!this.corpseGeometry.has(key)) {
          const corpse = baked.geometry.clone(); packCrowdParts(corpse);
          if (human) markCrowdAppearance(corpse);
          corpse.userData.corpseSource = this.registry.definition(asset).glb;
          this.corpseGeometry.set(key, corpse); this.corpseClips.set(key, baked.clip);
        }
        createdCorpse = this.corpseGeometry.get(key)!; corpseClip = this.corpseClips.get(key);
      }
      if (this.world.scenario === 'L8') { await loadGate.wait(); if (this.disposed) { baked.geometry.dispose(); return; } }
      packCrowdParts(baked.geometry); if (human) markCrowdAppearance(baked.geometry);
      compactCrowdGeometry(baked.geometry);
      if (createdCorpse) compactCrowdGeometry(createdCorpse);
      if (preparedKey) {
        preparedBatches.set(preparedKey, { ...baked, texture: undefined, geometry: cloneBatchGeometry(baked.geometry), shirtColor: baked.shirtColor?.clone(), corpse: createdCorpse ? cloneBatchGeometry(createdCorpse) : null, corpseClip });
        if (preparedBatches.size > preparedBatchLimit) { const oldest = preparedBatches.keys().next().value!; const old = preparedBatches.get(oldest)!; old.geometry.dispose(); old.corpse?.dispose(); preparedBatches.delete(oldest); }
      }
      }
      baked.geometry.userData.crowdLod = lod;
      const locomotion = new CrowdLocomotion(model, baked.clip, this.footwork);
      const probe = new CrowdFigureProbe(); probe.lod = lod; probe.sole = locomotion.sole; if (model.getObjectByName('legFL') || model.getObjectByName('root')?.userData.crowdQuadruped === true || alphaLooks['inf.mega-alpha'].includes(asset)) probe.animal(model);
      if (!baked.clip.binds || !baked.geometry.hasAttribute('_skin')) throw new Error(`${asset} is missing the v2 skinned crowd contract`);
      this.accessories?.registerSkull(asset, baked.geometry);
      const poses = new CrowdPosePalette(baked.clip, capacity), texture = poses.texture;
      const zooSurface = this.world.scenario === 'L8' && /^(infected|healthy)\.(lion|gorilla|elephant|zebra|flamingo|monkey|lioness)$/.test(def.id);
      const sharedPose = baked.texture ? zooSurface ? crowdTextureForDraw(poseTexture(texture), true) : poseTexture(texture) : undefined;
      const instanceData = new InstancedInterleavedBuffer(new Float32Array(capacity * 8), 8, 1).setUsage(StreamDrawUsage);
      const tint = new InterleavedBufferAttribute(instanceData, 4, 4);
      // Pack frame, detached leg, gore mask and flash into one slot: WebGL2 guarantees 16 attributes.
      const state = new InterleavedBufferAttribute(instanceData, 4, 0);
      baked.geometry.setAttribute('_state', state); baked.geometry.setAttribute('_variant', tint);
      const feedbackState = attribute('_state', 'vec4'), parts = attribute('_parts', 'vec4'), variant = attribute('_variant', 'vec4');
      const opacity = feedbackState.w.div(2).floor().div(255).oneMinus();
      const inlineAccessories = baked.geometry.userData.inlineAccessories === true;
      const figureMask = inlineAccessories ? parts.w.mod(128).lessThan(8).select(1, 0) : undefined;
      // Frozen sources keep their original untagged body/head pieces and shadow reception.
      const shadowReceiver = inlineAccessories ? parts.w.greaterThanEqual(128).select(figureMask!.oneMinus(), 1) : undefined;
      // Two identical LOD1 dog surfaces differ only in their authored vertex colors.
      // Keep a default attribute even in scenes that do not load the cream coat.
      const dogPalette = asset === 'inf.dog' && !def.decay && lod === 'lod1';
      if (dogPalette) baked.geometry.setAttribute('_dogCream', baked.geometry.getAttribute('color'));
      // Ordinary human LODs/looks share L4's existing graph path on every level.
      // Bind each draw's pose and atlas below; graph identity must include every
      // branch that changes the surface, including healthy animals and dog coats.
      // L10 Alpha looks/LODs use the same shader layout and bind their own atlas
      // per draw. A new hero look must not build this graph during the charge.
      // L8 keeps its existing intermediate-band sharing policy.
      const ordinarySurface = regularInfectedModels.some(model => model === asset);
      const sharedAlpha = (this.world.scenario === 'L8' || this.world.scenario === 'L10') && alpha;
      const sharedSurface = (this.world.scenario === 'L4' || ordinarySurface) && infectedAtlas || zooSurface || sharedAlpha && (this.world.scenario === 'L10' || lod === 'lod1');
      // Zoo joint names and atlas widths are data addressed through integer
      // texels. They do not change the skinning graph; each draw binds its rig.
      const rigKey = zooSurface ? 'zoo' : baked.clip.parts.join('|');
      const materialKey = sharedSurface && baked.texture ? `${rigKey}:${zooSurface ? 'per-draw' : poses.bindRow}:${baked.doubleSided}:${inlineAccessories}:${asset.startsWith('npc.')}:${baked.geometry.hasAttribute('_skin')}:${human}:${healthy}:${infectedAtlas}:${dogPalette}:${regularAlpha}` : undefined;
      let sharedSkin = materialKey ? this.sharedSkinMaterials.get(materialKey) : undefined;
      let material = sharedSkin?.material, surfaceAtlas = sharedSkin?.atlas;
      if (!material) {
      const paletteColor = textured ? parts.y.equal(-4).or(parts.y.equal(-5)).or(parts.y.lessThanEqual(-10)).select(crowdAppearanceColor(true), attribute('color', 'vec3')) : dogPalette ? variant.x.mod(2).greaterThan(.5).select(attribute('_dogCream', 'vec3'), attribute('color', 'vec3')) : human ? crowdAppearanceColor(true) : attribute('color', 'vec3');
      const atlasUV = attribute('uv', 'vec2');
      const sourceAtlas = atlas && !infectedAtlas ? zooSurface ? crowdTextureForDraw(sampleTexture(atlas, atlasUV)) : sampleTexture(atlas, atlasUV) : undefined;
      const sourceColor = sourceAtlas ? paletteColor.mul(mix(vec3(1), sourceAtlas.rgb, parts.y.equal(-4).or(parts.y.equal(-5)).or(parts.y.lessThanEqual(-10)).select(0, 1))) : paletteColor;
      // Keep the infected eye swatch out of the lit albedo. A bounded red
      // emitter avoids the pink centres from luminance-normalized swatches.
      // Read channels off the vec4 sample, never off its .rgb view: Tint (Dawn/Metal) fails to
      // lower a chained swizzle (`sample.xyz.x`) and the whole pipeline is dropped (hotfix-16).
      const texelSample = infectedAtlas && baked.texture ? sampleTexture(baked.texture, uv()) : undefined;
      surfaceAtlas = texelSample ?? sourceAtlas;
      const region = texelSample ? crowdRegionOf(texelSample, uv()) : undefined;
      const texel = texelSample ? crowdRegionTint(texelSample.rgb, region!, true) : undefined;
      const capSurface = parts.w.greaterThanEqual(1024);
      const painted = texel ? mix(sourceColor, texel.pow(.85).mul(mix(vec3(1), sourceColor, .08)), parts.y.equal(-4).or(parts.y.equal(-5)).or(parts.y.lessThanEqual(-10)).select(0, parts.w.mod(128).lessThan(8).select(1, 0))) : sourceColor;
      const sick = vec3(luminance(painted)).mul(vec3(.62, .75, .51));
      const surface = asset.startsWith('npc.') ? mix(painted, sick, texelSample ? parts.y.equal(-11).select(1, crowdRegionSkin(region!, () => paintedSkinMask(texelSample))).mul(.85) : parts.y.equal(-1).select(.85, 0)) : painted;
      // The approved atlas has bright orange/red eye paint. Restrict the mask to the head,
      // so the red tie and blood never emit. White teeth and pale skin fail the saturation gate.
      const albedo = capSurface.select(vec3(.4508, .006, .0137), surface);
      const eyeDisc = parts.z.greaterThan(1.5);
      const eyeRadius = uv().sub(.5).mul(2).length();
      const eye = texelSample ? eyeDisc.or(texelSample.r.greaterThan(.5).and(texelSample.g.lessThan(texelSample.r.mul(.65))).and(texelSample.b.lessThan(.2)).and(parts.z.greaterThan(.5))).select(1, 0) : healthy ? parts.z.min(1).mul(feedbackState.z) : parts.z.min(1);
      // The baked colours retain their blue-grey/white identity under the game's
      // cool key: trade some directional light for a small neutral cloth bounce.
      const base = healthy ? mix(albedo, vec3(.26, .3, .22), feedbackState.z.mul(.4)) : mix(infectedAtlas ? albedo.mul(.65) : albedo, vec3(0), eye);
      const emission = healthy ? attribute('color', 'vec3').div(luminance(attribute('color', 'vec3')).max(.25)).mul(1.2) : infectedAtlas ? vec3(1, .04373, .02843).mul(eyeDisc.select(eyeRadius.smoothstep(1, .15).mul(3).add(3), 3)) : vec3(3, .25, .22);
      // alpha-white: the hit flash brightens the figure's own colours (glow ~ albedo x strength, about x2 on a
      // night-lit body at the 0.45 peak), easing off on pale swatches (bone, teeth) so they do not clip to white.
      // A flat white add (0.45 on every channel, then bloom) turned the dark Alpha into a grey-white mass; any
      // white constant still dominates its near-black albedo.
      // Alphas have authored bruised skin and dark outfits. The ordinary crowd's
      // additive atlas/figure fills washed those swatches pale lavender at night.
      const atlasFill = infectedAtlas ? albedo.mul(regularAlpha ? .04 : .18).mul(eye.oneMinus()) : vec3(0);
      // Flash 0..1 is the ordinary hit pulse; 1..2 marks an L8 arena boss hit (r26-l8hitreact): a plain additive warm-white lift, since the
      // base*(1-base) pulse above is nearly invisible on dark animal coats.
      const flashValue = feedbackState.w.mod(2), bossFlash = flashValue.sub(1).max(0);
      const glow = emission.mul(eye).add(atlasFill).add(flashValue.lessThan(1).select(flashValue, 0).mul(base.mul(base.oneMinus().mul(1.1))).add(vec3(.6, .54, .48).mul(bossFlash)).mul(figureMask ?? 1));
      material = this.shading?.shaded(base, glow, undefined, undefined, undefined, healthy ? undefined : eye, figureMask, shadowReceiver, healthy ? undefined : float(1)) ?? Object.assign(new MeshLambertNodeMaterial({ vertexColors: false }), { colorNode: base, emissiveNode: glow });
      // E25 night readability: crowd silhouettes take the preset's moonlit rim.
      livingStencil(material);
      if (material instanceof PaletteMaterial) { material.figureRim.value = .25; material.figureFill.value = regularAlpha ? .25 : 1; }
      // The Alpha-sized Mega retains its silhouette at contact, like a regular Alpha.
      // Instances cannot be sorted independently in the transparent render list.
      // A shared 4x4 screen-door threshold keeps every surface of a corpse at
      // a pixel together, unlike a 3D hash that exposes its deeper body parts.
      // Living actors keep every pixel; discarded pixels never write depth.
      const pixel = screenCoordinate.xy.floor();
      const bayer2 = (p: typeof pixel) => p.x.mod(2).mul(2).add(p.y.mod(2).mul(3)).mod(4);
      const threshold = bayer2(pixel).mul(4).add(bayer2(pixel.div(2).floor())).add(.5).div(16);
      const livingMask = inlineAccessories ? opacity.greaterThan(threshold).and(frontFacing.or(parts.w.mod(128).lessThan(8))) : opacity.greaterThan(threshold);
      material.maskNode = livingMask;
      if (baked.texture) {
        const discMask = eyeDisc.not().or(eyeRadius.lessThanEqual(1).and(healthy ? feedbackState.z.greaterThan(.01) : float(1).greaterThan(0)));
        material.userData.frozenSurfaceMask = discMask;
        material.maskNode = livingMask.and(discMask);
      }
      material.depthTest = material.depthWrite = true;
      material.side = baked.doubleSided ? DoubleSide : FrontSide;
      const outgoing = variant.w.div(2).floor(), weight = variant.w.mod(2);
      // Bind rows depend on clip length/capacity, not shader structure. Zoo
      // draws select their own row through the same object update as textures.
      const bindRow = zooSurface ? uniform(poses.bindRow).onObjectUpdate(({ object }) => crowdSurfaceBindings.get((object as Mesh).geometry)?.bindRow ?? poses.bindRow) : poses.bindRow;
      const matrix: TslNode<'mat4'> = skinnedCrowdMatrix(sharedPose ?? texture, parts.x, feedbackState.x, outgoing, weight, bindRow);
      const column = (offset: number) => attribute(`_crowd${offset / 4}`, 'vec4');
      const instance = mat4(column(0), column(4), column(8), column(12));
      material.positionNode = instance.mul(matrix.mul(vec4(positionGeometry, 1))).xyz;
      {
        const cut = uint(feedbackState.z).bitOr(uint(feedbackState.y.greaterThan(.5).select(4, 0)));
        const triangle = varying(uint(attribute('_skin', 'vec4').w.floor()), 'crowdTriangleCut');
        const capIndex = parts.w.round().sub(1024);
        const capBit = uint(capIndex.equal(0).select(16, capIndex.equal(1).select(1, capIndex.equal(2).select(2, capIndex.equal(5).select(4, capIndex.equal(6).select(8, 0))))));
        const retained = capSurface.select(capBit.bitAnd(cut).notEqual(0), triangle.bitAnd(cut).equal(0));
        material.maskNode = (material.maskNode as TslNode<'bool'>).and(retained).and(crowdHeadwearVisibility().greaterThan(.5));
      }
      // Skinned bodies: the joint ids and weights vary inside a seam triangle. Evaluate the normal per vertex (a fragment-stage
      // normalNode would interpolate packed joint ids into unrelated or out-of-range atlas rows: NaN normals, black bloom blocks).
      const normal = instance.mul(matrix.mul(vec4(normalGeometry, 0))).xyz.transformDirection(cameraViewMatrix);
      material.normalNode = skinnedWoundNormal(varying(normal, 'skinnedCrowdNormal'));
      if (materialKey && sharedPose && surfaceAtlas) {
        sharedSkin = { material, pose: sharedPose, atlas: surfaceAtlas }; this.sharedSkinMaterials.set(materialKey, sharedSkin);
      }
      }
      const slot = lod === 'lod0' ? this.heroSlots.get(key) : undefined;
      interleaveTexturedCrowd(baked.geometry);
      const mesh = slot ?? new InstancedMesh(baked.geometry, material, capacity); mesh.userData.preRenderTextures = [texture, ...(baked.texture ? [baked.texture] : [])];
      // Material.copy serializes enumerable metadata; compressed textures are live GPU resources.
      Object.defineProperty(material.userData, 'preRenderTextures', { value: baked.texture ? [baked.texture] : [], writable: true, configurable: true, enumerable: false });
      if (baked.texture) {
        const image = baked.texture.image as { width: number; height: number };
        let w = image.width, h = image.height, bytes = 0;
        while (true) { bytes += w * h * 4; if (w === 1 && h === 1) break; w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); }
        mesh.userData.crowdAtlas = { id: baked.texture.uuid, width: image.width, height: image.height, decodedBytesWithMips: bytes };
      }
      mesh.instanceMatrix.setUsage(StreamDrawUsage);
      if (slot) { mesh.geometry.dispose(); (mesh.material as MeshLambertNodeMaterial).dispose(); mesh.geometry = baked.geometry; mesh.material = material; this.heroSlots.delete(key); } mesh.userData.preRenderSolo = true; mesh.receiveShadow = inlineAccessories; mesh.name = key; mesh.frustumCulled = false; mesh.count = 0;
      // E17's explicit instance * part transform order.
      const matrices = new InstancedInterleavedBuffer(mesh.instanceMatrix.array, 16, 1).setUsage(StreamDrawUsage);
      let bindSurface = () => { if (sharedPose) sharedPose.value = texture; };
      mesh.onBeforeRender = () => { bindSurface(); matrices.version = mesh.instanceMatrix.version; matrices.clearUpdateRanges(); matrices.addUpdateRange(0, mesh.count * 16); };
      // Bind the current batch's matrices per draw, as CivilianCrowd does. Captured
      // buffer nodes can keep a retired LOD's GPU buffer in a shared shader state.
      for (let i = 0; i < 4; i++) baked.geometry.setAttribute(`_crowd${i}`, new InterleavedBufferAttribute(matrices, 4, i * 4));
      if (sharedSkin && baked.texture) {
        // Each living or frozen draw binds its own pose and colour atlas.
        const binding = sharedSkin, atlas = baked.texture;
        bindSurface = () => { binding.pose.value = texture; binding.atlas.value = atlas; };
        const surface = { bind: bindSurface, textures: [atlas], pose: texture, bindRow: poses.bindRow };
        crowdSurfaceBindings.set(mesh.geometry, surface);
        const body = this.corpseGeometry.get(key);
        if (body && (!sharedAlpha || this.world.scenario === 'L10' && lod === 'lod0') && (lod === corpseLod || human || alpha || role === 'dog' || role === 'firefighter')) crowdSurfaceBindings.set(body, surface);
        // r27-visp2: a frozen zoo-animal corpse keeps the surface of its source LOD (own UV layout and atlas). Every other LOD's
        // batch used to rebind the corpse to its own atlas as it loaded (L8: the first zebra seen up close), so settled zebras sampled
        // stripes from the wrong atlas and read as a pile of scrambled triangles. Only the source LOD's batch binds it.
      }
      Object.defineProperty(mesh, 'isInstancedMesh', { value: false, writable: true });
      mesh.userData.staticInstanceAttributes = true;
      mesh.userData.staticInstancePosition = material.positionNode;
      mesh.onAfterRender = () => probe.draw();
      this.batches.set(`${key}:${lod}`, { animal: !!model.getObjectByName('legFL'), locomotion, probe, poses, lod, role: key, mesh, state, tint, shirt: baked.shirtColor ?? new Color(1, 1, 1), strideScale: baked.strideScale, windup: def.windup, asset, texture, count: 0 });
      // L10 can demand encounter models before its background stream starts.
      // The owner skips these calls until the initial scene is prepared.
      if (this.streaming || this.world.scenario === 'L10') await this.warmBatch?.(mesh);
      if (this.disposed) return;
      this.add(mesh);
      const corpsePages = new Set<InstancedMesh>();
      // Ordinary deaths use the retained far surface; Alphas keep the authored body. Warm in
      // every combat scene so the first settled blast victims cannot link it
      // synchronously during play. Waiting for this batch also guarantees the
      // intact corpse geometry exists before the loading draw.
      if (lod === 'lod2' || alpha && lod === 'lod0') {
        // vqa-fix-3 (Q-124): the Mega falls face down like the Alpha. Its side fall read as a red lump at the game camera; prone,
        // the splayed legs, arms and spine ridge read as a fallen giant.
        const deaths: (typeof infectedClips[number])[] = alpha ? ['death-back'] : role === 'crawler' ? ['death-side'] : [...corpsePoses];
        const source = this.corpseGeometry.get(key) ?? mesh.geometry.userData.inlineBody ?? mesh.geometry, corpseClip = this.corpseClips.get(key) ?? baked.clip;
        for (const death of deaths) {
          const frame = infectedClips.indexOf(death) * framesPerClip + framesPerClip - 1;
          corpsePages.add(this.staticCorpses.prepare(`${key}:${death}:0`, source, material, corpseClip, frame));
        }
      }
      if (lod === 'lod1' && (regularInfectedModels.some(id => id === asset) || this.world.scenario === 'L4' && human && !alpha)) for (const death of corpsePoses) {
        const frame = infectedClips.indexOf(death) * framesPerClip + framesPerClip - 1;
        corpsePages.add(this.staticCorpses.prepare(`${key}:${death}:0:near`, mesh.geometry, material, baked.clip, frame, true));
      }
      // A streamed actor's static corpse pages are siblings of its living batch.
      // Warm them after preparation; warming only `mesh` leaves the first settled
      // body to compile its corpse_* palette graph during gameplay.
      // r22-perfqual: L8's first dead animal/Alpha linked its corpse_* graph mid-fight (a 130-230 ms frame at the first kill).
      if (this.world.scenario === 'L10' || this.world.scenario === 'L7' || this.world.scenario === 'L8') {
        for (const page of corpsePages) {
          if (this.disposed) return;
          await this.warmBatch?.(page);
        }
      }
  }
  private modelKey(id: string): string | undefined {
    const key = this.modelAliases.get(id);
    return key && this.definitions.has(key) ? key : undefined;
  }
  /** PO #23: an Alpha drawn with its default model takes one of the sibling looks, chosen by entity id (same rig and size). An explicit model override keeps its asset. */
  private alphaKey(key: string, e: { id: number; infected?: { model?: string; variant?: string } }): string {
    // Naming the shipped asset on purpose (Scene Lab `look.model`, probes) keeps that exact look; the role default and the sim's Mega vary.
    if (e.infected?.model || e.infected?.variant === 'inf.alpha') return key;
    const look = alphaLook(key, e.id);
    return look !== key && this.modelKey(look) === look ? look : key;
  }
  async ready(): Promise<void> {
    // The background plan admits models sequentially. Waiting only for pending
    // requests misses later models that the same queue has already scheduled.
    await this.streamingReady;
    await Promise.all(this.pending.values());
  }
  update(view?: View, alpha = 1): void {
    const streamFocus = view?.cameraTarget ?? this.world.entities.get(1)?.transform;
    if (this.staged && this.streaming && (this.streamRevision !== this.world.entities.revision || streamFocus && Math.hypot(streamFocus.x - this.streamX, streamFocus.z - this.streamZ) >= 4)) {
      this.streamRevision = this.world.entities.revision;
      if (streamFocus) { this.streamX = streamFocus.x; this.streamZ = streamFocus.z; }
      for (const key of this.neededModels(view)) {
        const def = this.definitions.get(key);
        if (def) for (const lod of this.plannedLods.get(key) ?? []) void this.requestBatch(def, lod);
      }
    }
    this.deadFeet.clear(); this.staticCorpses.begin(id => this.world.entities.get(id), e => this.corpsePosition(e, e.infected!.deadAt));
    // Membership changes cover pooled ID reuse, checkpoint restore and streamed unload.
    // Frozen figures stay in StaticCorpses; the animated passes need only the rest.
    if (this.entityRevision !== this.world.entities.revision || this.frozenRevision !== this.staticCorpses.revision) {
      this.figures.length = 0;
      for (const e of this.world.entities.iterate()) if (!e.corpse || !this.staticCorpses.has(e.id)) this.figures.push(e);
      this.entityRevision = this.world.entities.revision; this.frozenRevision = this.staticCorpses.revision;
    }
    for (const batch of this.batches.values()) { batch.count = 0; batch.probe.begin(); }
    this.footwork.begin(Math.max(0, this.world.tick + alpha - 1) / 60);
    this.shadows.count = 0; this.caps.count = 0; this.texturedCaps = 0;
    this.k9Vest?.begin(this.world);
    for (const [id, feedback] of this.feedback) { const e = this.world.entities.get(id); if (!e?.combat || e.hidden || e.infected?.hidden) this.feedback.delete(id); else if (e.health.current > 0) feedback.mask = 0; }
    const player = this.world.entities.get(1)!;
    const focus = view?.cameraTarget ?? player.transform;
    if (view) this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse));
    this.visibility.begin(view?.camera, typeof innerHeight === 'number' ? innerHeight : 900, view?.lodCamera);
    const heroes = this.heroIds; this.previousHeroes.clear();
    for (const id of heroes) this.previousHeroes.add(id);
    heroes.clear(); this.nearest.length = 0; this.rolePixels.clear(); this.nearBodies.length = 0; this.nearIds.clear();
    const dense = !this.low && (this.world.infected?.active.length ?? 0) >= denseCrowdLod2;
    for (const e of this.figures) {
      if (e.faction !== 'infected' && !e.civilian?.zooAnimal || !e.combat || e.hidden || e.infected?.hidden || e.archetype === 'infected.crow' || e.corpse || keepsLook(e) && e.appearance?.asset !== 'inf.common-worker') continue;
      if (e.health.current <= 0 && this.world.tick - (e.infected?.deadAt ?? 0) >= this.corpseTicks) continue;
      const distance = Math.hypot(e.transform.x - focus.x, e.transform.z - focus.z);
      if (distance > this.cullDistance) continue;
      const variant = e.appearance?.asset ?? e.infected?.model ?? e.infected?.variant;
      const role = this.modelKey(e.civilian?.zooAnimal ? `healthy.${e.civilian.zooAnimal}` : e.archetype) ?? this.modelKey('infected.runner')!;
      const key = this.alphaKey((variant && this.modelKey(variant)) || role, e);
      const d = this.registry.definition(this.definitions.get(key)!.asset).dimensions;
      if (!this.visibility.visible(e.transform.x, e.transform.y - .7 + d.y / 2, e.transform.z, Math.hypot(d.x, d.y, d.z) / 2 + .75)) continue;
      const standing = standingHumans.has(e.archetype) && !e.infected?.legLost;
      const pixels = this.visibility.pixels(e.transform.x, e.transform.y, e.transform.z, standing ? Math.max(d.y, crowdStandingLodHeight) : d.y);
      this.rolePixels.set(key, Math.max(this.rolePixels.get(key) ?? 0, pixels));
      if ((this.low || dense) && crowdLod(pixels, this.footBands.get(e.id)) === 'lod1') this.nearBodies.push({ id: e.id, distance });
      if (this.low && !/infected\.(alpha|mega-alpha)/.test(e.archetype)) continue;
      if (distance > (this.previousHeroes.has(e.id) ? 13 : 12)) continue;
      const hero = !view || pixels > (this.heroBands.get(e.id) ? 164 : 196);
      this.heroBands.set(e.id, hero); if (!hero) continue;
      // Hold an existing hero until a replacement is clearly closer.
      const score = distance - (this.previousHeroes.has(e.id) ? .75 : 0);
      let at = 0; while (at < this.nearest.length && this.nearest[at].distance <= score) at++;
      if (at < 8) { this.nearest.splice(at, 0, { id: e.id, distance: score, role: key }); if (this.nearest.length > 8) this.nearest.pop(); }
    }
    // Bound phone geometry while retaining near detail for the closest sixteen bodies.
    this.nearBodies.sort((a, b) => a.distance - b.distance || a.id - b.id);
    for (const body of this.nearBodies.slice(0, this.low ? 16 : denseNearLod1)) this.nearIds.add(body.id);
    // One background tier per role protects the largest visible silhouette and
    // avoids a third active draw for every archetype in a mixed horde.
    for (const [role, pixels] of this.rolePixels) this.roleLods.set(role, crowdLod(pixels, this.roleLods.get(role)));
    // Variant batches consume the same E07 draw budget as archetypes. Keep the four fixed effects in reserve;
    // dense mixed hordes use LOD1 instead of adding an extra LOD0 draw for every near model.
    const heroRoles = new Set<string>(), heroDrawBudget = Math.max(0, 30 - 4 - this.rolePixels.size);
    for (const e of this.nearest) if (heroRoles.has(e.role) || heroRoles.size < heroDrawBudget) { heroes.add(e.id); heroRoles.add(e.role); }
    // Dense mixed crowds trade a few dog triangles for one fewer draw, retaining
    // both authored coats and the exact higher-detail LOD1 surfaces/poses.
    const shareDogs = this.sharedDogCoats && heroDrawBudget === 0 && this.rolePixels.has('inf.dog') && this.rolePixels.has('inf.dog.cream');
    for (const e of this.figures) {
      if (e.id === 1 || e.faction !== 'infected' && !e.civilian?.zooAnimal || !e.combat) continue;
      if (e.corpse && this.staticCorpses.has(e.id)) continue;
      const distance = Math.hypot(e.transform.x - focus.x, e.transform.z - focus.z);
      if (e.hidden || e.infected?.hidden || !view && distance > this.cullDistance && !e.corpse || e.infected?.state === 'dead' && this.world.tick - e.infected.deadAt > this.corpseTicks) continue;
      // L1 v2: a pedestrian who turned keeps its own body and clothes (NpcView's civilian crowd); only the contact shadow is drawn here.
      if (keepsLook(e) && e.appearance?.asset !== 'inf.common-worker') { if (!e.corpse && this.shadows.count < 350) { this.transform.makeTranslation(e.transform.x, (this.world.districts?.groundHeight(e.transform.x, e.transform.z) ?? 0) + .018, e.transform.z); this.shadows.setMatrixAt(this.shadows.count++, this.transform); } continue; }
      const availableLod = 'lod1';
      const role = this.modelKey(e.civilian?.zooAnimal ? `healthy.${e.civilian.zooAnimal}` : e.archetype) ?? this.modelKey('infected.runner')!;
      const variant = e.appearance?.asset ?? e.infected?.model ?? e.infected?.variant;
      const key = this.alphaKey((variant && this.modelKey(variant)) || role, e);
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
      let lod: 'lod0' | 'lod1' | 'lod2' = this.low ? this.nearIds.has(e.id) ? 'lod1' : 'lod2' : e.health.current <= 0 ? 'lod2' : (this.world.infected?.active.length ?? 0) >= denseCrowdLod2 ? this.nearIds.has(e.id) ? 'lod1' : 'lod2' : this.roleLods.get(key) ?? 'lod2';
      // Recoverable downed bodies are still animated, rather than frozen pages.
      // Keep their close surface as detailed as the living figure beside them.
      if (this.world.scenario === 'L4' && e.health.current <= 0 && !e.corpse
        && crowdLod(this.visibility.pixels(e.transform.x, e.transform.y, e.transform.z, Math.max(dimensions.y, crowdStandingLodHeight)), this.footBands.get(e.id)) === 'lod1') lod = 'lod1';
      if (heroes.has(e.id) || e.corpse && alphaLookAssets.includes(def.asset)) lod = 'lod0';
      if (!this.batches.has(`${key}:${lod}`)) void this.requestBatch(def, lod);
      // Quality changes/streaming may not have the requested tier yet. Keep the loaded figure.
      let batch = this.batches.get(`${key}:${lod}`) ?? this.batches.get(`${key}:${availableLod}`) ?? this.batches.get(`${key}:lod2`) ?? this.batches.get(`${key}:lod1`);
      if (shareDogs && !e.corpse && lod !== 'lod0' && (!this.low || lod === 'lod1') && (key === 'inf.dog' || key === 'inf.dog.cream')) batch = this.batches.get('inf.dog:lod1');
      if (!batch) continue;
      const b = e.infected ?? { state: e.health.current <= 0 || e.civilian?.state === 'finished' ? 'dead' : e.combat.attacking ? 'attack' : 'idle', until: 0, deadAt: e.civilian?.entered ?? 0, legLost: false, special: '', detached: false, variant: '', birdAlive: [], birdPositions: [], dx: 0, dz: 0 };
      const specialAttack = e.infected?.specialAttack;
      const physical = specialAttack && (e.infected?.arenaBoss || e.infected?.pursuit && specialAttack.move === 'alpha.grab-throw' || ['alpha.charge', 'alpha.ground-slam', 'alpha.pounce', 'alpha.grab-human', 'alpha.shield-bash', 'lion.pounce', 'lion.flank', 'gorilla.pound', 'gorilla.roar', 'elephant.charge', 'elephant.swipe', 'zebra.stampede'].includes(specialAttack.move)) ? specialAttack : undefined;
      const feedback = this.feedback.get(e.id);
      const renderTick = Math.max(0, this.world.tick + alpha - 1);
      const tick = distance > 35 ? Math.floor(this.world.tick / 2) * 2 : this.world.tick;
      const motion = e.motion ?? this.motion.sample(e.id, tick, e.transform.x, e.transform.z), gaitDistance = Math.max(0, motion.distance - motion.speed * (1 - alpha) / 60), reaction = e.combat.reaction;
      const age = reaction ? (this.world.tick - reaction.started) / 60 : Infinity;
      const death = e.archetype === 'infected.alpha' || e.archetype === 'infected.mega-alpha'
        ? 'death-back'
        : e.archetype === 'infected.crawler' ? 'death-side' : corpsePose(e.id);
      // Q-292 sweep: a moving crawler (or legless body) crawls too; the upright shamble on a prone body slid 30 cm per step.
      const mega = isMega(e) || alphaLooks['inf.mega-alpha'].includes(def.asset);
      const movingClip = motion.speed > 2
        ? mega ? 'infected-sprint' : tierGait(b as { speed?: number; tier?: string; l1?: { tier: string } })
        : motion.speed > .06 ? mega ? 'infected-lurch' : 'shamble' : null;
      let clip: typeof infectedClips[number] = b.state === 'dead' ? death
        : b.legLost || e.archetype === 'infected.crawler' ? 'crawl'
          : b.state === 'attack' && motion.speed <= .06 ? this.world.tick < b.until ? 'windup' : 'swing'
            : movingClip ?? ((b.state as string) === 'search' || (b.state as string) === 'attracted' ? 'infected-search' : 'infected-idle');
      // Heavy reactions (deaths, finishers, kicks, blasts) knock down and get up, also while knocked back; light hits only flinch (InfectedMoves).
      const heavy = !!reaction?.heavy && tick < reaction.until && b.state !== 'dead';
      if (heavy) clip = age < .48 ? reaction!.index % 2 ? 'knockdown' : 'flung' : age < .7 ? 'knockdown' : 'get-up';
      if (physical?.stage === 'telegraph') clip = 'windup';
      else if ((physical?.move === 'alpha.ground-slam' || physical?.move === 'gorilla.pound') && physical.stage === 'recovery') clip = 'swing';
      else if (physical?.move === 'elephant.swipe' && physical.stage === 'recovery') clip = 'swing';
      if (e.civilian?.zooAnimal) clip = e.civilian.state === 'finished' ? death : e.infection ? 'idle' : e.civilian.zooAnimal === 'monkey' && motion.speed > 1.3 ? 'run' : motion.speed > .06 ? 'walk' : 'idle';
      const primateStory = e.civilian?.zooAnimal === 'monkey' && !e.infection && e.health.current > 0 ? e.civilian.story : null;
      if (primateStory?.clip === 'swing' || primateStory?.clip === 'windup') clip = primateStory.clip;
      if (e.infectionRise) clip = 'infection-rise';
      if (b.special === 'dive') clip = 'run';
      // E32 dog: authored gallop while it runs, authored gather / spring / snap during the pounce (telegraph = the gather).
      const dogPounce = e.archetype === 'infected.dog' && b.state === 'attack' && !heavy && !e.infectionRise;
      if (e.archetype === 'infected.dog' && b.state !== 'dead' && !heavy && !e.infectionRise) { if (dogPounce) clip = 'dog-lunge-bite'; else if (motion.speed > 3) clip = 'dog-gallop'; }
      if (e.infected?.specialAttack?.stage === 'telegraph') clip = 'windup';
      if (specialAttack?.move === 'zebra.kick') clip = 'zebra-rear-kick';
      if (specialAttack?.move === 'zebra.stampede' && specialAttack.stage === 'active') clip = 'zebra-stampede';
      if (specialAttack?.move === 'flamingo.dive' && specialAttack.stage === 'active') clip = 'run';
      // r32-animalmoves: species poses (lift/flight phase) are sampled once per figure and drive a few clip choices.
      const species = e.infected && !e.corpse ? animalSpecies(e) : undefined;
      const animalPose = species ? this.animalMoves.sample(e, renderTick, motion.speed, this.gait.sample(e.id, gaitDistance, motion.speed > 5 ? 'corgi-gallop' : 'corgi-trot', batch.strideScale, motion.speed)) : undefined;
      const animalLift = species ? Math.max(0, this.animalMoves.lift - Math.max(0, e.transform.y - .7 - (this.world.districts?.pavingHeight(e.transform.x, e.transform.z) ?? 0))) : 0, flightPhase = species ? this.animalMoves.flightPhase : -1;
      if (species === 'flamingo' && animalPose?.airborne && b.state !== 'dead') clip = 'run';
      if (species === 'lion' && !specialAttack && !heavy && b.state !== 'dead' && !(e.infected!.grabUntil > renderTick) && motion.speed > 5) clip = 'dog-gallop';
      if (species === 'zebra' && !heavy && b.state !== 'dead') {
        // Herd gallop (authored stampede loop) at speed and for the stampede's 1 s dust telegraph (pawing, weight back).
        if (specialAttack?.move === 'zebra.stampede' && specialAttack.stage === 'telegraph' || !specialAttack && motion.speed > 4.5) clip = 'zebra-stampede';
      }
      const heavyGait = mega && !heavy && !specialAttack && b.state !== 'attack' && b.state !== 'dead';
      const megaRun = Math.max(0, Math.min(1, (motion.speed - 1.5) / 1.5));
      const megaRate = 1.05 + (megaCycleRate - 1.05) * megaRun;
      const duration = authoredClips.get(clip)?.duration ?? 1;
      const dogWindupTicks = Math.ceil(batch.windup * 60), dogBiteT = renderTick - (b.until - dogWindupTicks);
      const phase = primateStory ? Math.max(0, (renderTick - primateStory.start) / 96) % 1 : clip === 'dog-lunge-bite' ? Math.max(0, Math.min(1, dogBiteT < dogWindupTicks ? .4 * dogBiteT / dogWindupTicks : .4 + .6 * (dogBiteT - dogWindupTicks) / 24)) : clip === 'zebra-rear-kick' && specialAttack ? Math.min(1, (renderTick - specialAttack.startTick) / (specialAttack.activeTick - specialAttack.startTick + 36)) : clip === 'zebra-stampede' && specialAttack ? .5 + ((renderTick - specialAttack.activeTick) / 32 % 1) / 3 : e.infectionRise ? Math.min(1, (this.world.tick - e.infectionRise.started) / (e.infectionRise.until - e.infectionRise.started)) : b.state === 'dead' ? (reaction?.groundDeath ? 1 : Math.min(1, (this.world.tick - b.deadAt) / 60 / duration)) - InfectedMoves.stir(e, renderTick, duration) : clip === 'windup' ? e.infected?.specialAttack ? Math.min(1, (renderTick - e.infected.specialAttack.startTick) / (e.infected.specialAttack.activeTick - e.infected.specialAttack.startTick)) : Math.max(0, Math.min(1, 1 - (b.until - this.world.tick) / (batch.windup * 60))) : reaction && clip === 'get-up' ? Math.min(1, (age - .7) / getUpSpan(reaction)) : reaction && ['flung', 'knockdown', 'stagger-left', 'stagger-right'].includes(clip) ? Math.min(1, age / (reaction.heavy ? .48 : (reaction.until - reaction.started) / 60)) : strides[clip] ? this.gait.sample(e.id, gaitDistance, batch.animal ? clip === 'dog-gallop' ? 'corgi-gallop' : 'corgi-trot' : clip, batch.strideScale, motion.speed, heavyGait ? megaRate : undefined) : (renderTick / 60 + e.id * .137) / duration % 1;
      const zebraTell = species === 'zebra' && clip === 'zebra-stampede' && specialAttack?.move === 'zebra.stampede' && specialAttack.stage === 'telegraph';
      const animalPhase = flightPhase >= 0 && clip === 'run' ? flightPhase
        : zebraTell ? .5 * Math.min(1, (renderTick - specialAttack!.startTick) / Math.max(1, specialAttack!.activeTick - specialAttack!.startTick)) * ((renderTick / 9 | 0) % 2 ? 1 : .6)
        : species === 'zebra' && clip === 'zebra-stampede' && !specialAttack ? .5 + (this.gait.sample(e.id, gaitDistance, 'corgi-gallop', batch.strideScale, motion.speed) % 1) / 3 : -1;
      let frame = infectedClips.indexOf(clip) * framesPerClip + (animalPhase >= 0 ? animalPhase : phase) * (framesPerClip - 1);
      const tint = batch.animal ? batch.role === 'inf.dog' && batch.lod === 'lod1' ? this.dogCoatTints[Number(key === 'inf.dog.cream')] : batch.shirt : crowdShirt(e.id);
      const presented = this.presentation.sample(e.id, e.transform, this.world.tick, alpha);
      const resting = b.state === 'dead' && !e.knockbackSlide ? this.corpsePosition(e, b.deadAt, alphaLookAssets.includes(def.asset) ? deathReach.get(batch.poses.clip) : undefined) : { ...e.transform, y: e.transform.y - .7 };
      const settle = b.state === 'dead' && !e.knockbackSlide ? reaction?.groundDeath ? 1 : Math.max(0, Math.min(1, (this.world.tick - b.deadAt - 8) / 52)) : 0;
      let x = presented.x + (resting.x - e.transform.x) * settle, z = presented.z + (resting.z - e.transform.z) * settle;
      // r32: a clinging monkey hangs on the courier's flank (render-only pull from its contact spot onto her body).
      const clingTo = species === 'monkey' && animalPose?.airborne && !specialAttack ? this.world.entities.get(e.infected?.heardTargetId || 1) : undefined;
      if (clingTo) { const dx = clingTo.transform.x - x, dz = clingTo.transform.z - z, d = Math.hypot(dx, dz); if (d > .45) { x += dx / d * (d - .42); z += dz / d * (d - .42); } }
      const blend = batch.poses.sample(e.id, clip, frame, renderTick / 60);
      const fade = 0;
      if (e.archetype === 'infected.crow') {
        for (let bird = 0; bird < 20; bird++) if ((e.infected?.birdDeadMask ?? 0) & 1 << bird) {
          const x = b.birdPositions[bird * 3], z = b.birdPositions[bird * 3 + 2]; this.transform.makeTranslation(x, this.world.districts?.groundHeight(x, z) ?? 0, z);
          this.staticCorpses.place(e, `${key}:bird`, batch.mesh.geometry, batch.mesh.material as MeshLambertNodeMaterial, batch.poses.clip, infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1, this.transform, tint, [0, 0, 0], `${e.id}/${bird}`);
        }
        for (let bird = 0; bird < 20; bird++) if (b.birdAlive[bird]) { this.transform.makeTranslation(b.birdPositions[bird * 3], b.birdPositions[bird * 3 + 1], b.birdPositions[bird * 3 + 2]); batch.mesh.setMatrixAt(batch.count, this.transform); writeCrowdAppearance(batch.tint, batch.count, e.id, tint, blend[0] * 2 + blend[1], this.accessories?.slot(e), this.accessories?.hidesHair(e, batch.lod)); batch.state.setXYZW(batch.count++, frame, 0, 0, this.flashStrength(e, feedback)); }
      } else {
        this.transform.makeRotationY((b.state === 'dead' ? resting.yaw : presented.yaw) + (e.civilian?.zooAnimal && e.infection ? Math.sin(renderTick * .5 + e.id) * .018 * e.infection.progress : 0)); this.transform.setPosition(x, (b.state === 'dead' ? (presented.y - .7) * (1 - settle) + resting.y * settle : Math.max(presented.y - 0.7, this.world.districts?.pavingHeight(x, z) ?? 0)) + (reaction?.heavy && age < .48 ? Math.max(0, .16 * (1 - Math.abs(age / .24 - 1))) : 0) + animalLift, z);
        if (e.infected?.arenaBoss?.arena === 'monkey' && e.infected.arenaBoss.slot === 6) this.transform.scale(this.arenaScale);
        // r26-l8hitreact: cosmetic squash on every boss hit (<= 0.15 s), matrix only; sim pose, attacks and stagger are untouched.
        if (e.infected?.arenaBoss && feedback && feedback.strength > 1) {
          const k = Math.max(0, 1 - (this.world.tick - feedback.at) / 9);
          if (k > 0) this.transform.scale(this.flinchScale.set(1 + .05 * k, 1 - .06 * k, 1 + .05 * k));
        }
        if (b.state === 'dead') this.deadFeet.set(e.id, { id: e.id, x, y: this.transform.elements[13], z });
        // r32: flying flamingos and leaping animals cast a contact shadow on the ground under them (reads height top-down).
        if (animalLift > .3 && this.shadows.count < 350) { const g = this.world.districts?.groundHeight(x, z) ?? 0; this.shadowMatrix.makeTranslation(x, g + .02, z); this.shadows.setMatrixAt(this.shadows.count++, this.shadowMatrix); this.shadows.instanceMatrix.needsUpdate = true; }
        if (e.corpse) {
          // Start with the intact corpse source; ordinary limb severance is
          // applied below, while the Mega keeps its complete creature outline.
          const look = resolveCrowdAppearance(e), source = this.corpseGeometry.get(key) ?? batch.mesh.geometry.userData.inlineBody ?? batch.mesh.geometry;
          const frozenSource = !batch.animal ? this.accessories?.corpseSource(e, source, def.asset, batch.poses.clip.parts.indexOf('head')) ?? source : source;
          const nearBatch = regularInfectedModels.some(id => id === def.asset) || this.world.scenario === 'L4' && !batch.animal && !alphaLookAssets.includes(def.asset) ? this.batches.get(`${key}:lod1`) : undefined;
          const frame = infectedClips.indexOf(death) * framesPerClip + framesPerClip - 1;
          const near = nearBatch ? { source: this.accessories?.corpseSource(e, nearBatch.mesh.geometry, def.asset, nearBatch.poses.clip.parts.indexOf('head')) ?? nearBatch.mesh.geometry, material: nearBatch.mesh.material as MeshLambertNodeMaterial, clip: nearBatch.poses.clip, frame } : undefined;
          // vqa-fix-7 (P1-117): permanent corpses keep their body; only a gameplay leg loss (the crawler) stays on it, transient
          // blast/gunshot dismemberment lives in the gib VFX. The Mega keeps its complete creature silhouette (fix72-c, L10-12).
          const mask = this.goreEnabled && b.legLost && !isMega(e) ? 4 : 0;
          const hidden = crowdLimbParts(batch.animal).flatMap((names, bit) => mask & 1 << bit ? names : []);
          this.staticCorpses.place(e, `${key}:${death}:${mask}`, frozenSource, batch.mesh.material as MeshLambertNodeMaterial, this.corpseClips.get(key) ?? batch.poses.clip, frame, this.transform, tint, [0, 0, 0], String(e.id), hidden, !batch.animal ? look : undefined, near);
          this.k9Vest?.place(e, batch.poses, frame, [0, 1], this.transform);
          continue;
        }
        // Close pixel band (hysteresis): the courier's footwork plus the zombie move set; further out stance plants only.
        const band = crowdLod(this.visibility.pixels(e.transform.x, e.transform.y, e.transform.z, dimensions.y), this.footBands.get(e.id)); this.footBands.set(e.id, band);
        const crawling = b.legLost || e.archetype === 'infected.crawler' || clip === 'crawl', moving = !!strides[clip] && motion.speed > .06;
        const lurchScale = this.world.scenario === 'L10' && e.archetype === 'infected.runner' ? .35 : 1;
        const { layers, style } = this.moves.sample(e, b.state, b.until, batch.windup, renderTick, presented.yaw, motion.speed, moving ? clip : undefined, lurchScale);
        if (heavyGait) {
          // Refit the existing zombie clips to the broad Mega: long low steps,
          // calm shoulders, and flat shoe plants about a steady crouched hip.
          layers.bodyLean = (28 + 4 * megaRun) * Math.PI / 180;
          layers.heavyGait = 1;
          layers.lurch = moving ? .18 : 0;
          layers.roll = Math.max(-.2, Math.min(.2, -this.presentation.turnRate(e.id) * .025));
          style.drag = 0;
          style.stance = Math.min(.56 - .24 * megaRun, .8 * megaRate / Math.max(1, motion.speed));
          style.knee = .55 + .13 * megaRun;
          style.stepRate = megaRate;
          style.maxLift = .08 + .06 * megaRun;
          style.pelvisHeight = 1.15;
          style.footRoll = 0;
        }
        if (this.world.scenario === 'L10' && e.archetype === 'infected.runner' && moving && !heavy) layers.maxBodyLean = 38 * Math.PI / 180;
        // G-17: standing and walking infected never lean past the 42 degree acceptance limit (idle hunch read 45-52 degrees on the womanB/manB rigs); attacks and crawlers keep their authored reach.
        if (!heavy && !specialAttack && !crawling && b.state !== 'dead' && b.state !== 'attack') layers.maxBodyLean = Math.min(layers.maxBodyLean ?? Infinity, 40 * Math.PI / 180);
        // The baked hunch already reaches toward the victim. Keep the added pelvis/torso lunge
        // inside the reserved contact space; distant windups retain their full coil and extension.
        const target = this.world.entities.get(e.infected?.heardTargetId || e.infected?.l1?.targetId || 1);
        if (target?.survivor && Math.hypot(x - target.transform.x, z - target.transform.z) < infectedContactDistance(e.combat!.radius) + .15) layers.lunge = Math.min(layers.lunge ?? 0, .04);
        if (!heavy && !specialAttack && b.state !== 'dead' && this.world.solids?.clear(e.transform, e.combat!.radius + .6, e.id) === false) {
          // Keep the baked attack hunch over its planted feet at a hull, wall or body.
          // Combat reach is unchanged; only the added forward body throw yields.
          layers.lunge = Math.min(layers.lunge ?? 0, 0); layers.lean = -.25; layers.lurch = 0;
        }
        layers.animal = animalPose;
        if (species && e.infected?.arenaBoss && feedback && feedback.strength > 1) {
          // Boss hit: a short recoil away from the courier on every hit (the matrix squash above stays).
          const k = Math.max(0, 1 - (this.world.tick - feedback.at) / 12);
          if (k > 0 && !layers.flinch) { layers.flinch = k; layers.hitX = -1; layers.hitZ = 0; }
        }
        const layered = !crawling && (layers.animal || layers.maxBodyLean || layers.lean || layers.lunge || layers.flinch || layers.lurch || layers.chestBeat || layers.trunkSwipe || layers.throwPose || layers.shieldBreak || layers.heavyGait) ? layers : undefined;
        // Match the low L4 gait budget to its sixteen closest detailed bodies.
        // Contact-range actors and action poses keep the full leg solve; other
        // moving runners retain the existing procedural ground-contact solver.
        const detailedFeet = this.low && this.world.scenario === 'L4' && moving && distance > 3 && canHoldCrowdPose(e, this.world.tick)
          ? this.nearIds.has(e.id) : band === 'lod1' || distance <= 12 || !moving || !!specialAttack || !!e.infected?.roar;
        const distantHold = this.low && this.world.scenario === 'L4' && moving && distance > 3 && !this.nearIds.has(e.id) && canHoldCrowdPose(e, this.world.tick);
        { const pose = batch.locomotion.presentation;
        pose.frame = frame;
        pose.blend = blend;
        pose.clip = clip;
        pose.phase = phase;
        pose.instance = this.transform;
        pose.scale = batch.strideScale;
        pose.speed = motion.speed;
        pose.time = renderTick / 60;
        pose.near = detailedFeet && !crawling;
        pose.layers = layered;
        pose.style = style;
        pose.procedural = true;
        pose.cadence = this.low && canHoldCrowdPose(e, this.world.tick) ? 2 : 1;
        pose.holdDistanceM = distantHold ? .08 : .05;
        frame = batch.locomotion.present(e.id, batch.poses, pose); }
        this.k9Vest?.place(e, batch.poses, frame, blend, this.transform);
        if (!batch.animal && !batch.mesh.geometry.userData.inlineAccessories ) this.accessories?.place(e, batch.lod as 'lod0' | 'lod1' | 'lod2', batch.poses, frame, blend, this.transform, !!((feedback?.mask ?? 0) & 16));
        batch.probe.add(e.id, clip, phase, this.transform, batch.poses, frame, ...blend, batch.mesh.geometry, (feedback?.mask ?? 0) | (b.legLost ? 4 : 0));
        const figure = batch.probe.figures.at(-1);
        if (__QA_HOOKS__ && batch.probe.details && figure?.id === e.id && !batch.animal && !e.civilian?.zooAnimal) figure.appearance = renderedCrowdLook(e.id, this.definitions.get(key)!.asset, batch.mesh.geometry, tint, this.accessories?.drawnSlot(e, batch.lod as 'lod0' | 'lod1' | 'lod2') ?? null);
        batch.mesh.setMatrixAt(batch.count, this.transform); writeCrowdAppearance(batch.tint, batch.count, e.id, tint, blend[0] * 2 + blend[1], this.accessories?.slot(e), this.accessories?.hidesHair(e, batch.lod)); batch.state.setXYZW(batch.count++, frame, Number(b.detached && this.goreEnabled), e.civilian?.zooAnimal ? e.infection?.progress ?? 0 : feedback?.mask ?? 0, this.flashStrength(e, feedback) + Math.round(fade * 255) * 2);
        for (let limb = 0; limb < 5; limb++) if ((feedback?.mask ?? 0) & (1 << limb)) { if (batch.mesh.geometry.userData.crowdAtlas) this.texturedCaps++; else { const p = this.limbPosition(e.id, limb)!; this.transform.makeRotationY(e.transform.yaw); this.transform.setPosition(p.x, p.y + (limb === 4 ? -.17 : .18), p.z); this.caps.setMatrixAt(this.caps.count++, this.transform); } }
      }
      if (e.archetype !== 'infected.crow') { this.transform.makeTranslation(e.transform.x, (this.world.districts?.groundHeight(e.transform.x, e.transform.z) ?? 0) + .018, e.transform.z); this.shadows.setMatrixAt(this.shadows.count++, this.transform); }
      // Attack ground warnings belong to Vfx: one pooled decal per attack.
    }
    this.staticCorpses.updateDetail(player.transform, !this.low || this.world.scenario === 'L4');
    if (view) this.staticCorpses.cull(this.frustum);
    for (const batch of this.batches.values()) {
      batch.mesh.count = batch.count; batch.mesh.visible = batch.count > 0;
      if (batch.count) {
        batch.mesh.instanceMatrix.clearUpdateRanges(); batch.mesh.instanceMatrix.addUpdateRange(0, batch.count * 16); batch.mesh.instanceMatrix.needsUpdate = true;
        const data = batch.state.data;
        data.clearUpdateRanges(); data.addUpdateRange(0, batch.count * data.stride); data.needsUpdate = true;
      }
    }
    this.caps.visible = this.caps.count > 0; this.shadows.visible = this.shadows.count > 0;
    if (this.caps.count) { this.caps.instanceMatrix.clearUpdateRanges(); this.caps.instanceMatrix.addUpdateRange(0, this.caps.count * 16); this.caps.instanceMatrix.needsUpdate = true; }
    if (this.shadows.count) { this.shadows.instanceMatrix.clearUpdateRanges(); this.shadows.instanceMatrix.addUpdateRange(0, this.shadows.count * 16); this.shadows.instanceMatrix.needsUpdate = true; }
  }
  /** Scene Lab probe: frozen corpses as drawn (feet position). */
  private readonly deadFeet = new Map<number, { id: number; x: number; y: number; z: number }>();
  drawnCorpses(): { id: number; x: number; y: number; z: number }[] { const frozen = this.staticCorpses.drawn(), ids = new Set(frozen.map(c => c.id)); return [...frozen, ...[...this.deadFeet.values()].filter(c => !ids.has(c.id) && (this.world.entities.get(c.id)?.health.current ?? 1) <= 0)]; }
  /** Keep settled bodies on clear ground, giving each a readable footprint.
   * This is presentation only; damage and revive continue to use sim transforms. */
  private corpsePosition(e: EntitySnapshot, deadAtTick: number, prone?: number) {
    return corpseLayout(this.world).place(e, deadAtTick, prone);
  }
  /** alpha-white: the hit flash a figure draws. A pulse lasts 0.1 s of render time (Vfx), and never more than
   * hitFlashTicks of simulation: paused stepping (QA drivers, e2e) froze the render clock, so every Alpha hit
   * under fire stayed at peak white. Downed and dead bodies never flash: a corpse keeps its own look. */
  private flashStrength(e: { health: { current: number } }, feedback: { strength: number; at: number } | undefined): number {
    return feedback && e.health.current > 0 && this.world.tick - feedback.at <= (feedback.strength > 1 ? bossHitFlashTicks : hitFlashTicks) ? feedback.strength : 0;
  }
  flash(id: number, strength: number): void {
    const e = this.world.entities.get(id); if (!e?.combat || e.faction !== 'infected') return;
    const feedback = this.feedback.get(id) ?? { mask: 0, strength: 0, at: -Infinity }; if (strength > feedback.strength) feedback.at = this.world.tick; feedback.strength = strength; this.feedback.set(id, feedback);
  }
  private limbPosition(id: number, limb: number) {
    const e = this.world.entities.get(id); if (!e?.combat || e.faction !== 'infected') return;
    const z = limb < 2 ? (limb === 0 ? -.3 : .3) : limb < 4 ? (limb === 2 ? -.12 : .12) : 0;
    return { x: e.transform.x + Math.sin(e.transform.yaw) * z, y: e.transform.y - .7 + (e.health.current <= 0 ? .18 : limb < 2 ? .65 : limb < 4 ? .25 : 1.15), z: e.transform.z + Math.cos(e.transform.yaw) * z };
  }
  detach(id: number, limb: number) {
    const position = this.limbPosition(id, limb); if (!position) return;
    const feedback = this.feedback.get(id) ?? { mask: 0, strength: 0, at: -Infinity }; feedback.mask |= 1 << limb; this.feedback.set(id, feedback); return position;
  }
  clearGore(): void { for (const feedback of this.feedback.values()) feedback.mask = 0; this.staticCorpses.clearBodies(); }
  setGoreEnabled(enabled: boolean): void { if (this.goreEnabled !== enabled) this.staticCorpses.clearBodies(); this.goreEnabled = enabled; }
  getGoreState() { return [...this.feedback].map(([id, f]) => ({ id, detached: ['armL', 'armR', 'legL', 'legR', 'head'].filter((_, i) => f.mask & (1 << i)), caps: ['armL_cap', 'armR_cap', 'legL_cap', 'legR_cap', 'head_cap'].filter((_, i) => f.mask & (1 << i)), visible: !this.world.entities.get(id)?.infected?.hidden })); }
  getState() {
    let instances = 0, draws = 0, objects = 0, nonInstanced = 0;
    this.traverse((node) => { if (node !== this) objects++; if (node instanceof InstancedMesh) { instances += node.count; if (node.count) draws++; } else if (node instanceof Mesh) nonInstanced++; });
    const accessoryDrawCalls = this.accessories?.infectedDrawCalls() ?? 0;
    // Legacy probe fields: warnings now live in render.vfx.telegraphs.
    return { telegraphs: [0, 0], figures: [...this.batches.values()].flatMap(b => b.probe.figures).concat(this.staticCorpses.snapshot().figures), instances, meshDrawCalls: draws + accessoryDrawCalls, bodyMeshDrawCalls: draws, accessoryDrawCalls, objects, staticCorpsePages: this.staticCorpses.children.length, texturedCorpsePages: this.staticCorpses.children.filter(mesh => mesh instanceof InstancedMesh && mesh.geometry.hasAttribute('uv')).length, nonInstancedMeshes: nonInstanced, caps: this.caps.count + this.texturedCaps, flashes: [...this.feedback.values()].filter(f => f.strength > 0).length, batches: [...this.batches.values()].map((b) => ({ id: b.role, lod: b.lod, instances: b.count, layout: crowdVertexLayout(b.mesh.geometry, b.mesh.instanceMatrix), source: 'glb', atlas: b.mesh.userData.crowdAtlas ? { ...b.mesh.userData.crowdAtlas, width: b.mesh.userData.preRenderTextures[1].image.width, height: b.mesh.userData.preRenderTextures[1].image.height, decodedBytesWithMips: (b.mesh.userData.preRenderTextures[1].image.width ** 2 * 4 * 4 - 4) / 3 } : null })).concat([...this.heroSlots.keys()].map(id => ({ id, lod: 'lod0', instances: 0, layout: { buffers: 0, locations: 0, webgpu: true, webgl2: true }, source: 'pending', atlas: null }))), assets: this.logs };
  }
  dispose(): void {
    this.disposed = true; this.staticCorpses.dispose(); this.k9Vest?.dispose();
    for (const mesh of this.heroSlots.values()) { mesh.geometry.dispose(); (mesh.material as MeshLambertNodeMaterial).dispose(); mesh.dispose(); }
    this.heroSlots.clear();
    for (const geometry of this.corpseGeometry.values()) geometry.dispose();
    this.corpseGeometry.clear(); this.corpseClips.clear();
    const released = new Set<MeshLambertNodeMaterial>();
    for (const batch of this.batches.values()) { batch.mesh.geometry.dispose(); const material = batch.mesh.material as MeshLambertNodeMaterial; if (!released.has(material)) { released.add(material); material.dispose(); } batch.mesh.dispose(); batch.texture.dispose(); }
    for (const mesh of [this.shadows, this.caps]) { mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); mesh.dispose(); }
    this.batches.clear(); this.sharedSkinMaterials.clear(); this.clear(); if (!this.sharedRegistry) void this.registry.dispose();
  }
}
