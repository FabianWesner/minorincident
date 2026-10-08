import { PropFixtureView } from './PropFixtureView';
import { ContactShadows } from './ContactShadows';
import { NpcView } from './npc/NpcView';
import { lookViewpoints } from '../data/lookViewpoints';
import { LookUniforms } from './LookUniforms';
import type { LookPatch } from '../data/lookPatch';
import { qualityBudgets, type QualityTier } from '../core/Quality';
import { CrowdView } from './CrowdView';
import { MissionUI } from '../ui/MissionUI';
import { ObjectiveMarker } from './ObjectiveMarker';
import { VehicleView } from './VehicleView';
import { L2Props } from './L2Props';
import { BicycleView } from './BicycleView';
import { combatPhotoSpots } from '../../tests/fixtures/scenarios/combat-arena';
import { ActionView } from './ActionView';
import type { SurvivorState } from '../data/survivor';
import { CharacterView } from './characters/CharacterView';
import { useSkinnedCourier } from './characters/RiderContacts';
import { BoxGeometry, Color, Group, Mesh, MeshBasicNodeMaterial, PlaneGeometry, RingGeometry, Scene, MeshLambertNodeMaterial, MeshStandardMaterial, type Material } from 'three/webgpu';
import type { Lifecycle } from '../core/Lifecycle';
import { lerp } from '../core/maths';
import type { SimWorld } from '../sim/world/SimWorld';
import { MeshGridMaterial } from './MeshGridMaterial';
import { PhysicsWireframe } from './PhysicsWireframe';
import { View } from './View';
import { Renderer } from './Renderer';
import { preRender } from './PreRenderer';
import { Lighting } from './Lighting';
import { Materials } from './Materials';
import { Lookdev } from './Lookdev';
import { Occlusion } from './Occlusion';
import { PostFx } from './PostFx';
import { photoSpots } from '../../tests/fixtures/scenarios/lookdev';
import type { TimeOfDay } from '../data/timeOfDay';
import { Quaternion, Vector3 } from 'three';
import { VehicleFeedback } from './vfx/VehicleFeedback';
import { Vfx, type VfxSettings } from './vfx/Vfx';
import { LabAccidentFx } from './vfx/labAccident';
import { labAccidentTargets, anchorLookup } from './vfx/labAccidentView';
import { DistrictAssets } from '../assets/DistrictAssets';
import { Grass, windPhase } from './Grass';
import { DistrictView } from './DistrictView';
import { PaletteMaterial } from './PaletteMaterial';
import { InteractionView } from './InteractionView';
import { EntityAssets } from './EntityAssets';
import { loadMeasure } from '../assets/loadTiming';
import { loadGate } from '../assets/loadGate';
import { lodPolicy } from './lodPolicy';
import { layoutLights } from './WorldLights';
import { auraLight, pickupLight } from './LightField';
import { timeOfDay as timeOfDayPresets } from '../data/timeOfDay';

/** Presentation composition: E01 fixture or E02 lookdev, with state flowing only from sim to view. */
/** Bat roundhouse body turn (presentation only; the sim sweep strikes each target as this angle passes it):
 * a short coil against the swing in the windup, the full circle linearly over the active window. */
export function roundhouseSpin(attack: { started: number; activeAt: number; recoveryAt: number }, time: number): number {
  const u = time - attack.started, a = attack.activeAt - attack.started, r = attack.recoveryAt - attack.started;
  if (u < a) { const t = Math.max(0, u) / Math.max(1, a); return -.45 * t * t * (3 - 2 * t); }
  return u >= r ? 0 : -.45 + (Math.PI * 2 + .45) * (u - a) / Math.max(1, r - a);
}
export class GameView implements Lifecycle {
  readonly scene = new Scene();
  private missionUI: MissionUI | null = null;
  private marker: ObjectiveMarker | null = null;
  private cinematicId: string | null = null;
  private storyFraming = false;
  private readonly storyFocus = new Vector3();
  private readonly storyOffset = new Vector3();
  readonly view = new View();
  readonly camera = this.view.camera;
  renderer: Renderer;
  contextLost = false;
  private lostRendererDisposal: Promise<void> | null = null;
  renderedFrames = 0;
  updateCpuMs = 0;
  renderCpuMs = 0;
  private readonly meshes: Mesh[] = [];
  private vehicles: VehicleView | null = null;
  private l2Props: L2Props | null = null;
  private bicycle: BicycleView | null = null;
  private readonly seat = new Vector3();
  private readonly gripL = new Vector3();
  private readonly gripR = new Vector3();
  private actions: ActionView | null = null;
  private contactShadows: ContactShadows | null = null;
  private crowd: CrowdView | null = null;
  private readonly preparedDistrictViews = new Map<SimWorld['districts'], DistrictView>();
  private pendingPreparation: { shared: NonNullable<GameView['districtResources']>; instanceCapacity?: number } | null = null;
  private preparation: Promise<void> | null = null;
  /** Pending L1 shader warm-up while the briefing is shown (see load()). */
  warming: Promise<void> | null = null;
  /** Speculative menu-time level load: keep the mission UI hidden until the player picks the level. */
  missionHidden = false;
  /** Menu-time (speculative) load: pace heavy steps one per frame and yield to player input. */
  background = false;
  private frozenFrame: HTMLCanvasElement | null = null;
  /** Show a still copy of the current frame (e.g. the title backdrop) over the canvas while a level
   * loads and warms up behind the menus/briefing; drawing is suspended until unfreeze(). */
  freeze(): void {
    if (this.frozenFrame) return;
    const source = this.renderer.domElement, copy = document.createElement('canvas');
    copy.width = source.width; copy.height = source.height;
    copy.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
    try { this.update(1); copy.getContext('2d')?.drawImage(source, 0, 0); } catch { /* best effort */ }
    source.after(copy); this.frozenFrame = copy;
  }
  unfreeze(): void { this.frozenFrame?.remove(); this.frozenFrame = null; if (!this.warming) this.update(1); }
  get frozen(): boolean { return this.frozenFrame !== null; }
  private generation = 0;
  private npcs: NpcView | null = null;
  get propUploads(): number { return this.fixtureProps?.uploads ?? this.districts?.propUploads ?? 0; }
  private fixtureProps: PropFixtureView | null = null;
  private interactions: InteractionView | null = null;
  private entityAssets: EntityAssets | null = null;
  vfx: Vfx | null = null;
  private labAccident: LabAccidentFx | null = null;
  private labWindows: { prewarmWindows(): () => void } | null = null;
  private vehicleFeedback: VehicleFeedback | null = null;
  private readonly vfxSettings: VfxSettings = {};
  private hitStopTick = 0;
  private frozenStarted = -1;
  private frozenPose: SurvivorState | null = null;
  private destination: Mesh | null = null;
  private readonly bikeOrientation = new Quaternion();
  private cube: Mesh | null = null;
  private character: CharacterView | null = null;
  private wireframe: PhysicsWireframe | null = null;
  readonly look = new LookUniforms();
  private lighting: Lighting | null = null;
  private materials: Materials | null = null;
  private districtResources:{lighting:Lighting;materials:Materials;registry:DistrictAssets;phase:ReturnType<typeof windPhase>;grassMaterial:ReturnType<typeof Grass.material>}|null=null;
  private districts:DistrictView|null=null;
  private windowMask=false;
  private foliageMask: boolean | 'crowns'=false;
  private readonly foliageMasks = new Map<Material, MeshBasicNodeMaterial>();
  private readonly foliageIdMasks = new Map<Material, MeshBasicNodeMaterial>();
  private lookdev: Lookdev | null = null;
  private postFx: PostFx | null = null;
  private dofEnabled = false;
  private readonly occlusion = new Occlusion();
  private readonly playerPosition = new Vector3();
  private readonly projection = new Vector3();
  private idPass = false;
  private readonly flashOverlay = document.createElement('div');
  /** E19 ending: black fade after the shutter slam, and the rolled-down bay shutter. */
  private shutter: Group | null = null;
  private readonly idBackground = new MeshBasicNodeMaterial({ color: '#000000' });
  private readonly idPlayer = new MeshBasicNodeMaterial({ color: '#ff00ff' });
  private readonly savedMaterials = new Map<Mesh, Material | Material[]>();
  constructor(private readonly world: SimWorld, private readonly params: URLSearchParams, private quality: QualityTier = 'high') {
    this.renderer = new Renderer(params);
    this.idBackground.name = 'keep_idBackground'; this.idPlayer.name = 'keep_idPlayer';
    this.scene.background = new Color('#293447');
  }
  async init(): Promise<void> {
    await this.renderer.init(); this.resize();
    this.renderer.domElement.style.display = 'block';
    document.querySelector('#game')!.appendChild(this.renderer.domElement);
    this.missionUI = new MissionUI(this.world,()=>this.update(1));
    this.flashOverlay.style.cssText = 'position:fixed;inset:0;background:white;opacity:0;pointer-events:none;z-index:3';
    document.querySelector('#game')!.appendChild(this.flashOverlay);
    window.addEventListener('resize', this.resize);
  }
  private readonly resize = (): void => {
    const dpr = Number(this.params.get('dpr') ?? devicePixelRatio);
    this.renderer.setPixelRatio(Math.min(Number.isFinite(dpr) && dpr > 0 ? dpr : 1, qualityBudgets[this.quality].pixelRatio));
    const width = document.documentElement.clientWidth, height = document.documentElement.clientHeight;
    this.renderer.setSize(width, height);
    this.view.resize(width, height); this.update(1);
  };
  /** Apply inexpensive tier controls without rebuilding the level or interrupting its simulation. */
  setQuality(tier: QualityTier): void {
    const changed = this.quality !== tier; this.quality = tier; this.resize();
    if (changed && this.postFx) { const enabled = this.postFx.bloomEnabled.value; this.postFx.dispose(); this.postFx = new PostFx(this.renderer, this.scene, this.camera, tier, this.look); this.postFx.bloomEnabled.value = enabled; this.postFx.setDof(this.dofEnabled); this.postFx.applyLook(); }
    this.lighting?.setQuality(tier); this.districts?.setQuality(tier);
    this.vfx?.set({ quality: tier }); this.crowd?.setQuality(tier); this.npcs?.setQuality(tier);
  }
  /** Three's WebGL fallback reports loss but does not rebuild its backend on restore.
   * Recreate renderer GPU state on the same canvas so touch/pointer listeners survive. */
  retireLostRenderer(): void { this.lostRendererDisposal = this.renderer.dispose(); }
  async restoreContext(): Promise<void> {
    const canvas = this.renderer.domElement;
    this.reset(); await this.lostRendererDisposal; this.lostRendererDisposal = null;
    this.renderer = new Renderer(this.params, canvas); await this.renderer.init();
    this.resize(); await this.load(); this.contextLost = false; this.update(1);
  }
  async load(): Promise<void> {
    this.reset();
    const player = this.world.entities.get(1);
    this.view.reset(player?.transform ?? { x: 0, z: 0 });
    let actors: Promise<unknown> | null = null;
    if (this.world.districts) {
      this.renderer.shadowMap.enabled=true;
      if(!this.districtResources){
        const lighting=new Lighting(this.scene, this.look),materials=new Materials(lighting),registry=new DistrictAssets(materials,this.renderer),phase=materials.wind;
        this.districtResources={lighting,materials,registry,phase,grassMaterial:Grass.material(materials,phase)};
      }
      const shared=this.districtResources;this.lighting=shared.lighting;this.materials=shared.materials;this.scene.add(this.lighting.sun,this.lighting.sun.target,this.lighting.hemisphere);this.lighting.set(this.world.districts.composition.timeOfDay);
      // L1 and L2 share D-GROVE (E20): the same instancing path, spawn focus and close-view warm-up.
      const grove = this.world.scenario === 'L1' || this.world.scenario === 'L2';
      const instanceCapacity = grove ? this.renderer.attributeInstanceCapacity() : undefined;
      const t=performance.now();
      this.districts=new DistrictView(this.world.districts,this.materials,shared.registry,shared.phase,shared.grassMaterial,this.quality === 'low', instanceCapacity);
      this.character=new CharacterView();
      // L1 objective transitions swap to prepared decay variants without a hitch (M1-22): they load
      // with the level (sharing its prototypes) and are warmed below; their LOD0 streams later.
      const variants = this.world.scenario === 'L1' ? [...this.world.preparedDistricts.values()].filter(prepared => prepared !== this.world.districts).map(prepared => new DistrictView(prepared, this.materials!, shared.registry, shared.phase, shared.grassMaterial, this.quality === 'low', instanceCapacity)) : [];
      // E19: Level 1 is played as the courier (white cap, orange tee, teal bag); same rig/animations.
      const character = this.character.init(this.materials, Boolean(this.world.combat), this.quality === 'low', ['L1', 'L2'].includes(this.world.districts.composition.id) ? 'courier' : 'survivor', useSkinnedCourier(this.params));
      // Actor models download and bake while the district loads (they do not depend on it).
      actors = this.startActors(character); actors.catch(() => {}); // a district failure must not leave it unhandled
      const initialFocus = grove ? this.view.cameraTarget : undefined;
      const heroAtSpawn = this.quality === 'high' && this.renderer.selectedBackend === 'webgl';
      await Promise.all([this.districts.load(1, initialFocus, heroAtSpawn), character, ...variants.map(variant => variant.load(1, initialFocus, heroAtSpawn))]);
      loadMeasure('view:districts+character',t);
      if (grove) {
        this.preparedDistrictViews.set(this.world.districts, this.districts);
        for (const variant of variants) { variant.visible = false; this.preparedDistrictViews.set(variant.world, variant); this.scene.add(variant); }
        // WebGL warms the spawn's close-view LOD0 before play (ANGLE specializes first draws).
        // The rest of the route and its unused LOD1 tier stream after the mission begins.
        if (this.quality === 'high' && this.renderer.selectedBackend === 'webgl') { const p = performance.now(); await Promise.all([this.districts, ...variants].map(view => view.prepare(this.view.cameraTarget, () => false, lodPolicy.lod1From))); loadMeasure('view:hero-lod0', p); }
        this.pendingPreparation = { shared, instanceCapacity };
      }
      this.scene.add(this.districts);this.lighting.field.setStatic(layoutLights(this.world.districts));this.postFx=new PostFx(this.renderer,this.scene,this.camera,this.quality,this.look);
      this.dofEnabled = this.world.districts.composition.id === 'L1'; this.postFx.setDof(this.dofEnabled);
      this.scene.add(this.character);
    } else if (this.world.player) {
      this.renderer.shadowMap.enabled = true;
      this.lighting = new Lighting(this.scene, this.look); this.materials = new Materials(this.lighting);
      const ground = new Mesh(new PlaneGeometry(this.world.combat?.definition.ground.width ?? 100, this.world.combat?.definition.ground.depth ?? 100), this.materials.get('sidewalk')); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
      this.meshes.push(ground); this.scene.add(ground);
      if (this.world.scenario === 'horde-readability') {
        this.lookdev = new Lookdev(this.materials, this.occlusion, false); this.scene.add(this.lookdev);
        this.postFx = new PostFx(this.renderer, this.scene, this.camera, this.quality, this.look);
      }
      this.character = new CharacterView(); await this.character.init(this.materials, Boolean(this.world.combat), this.quality === 'low'); this.scene.add(this.character);
    } else if (this.world.scenario === 'lookdev') {
      this.renderer.shadowMap.enabled = true;
      this.lighting = new Lighting(this.scene, this.look); this.materials = new Materials(this.lighting);
      this.lookdev = new Lookdev(this.materials, this.occlusion); this.scene.add(this.lookdev);
      this.postFx = new PostFx(this.renderer, this.scene, this.camera, this.quality, this.look);
    } else {
      const ground = new Mesh(new PlaneGeometry(100, 100), new MeshGridMaterial());
      ground.rotation.x = -Math.PI / 2;
      this.cube = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicNodeMaterial({ color: '#ed935c' }));
      this.meshes.push(ground, this.cube); this.scene.add(...this.meshes);
    }
    if (this.character) { this.contactShadows = new ContactShadows(this.world); this.scene.add(this.contactShadows); }
    if (player) {
      const material = new MeshBasicNodeMaterial({ color: '#64ffce', depthWrite: false, depthTest: false }); material.name = 'keep_moveMarker';
      this.destination = new Mesh(new RingGeometry(.22, .32, 32), material);
      this.destination.renderOrder = 10; this.destination.rotation.x = -Math.PI / 2; this.destination.visible = false;
      this.meshes.push(this.destination); this.scene.add(this.destination);
    }
    let t = performance.now();
    await (actors ?? this.startActors(Promise.resolve()));
    if (this.npcs) this.scene.add(this.npcs);
    if (this.entityAssets) this.scene.add(this.entityAssets);
    if (this.actions) { this.actions.update(); this.scene.add(this.actions); }
    if (this.world.missions) { this.marker = new ObjectiveMarker(this.world); this.scene.add(this.marker); }
    if (this.crowd) this.scene.add(this.crowd);
    if (this.vehicles) this.scene.add(this.vehicles);
    if (this.bicycle) this.scene.add(this.bicycle);
    if (this.world.scenario === 'L2' && this.materials) { this.l2Props = new L2Props(this.world, this.materials); this.scene.add(this.l2Props); }
    t = loadMeasure('view:actors', t);
    if (this.world.combat && this.materials) {
      this.vehicleFeedback = new VehicleFeedback(this.materials); this.scene.add(this.vehicleFeedback);
      this.vfx = new Vfx(this.world, {
        flash: (id, strength) => { this.crowd?.flash(id, strength); },
        detach: (id, limb) => this.crowd?.detach(id, limb),
        blood: coverage => { this.character?.setBlood(coverage); this.actions?.setBlood(coverage); },
        vehicle: (event, enabled) => { if (this.world.vehicles?.cars.has(event.id)) this.vehicles?.feedback(event, enabled); else this.vehicleFeedback?.update(event, enabled); },
        vehicleBloodEnabled: enabled => { this.vehicles?.setBloodEnabled(enabled); this.vehicleFeedback?.setBloodEnabled(enabled); },
        clearGore: () => { this.crowd?.clearGore(); },
        shake: strength => this.view.shake(strength),
        roll: strength => this.view.roll(strength), focus: () => this.view.focus,
        light: (x, z, hex, intensity, radius, ttl, flicker) => this.lightField?.addTransient({ x, z }, hex, intensity, radius, ttl, flicker) ?? null,
      });
      this.vfx.set({ ...this.vfxSettings, quality: this.quality }); this.scene.add(this.vfx);
      if (this.world.scenario === 'L1') { const targets = labAccidentTargets(this.scene, s => this.view.shake(s), (x, z, w) => this.view.pull(x, z, w)); this.labWindows = targets; this.labAccident = new LabAccidentFx(this.world, this.vfx, targets, anchorLookup(this.world)); this.labAccident.flashReduction = !!this.vfxSettings.flashReduction; this.labAccident.facing = this.camera.quaternion; this.labAccident.column.camera = this.camera; this.scene.add(this.labAccident.column); }
      this.crowd?.setGoreEnabled(this.vfx.snapshot().enabled && this.vfx.snapshot().gore === 'Full');
      const survivor = this.world.entities.get(1)?.survivor;
      this.frozenPose = survivor ? structuredClone(survivor) : null;
    }
    if (this.world.scenario === 'drive-course') this.postFx = new PostFx(this.renderer, this.scene, this.camera, this.quality, this.look);
    if (this.params.has('debug')) {
      this.wireframe = new PhysicsWireframe(this.world.physics); this.scene.add(this.wireframe.lines);
    }
    this.lighting?.applyLook(); this.materials?.applyLook(); this.postFx?.applyLook(); this.districts?.applyLook();
    this.lighting?.setQuality(this.quality); this.districts?.setQuality(this.quality); this.crowd?.setQuality(this.quality);
    // Native soft-particle depth samplers must compile with the actual MSAA target
    // bound. The first update below warms those programs in their render context.
    this.districts?.updateLods(this.view); this.crowd?.update(this.view); await Promise.all([this.crowd?.ready(), this.districts?.ready()]);
    t = loadMeasure('view:lod-ready', t);
    const warm = async (): Promise<void> => {
      await loadGate.foreground(); // node builds cannot be sliced: never during the menus
      this.lighting?.update(this.view);
      // Include hidden infected/LOD/VFX/decay variants, and warm their actual HDR/MSAA pass.
      const focus = this.camera.getWorldDirection(new Vector3()).multiplyScalar(20).add(this.camera.position);
      const unwarm = this.labWindows?.prewarmWindows();
      const restore = this.vfx?.prewarm(focus.x, focus.z); this.labAccident?.prewarm();
      try { await preRender(this.renderer, this.scene, this.camera, () => this.postFx ? this.postFx.render() : this.renderer.render(this.scene, this.camera), partitions => this.postFx ? this.postFx.compile(partitions) : Promise.all(partitions.map(apply => { apply(); return this.renderer.compileAsync(this.scene, this.camera); })), this.background ? () => loadGate.wait() : undefined); }
      finally { restore?.(); unwarm?.(); }
    };
    const finish = (): void => {
      loadMeasure('view:warm-up', t);
      this.idPass = this.params.get('idpass') === '1'; this.update(1);
      this.startPreparation();
    };
    // E20: L2 runs in the same town with the same crowd, so it uses the same full shader warm-up.
    const groveTown = this.world.scenario === 'L1' || this.world.scenario === 'L2';
    if (groveTown && this.params.get('test') !== '1') {
      // Load lane: the shader warm-up runs while the mission briefing is up instead of behind the
      // loading screen. Until it finishes the view does not draw and the game clock does not advance
      // (Game checks `warming`), so 'Begin mission' is never blocked and play starts warmed.
      // The warm-up draws into a 32x32 buffer: keep the canvas hidden behind the briefing meanwhile.
      const generation = this.generation, canvas = this.renderer.domElement, done = () => { canvas.style.visibility = ''; this.unfreeze(); };
      canvas.style.visibility = 'hidden';
      this.warming = warm().then(() => { done(); if (generation === this.generation) { this.warming = null; finish(); } }, error => { done(); if (generation === this.generation) { this.warming = null; console.error(error); } });
      return;
    }
    if (groveTown) await warm();
    else if (!this.vfx || this.renderer.selectedBackend === 'webgl') await this.renderer.compileAsync(this.scene, this.camera);
    finish();
  }
  /** Actor views are independent of each other and of the districts: create them and start their
   * loads concurrently (one network wave, not six); load() adds them in the established scene order. */
  private startActors(character: Promise<unknown>): Promise<unknown> {
    if (this.world.npcs && this.materials) { this.npcs = new NpcView(this.world, this.materials); this.npcs.setQuality(this.quality); }
    if (this.character) this.entityAssets = new EntityAssets(this.world, this.quality === 'low', this.materials!);
    if (this.world.combat && this.character) this.actions = new ActionView(this.world, this.character, this.materials!, this.renderer);
    if (this.character && this.world.combat) this.crowd = new CrowdView(this.world, this.quality === 'low', this.materials!);
    if (this.world.props && !this.world.districts && this.materials) { this.fixtureProps = new PropFixtureView(this.world, this.materials); this.scene.add(this.fixtureProps); }
    if (this.world.interactables && this.materials) { this.interactions = new InteractionView(this.world, this.materials, this.view, this.quality === 'low'); this.scene.add(this.interactions); }
    if (this.world.vehicles?.cars.size && this.materials) this.vehicles = new VehicleView(this.world, this.materials, this.view, this.quality === 'low');
    if (this.world.vehicles?.bicycle.entity && this.materials) this.bicycle = new BicycleView(this.world, this.materials);
    const actions = this.actions;
    return Promise.all([this.npcs?.init(), this.entityAssets?.init(this.view), actions ? character.then(() => actions.init()) : undefined, this.crowd?.init(), this.interactions?.synchronize(), this.vehicles?.load(), this.bicycle?.load()]);
  }
  /** Deferred L1 work: distant LOD0 and intermediate LOD1 on high, distant buildings' LOD1 on low,
   * nearest first, after the first playable frames. The load gate slices GLB parsing
   * and static batching to one short step per frame, so streaming stays within the frame budget. */
  private startPreparation(): void {
    const pending = this.pendingPreparation, current = this.districts, generation = this.generation;
    this.pendingPreparation = null;
    if (!pending || !current) return;
    const quality = this.quality;
    const stale = () => generation !== this.generation || this.quality !== quality;
    const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    this.preparation = (async () => {
      // Let the loading screen close and the first playable frames settle before streaming starts.
      for (let i = 0; i < 30; i++) await frame();
      if (stale()) return;
      // A preload may finish while a briefing is still open. Downloads start only after
      // gameplay has advanced; test mode keeps readiness even with a paused sim.
      while (this.world.missions?.state.phase === 'briefing' || this.playSeconds === 0 && this.params.get('test') !== '1') { await frame(); if (stale()) return; }
      loadGate.setPaced(true);
      for (const view of this.preparedDistrictViews.values()) { view.warmHero = batch => this.warmHidden(batch); view.swapSlot = () => this.swapSlot(); }
      const start = performance.now();
      // The decay variants follow: their swap at an objective transition then finds LOD0 batches ready.
      for (const view of [current, ...[...this.preparedDistrictViews.values()].filter(view => view !== current)]) { await view.prepare(this.view.cameraTarget, stale); if (stale()) break; }
      if (!stale()) loadMeasure('view:background-preparation', start);
    })().catch(error => { if (generation === this.generation) console.error(error); });
  }
  /** Build a detached batch's render objects (programs, pipelines, vertex buffers) without drawing it:
   * three collects the render list synchronously, then compiles and uploads asynchronously, yielding
   * between objects. The batch joins the scene afterwards. */
  private async warmHidden(batch: import('three/webgpu').Object3D): Promise<void> {
    const parent = this.districts ?? this.scene, saved: [import('three/webgpu').Object3D, boolean][] = [];
    batch.traverse(object => { saved.push([object, object.frustumCulled]); object.frustumCulled = false; });
    parent.add(batch); batch.updateMatrixWorld(true);
    let compiling: Promise<void>;
    try { compiling = this.renderer.compileAsync(batch, this.camera, this.scene); }
    finally { parent.remove(batch); for (const [object, culled] of saved) object.frustumCulled = culled; }
    await compiling;
  }
  /** A prepared decay swap retains characters, crowd pools, GPU programs, camera and audio. */
  switchPreparedDistrict(): boolean {
    const next = this.preparedDistrictViews.get(this.world.districts);
    if (!next) return false;
    if (this.districts) this.districts.visible = false;
    this.districts = next; next.visible = true; next.setQuality(this.quality);
    next.updateLods(this.view); this.lighting?.set(next.world.composition.timeOfDay); this.lighting?.field.setStatic(layoutLights(next.world));
    return true;
  }
  /** Close the bay only after the player enters. No ending camera, fade or scripted movement. */
  private updateEnding(): void {
    const mission = this.world.missions, door = mission?.def.anchors['fire-bay-door'];
    const closed = mission?.def.l1 && mission.state.gates['fire-shutter'] === false;
    if (closed && door && this.materials) {
      if (!this.shutter) {
        const ground = this.world.districts?.groundHeight(door.x, door.z) ?? 0;
        const group = new Group(); group.position.set(door.x, ground, door.z);
        const shutter = new Mesh(new BoxGeometry(3.6, 3.2, .12), this.materials.fromColor('story:shutter', new Color('#b44a3e')));
        shutter.position.y = 1.9; shutter.name = 'bay-shutter'; shutter.castShadow = true;
        // Face the shutter across the door -> trigger (inward) axis: the bay may open east or north.
        const inside = mission.def.anchors['fire-bay-trigger']; if (inside) group.rotation.y = Math.atan2(inside.x - door.x, inside.z - door.z);
        group.add(shutter); this.shutter = group; this.scene.add(group);
      }
    } else if (this.shutter) {
      this.scene.remove(this.shutter); this.shutter.traverse((o: import('three').Object3D) => { if (o instanceof Mesh) o.geometry.dispose(); }); this.shutter = null;
    }
  }
  /** Real render seconds, deliberately independent of sim ticks/time scale. */
  frame(seconds: number): void { const dt = Math.min(1, seconds); this.playSeconds += dt; this.vfx?.advance(dt); this.labAccident?.advance(dt); }
  /** Seconds of running play since the level loaded (menus/briefing/pause excluded). */
  private playSeconds = 0;
  /** Network-only extras wait until the first playable frames have been presented. */
  get backgroundReady(): boolean { return this.params.get('test') === '1' || !this.warming && !this.background && this.playSeconds > .25; }
  /** LOD0 swaps wait for the first seconds of play to pass (no hitch while the player starts moving),
   * then run one per frame through the load gate. */
  private async swapSlot(): Promise<void> {
    // Test mode keeps deterministic readiness (paused clocks would otherwise hold swaps forever).
    while (this.playSeconds < 4 && this.params.get('test') !== '1') await new Promise(resolve => setTimeout(resolve, 250));
    await loadGate.wait();
  }
  advance(seconds: number): void {
    this.districts?.advance(seconds);
    const player = this.world.entities.get(1);
    if (player) {
      // E20: riding the fire truck as a passenger uses the same 15 % zoom-out as driving.
      this.view.driving = this.world.vehicles?.active != null || !!this.world.missions?.state.l2?.seated;
      // E19 story beats: ease the game camera onto the beat (between courier and the other actor, a little closer),
      // then back to the follow camera; no cut, same isometric angle.
      const beat = this.world.missions?.state.l1?.beat;
      if (beat && this.world.storyLock && !this.view.spot) {
        this.storyFocus.set(beat.fx, .8, beat.fz); this.storyOffset.setFromSphericalCoords(13, this.view.polar, this.view.azimuth);
        this.view.cinematic({ position: this.storyFocus.clone().add(this.storyOffset).toArray() as [number, number, number], target: this.storyFocus.toArray() as [number, number, number] });
        this.storyFraming = true;
      } else if (this.storyFraming) { this.storyFraming = false; this.view.follow(); }
      this.updateEnding();
      this.view.update(player.transform, seconds);
      this.playerPosition.set(player.transform.x, player.transform.y - 0.5, player.transform.z);
      if (this.lookdev) this.occlusion.update(this.camera, this.playerPosition, seconds, this.lookdev.playerMeshes);
    }
  }
  /** Photo spots are only registered by the current scenario. */
  preset(name: string): void {
    if (this.world.scenario === 'L3' && ['l3-mainstreet-w2', 'l3-driving', 'l3-checkpoint', 'l3-safe-zone'].includes(name)) {
      const anchors = this.world.missions!.def.anchors;
      const target = name === 'l3-driving' ? this.world.entities.get(this.world.missions!.state.actors.sedan)?.transform ?? anchors.sedan : name === 'l3-mainstreet-w2' ? { x: anchors.sedan.x, z: anchors.sedan.z-6 } : anchors[name === 'l3-checkpoint' ? 'barrier' : 'camp'];
      this.view.preset(name, { position: [target.x+20, 24, target.z+22], target: [target.x, .4, target.z] }); this.update(1); return;
    }
    const reviewSpot = lookViewpoints.find(spot => spot.id === name);
    if (reviewSpot) {
      this.view.reset(reviewSpot); this.view.spot = name;
      // Crowd physics may push the survivor; the stress fixture must still measure the fixed worst view.
      if (this.world.scenario === 'perf-l1-foliage-200') this.view.preset(name, { position: [this.camera.position.x, this.camera.position.y, this.camera.position.z], target: [reviewSpot.x, 0, reviewSpot.z] });
      this.update(1); return;
    }
    if (name === 'hud-golden') {
      const player = this.world.entities.get(1)!.transform;
      this.view.preset(name, { position: [player.x + 15, 18, player.z + 15], target: [player.x, .4, player.z] }); this.update(1); return;
    }
    if (this.npcs && (name === 'turning-probe' || name === 'corgi')) { this.view.preset(name, { position: name === 'corgi' ? [5, 3, 6] : [8, 5, 8], target: name === 'corgi' ? [0, .4, 2] : [5, .6, 0] }); this.update(1); return; }
    if (name === 'perf-horde' && this.crowd) { this.view.preset(name, { position: [24, 28, 18], target: [0, .5, -5] }); this.update(1); return; }
    if (name === 'horde-readability' && this.crowd) { this.view.preset(name, { position: [15, 15, 19], target: [0, 0.5, -1] }); this.update(1); return; }
    if (name === 'interact-ui' && this.world.interactables) {
      const p = this.world.entities.get(1)!.transform;
      this.view.preset(name, { position: [p.x + 15, 18, p.z + 15], target: [p.x, .4, p.z] }); this.update(1); return;
    }
    if (this.world.vehicles && name === 'vehicle') { this.view.preset(name, { position: [-9, 6, 21], target: [0, .8, 12] }); this.update(1); return; }
    // E27 labs: the game camera geometry (radius 19, max zoom-out 1.45×) centred on the blast origin.
    if ((this.world.scenario?.startsWith('blast') || this.world.scenario === 'smoke-lab') && (name === 'blast' || name === 'blast-wide' || name === 'blast-car')) { const k = name === 'blast-wide' ? 1.45 : 1, [x, z] = name === 'blast-car' ? [7, -3] : [0, 0]; this.view.preset(name, { position: [x + 10.9 * k, 11.2 * k, z + 10.9 * k], target: [x, 0, z] }); this.update(1); return; }
    if (this.world.combat && name === 'aim') { this.view.preset(name, combatPhotoSpots.aim); this.update(1); return; }
    if (this.world.scenario?.startsWith('vfx') || this.world.scenario === 'blood-probe' || this.world.scenario === 'gore-probe') {
      if (!['blood-probe', 'gore-probe', 'vfx-stress', 'vfx-showcase', 'L4', 'L6', 'lunge', 'charge', 'splash', 'bloated'].includes(name)) throw new Error(`Unknown VFX photo spot: ${name}`);
      if (name === 'L4' || name === 'L6') this.lighting?.set(name);
      this.view.preset(name, { position: [15, 18, 15], target: [0, 0, 0] }); this.update(1); return;
    }
    if(this.districts){const pose=this.districts.spots.get(name);if(!pose)throw new Error(`Unknown district photo spot: ${name}`);this.view.preset(name,pose);this.update(1);return;}
    if (this.character) {
      const poses = { front: [7, 2.5, 0], back: [-7, 2.5, 0], left: [0, 2.5, -7], right: [0, 2.5, 7], gameplay: [15, 18, 15] } as const;
      const position = poses[name as keyof typeof poses];
      if (!position) throw new Error(`Unknown survivor photo spot: ${name}`);
      this.view.preset(name, { position: [...position], target: [0, 0.7, 0] }); this.update(1); return;
    }
    const pose = photoSpots[name as keyof typeof photoSpots];
    if (!this.lookdev || !pose) throw new Error(`Unknown photo spot: ${name}`);
    this.view.preset(name, pose); this.update(1);
  }
  setLook(patch: LookPatch): void { this.look.set(patch); this.applyLook(); }
  resetLook(): void { this.look.reset(); this.applyLook(); }
  private applyLook(): void {
    this.lighting?.applyLook(); this.materials?.applyLook(); this.postFx?.applyLook(); this.districts?.applyLook();
    this.update(1);
  }
  /** Render settings only; persistence and gameplay accessibility remain owned by E14. */
  settings(patch: { cameraShake?: boolean; bloom?: boolean; cheapDof?: boolean; timeOfDay?: TimeOfDay; occludersVisible?: boolean; idPass?: boolean; windowMask?: boolean; foliageMask?: boolean | 'crowns'; foliageReveal?: boolean; foliageVisible?: boolean } & VfxSettings): void {
    this.vfx?.set(patch);
    if (patch.gore !== undefined || patch.vfx !== undefined) this.crowd?.setGoreEnabled(this.vfx?.snapshot().enabled === true && this.vfx.snapshot().gore === 'Full');
    if (patch.colorblind !== undefined) this.vfxSettings.colorblind = patch.colorblind;
    if (patch.vfx !== undefined) this.vfxSettings.vfx = patch.vfx;
    if (patch.gore !== undefined) this.vfxSettings.gore = patch.gore;
    if (patch.flashReduction !== undefined) { this.vfxSettings.flashReduction = patch.flashReduction; if (this.labAccident) this.labAccident.flashReduction = patch.flashReduction; }
    if (patch.quality !== undefined) this.vfxSettings.quality = patch.quality;
    if (patch.slowMotion !== undefined) this.vfxSettings.slowMotion = patch.slowMotion;
    if (patch.cameraShake !== undefined) { this.view.cameraShake = patch.cameraShake; this.advance(0); }
    if (patch.bloom !== undefined && this.postFx) this.postFx.bloomEnabled.value = Number(patch.bloom);
    if (patch.cheapDof !== undefined) { this.dofEnabled = patch.cheapDof; this.postFx?.setDof(this.dofEnabled); }
    if (patch.timeOfDay !== undefined) this.lighting?.set(patch.timeOfDay);
    if (patch.occludersVisible !== undefined) this.occlusion.visible = patch.occludersVisible;
    if(patch.windowMask!==undefined)this.windowMask=patch.windowMask;
    if(patch.foliageMask!==undefined)this.foliageMask=patch.foliageMask;
    if(patch.foliageReveal!==undefined)this.districts?.setFoliageReveal(patch.foliageReveal);
    if(patch.foliageVisible!==undefined)this.districts?.setFoliageVisible(patch.foliageVisible);
    if (patch.idPass !== undefined) this.idPass = patch.idPass;
    this.update(1);
  }
  /** Project a world point to viewport-normalized coordinates, for masks and input integration. */
  project(x: number, y: number, z: number): number[] { return this.projection.set(x, y, z).project(this.camera).toArray(); }
  crowdFigures() { return [...(this.crowd?.getState().figures ?? []), ...(this.npcs?.snapshot().civilians.figures ?? [])]; }
  getState() {
    const materialInventory = new Map<string, { name: string; palette: boolean; plainLit: boolean; emissive: number }>();
    this.scene.traverse((child) => { if (child instanceof Mesh) for (const material of Array.isArray(child.material) ? child.material : [child.material]) materialInventory.set(material.uuid, { name: material.name, palette: material instanceof PaletteMaterial, plainLit: (material instanceof MeshLambertNodeMaterial || material instanceof MeshStandardMaterial) && !(material instanceof PaletteMaterial), emissive: material.userData.emissiveStrength ?? 0 }); });
    return { bicycle: this.bicycle?.snapshot() ?? null, quality: this.quality, pixelRatio: this.renderer.getPixelRatio(), postFx: this.postFx?.snapshot() ?? null, moveMarker: this.destination ? { visible: this.destination.visible, position: this.destination.position.toArray() } : null, missionMarker:this.marker ? {visible:this.marker.visible,position:this.marker.position.toArray()} : null, districts:this.districts?.getState()??null, backend: this.renderer.selectedBackend, camera: this.view.getState(), lighting: this.lighting?.getState() ?? null,
      npcs: this.npcs?.snapshot() ?? null,
      vehicles: [...(this.vehicles?.snapshot() ?? []), ...(this.vehicleFeedback?.getState() ?? []).map(v => ({ ...v, wheels: [], brake: 0, sirens: [], placeholder: true }))], entityAssets: this.entityAssets?.getState() ?? null, character: this.character?.getState() ?? null, crowd: this.crowd?.getState() ?? null, actions: this.actions?.getState() ?? null,
      vfx: this.vfx?.snapshot() ?? null, infected: this.crowd?.getGoreState() ?? [],
      materials: [...materialInventory.values()], occlusion: this.occlusion.getState(),
      probes: this.lookdev ? { lamp: this.project(...this.lookdev.lampHead.position.toArray() as [number, number, number]), shadow: this.project(...this.lookdev.shadowProbe.position.toArray() as [number, number, number]) } : null };
  }
  private syncMission(): void {
    const mission = this.world.missions, cinematic = mission?.state.cinematic;
    if (mission?.def.id === 'L3') this.districts?.setEmergencyPower(!mission.state.states.collapsed);
    if (cinematic && this.cinematicId !== cinematic.id) { this.cinematicId = cinematic.id; this.view.cinematic(mission!.def.cinematics[cinematic.id]); }
    else if (!cinematic && this.cinematicId) { this.cinematicId = null; this.view.follow(); }
    if (mission?.state.timeOfDay && this.lighting?.preset !== mission.state.timeOfDay) this.lighting?.set(mission.state.timeOfDay);
  }
  update(alpha = 1): void {
    if (this.missionHidden && this.missionUI) this.missionUI.root.hidden = true;
    if (this.warming || this.frozenFrame) { if (!this.missionHidden) this.missionUI?.update(this.camera, innerWidth, innerHeight); return; }
    if (this.contextLost) return;
    if (this.destination) {
      const target = this.world.controls.moveTarget; this.destination.visible = target != null;
      if (target) this.destination.position.set(target.x, .12, target.z);
    }
    const profileStart = this.renderer.profile ? performance.now() : 0;
    // The rig steps with the sim; render it between the last two tick poses like every other transform.
    this.view.present(alpha);
    this.syncMission();
    const current = this.world.entities.get(1)?.transform, previous = this.world.previousPlayer;
    const survivor = this.world.entities.get(1)?.survivor;
    if (!this.bicycle && this.world.vehicles?.bicycle.entity && this.materials) { this.bicycle = new BicycleView(this.world, this.materials); this.scene.add(this.bicycle); }
    this.bicycle?.update(this.camera, alpha); // Sample one bike frame for its saddle, lean and rider.
    if (this.character && current && survivor) {
      // Portrait hero readability supplements the seven-metre camera floor; collision stays in metres.
      this.character.scale.setScalar(this.camera.aspect < 1 ? 1.25 : 1);
      this.character.position.set(lerp(previous?.x ?? current.x, current.x, alpha), lerp(previous?.y ?? current.y, current.y, alpha) - 0.7, lerp(previous?.z ?? current.z, current.z, alpha));
      const from = previous?.yaw ?? current.yaw;
      const striking = !!survivor.attack && this.world.tick < survivor.attack.endsAt;
      const riding = this.world.entities.get(1)?.riding;
      const mountedFrame = riding !== undefined && this.bicycle?.frameOrientation(this.bikeOrientation);
      const stopped = this.vfx?.hitStop.active(this.vfx.time) ?? false;
      if (stopped && this.vfx!.hitStop.started !== this.frozenStarted && this.frozenPose) {
        this.frozenStarted = this.vfx!.hitStop.started; this.hitStopTick = this.world.tick;
        const velocity = this.frozenPose.velocity, checkpoint = this.frozenPose.checkpoint;
        Object.assign(this.frozenPose, survivor);
        this.frozenPose.velocity = velocity; Object.assign(velocity, survivor.velocity);
        this.frozenPose.checkpoint = checkpoint; Object.assign(checkpoint, survivor.checkpoint);
      }
      this.character.face(mountedFrame ? current.yaw : from + Math.atan2(Math.sin(current.yaw - from), Math.cos(current.yaw - from)) * alpha, (this.world.tick + alpha) / 60, striking, mountedFrame ? this.bikeOrientation : undefined,
        striking && survivor.attack!.style === 'roundhouse' ? roundhouseSpin(survivor.attack!, (stopped ? this.hitStopTick : this.world.tick) + (stopped ? 1 : alpha) - 1) : 0);
      // E19 courier: the bicycle sim (lane F) marks the rider; the bike's crank/steer drive the pose.
      const bike = riding === undefined ? undefined : (this.world.entities.get(riding) as { bicycle?: { pedal: number; steer: number } } | undefined)?.bicycle;
      this.character.update(stopped && this.frozenPose ? this.frozenPose : survivor, stopped ? this.hitStopTick : this.world.tick, stopped ? 1 : alpha,
        riding === undefined ? undefined : { pedal: bike?.pedal ?? this.world.tick * .12, steer: bike?.steer ?? 0 });
      // Riding: the pelvis sits on the saddle, measured from the bike's `seat` node every frame (any heading, lean or turn).
      if (this.character.skinActive) this.character.applyRideContacts(riding !== undefined ? this.bicycle?.riderContacts() : undefined);
      else if (riding !== undefined && this.bicycle?.seatWorld(this.seat)) {
        this.character.seatPelvis(this.seat, -.04);
        if (this.bicycle.gripsWorld(this.gripL, this.gripR)) this.character.holdHandlebar(this.gripL, this.gripR);
      }
    }
    if (this.cube && current) {
      this.cube.position.set(lerp(previous?.x ?? current.x, current.x, alpha), lerp(previous?.y ?? current.y, current.y, alpha), lerp(previous?.z ?? current.z, current.z, alpha));
      this.cube.rotation.y = current.yaw;
    }
    if (this.lookdev && current && !this.crowd) {
      this.lookdev.player.position.set(lerp(previous?.x ?? current.x, current.x, alpha), current.y - 0.5, lerp(previous?.z ?? current.z, current.z, alpha));
      this.lookdev.player.rotation.y = current.yaw;
      this.playerPosition.copy(this.lookdev.player.position);
      this.occlusion.update(this.camera, this.playerPosition, 0, this.lookdev.playerMeshes);
    }
    if (this.character) this.character.visible = !this.world.entities.get(1)?.hidden;
    if (!this.vehicles && this.world.vehicles?.cars.size && this.materials) { this.vehicles = new VehicleView(this.world, this.materials, this.view, this.quality === 'low'); this.scene.add(this.vehicles); }
    this.vehicles?.update(alpha); this.l2Props?.update();
    if (this.actions) this.actions.visible = !this.world.entities.get(1)?.hidden;
    this.marker?.update(); if (!this.missionHidden) this.missionUI?.update(this.camera,innerWidth,innerHeight);
    this.crowd?.update(this.view, alpha); this.contactShadows?.update(); this.actions?.update();
    this.entityAssets?.update();
    this.interactions?.update(this.camera); this.npcs?.update(this.camera, alpha);
    this.flashOverlay.style.opacity = String(Math.max(this.vfx?.flash ?? 0, this.labAccident?.flash ?? 0));
    this.fixtureProps?.update();
    if (this.world.props) this.districts?.syncProps(this.world.props.items);
    this.lighting?.update(this.view); this.updateLights(); this.districts?.updateLods(this.view);
    this.districts?.cull(this.view, this.quality);
    const locked = this.world.controls.snapshot()?.attack;
    const lockedEntity = locked ? this.world.entities.get(locked.id) : undefined;
    this.districts?.updateFoliage(this.view, current, lockedEntity && lockedEntity.health.current > 0 ? lockedEntity.transform : undefined);
    this.wireframe?.update();
    // We own RAF, so reset counters per render rather than relying on setAnimationLoop.
    this.renderer.info.reset(); this.renderedFrames++;
    this.renderer.beginProfile(this.camera);
    const renderStart = profileStart ? performance.now() : 0;
    if (profileStart) this.updateCpuMs = renderStart - profileStart;
    if(this.foliageMask) {
      const backgroundNode=this.scene.backgroundNode; this.scene.backgroundNode=null;
      const background=this.scene.background, fog=this.scene.fog, shadow=this.renderer.shadowMap.enabled;
      this.scene.background=new Color(0); this.scene.fog=null; this.renderer.shadowMap.enabled=false;
      this.scene.traverse(child => {
        if (!(child instanceof Mesh)) return;
        this.savedMaterials.set(child, child.material);
        const source = child.material as PaletteMaterial;
        if ((child.name === 'grass-gpu-wind' && this.foliageMask !== 'crowns') || source.name === 'pal_leaf-card-crown') {
          if (!this.foliageMasks.has(source)) this.foliageMasks.set(source, new MeshBasicNodeMaterial({ color: '#ffffff', side: source.side, alphaTest: source.alphaTest, alphaToCoverage: source.alphaToCoverage, opacityNode: source.opacityNode, positionNode: source.positionNode }));
          child.material=this.foliageMasks.get(source)!;
        } else child.material=this.idBackground;
      });
      this.renderer.render(this.scene,this.camera);
      for (const [mesh, material] of this.savedMaterials) mesh.material=material;
      this.savedMaterials.clear(); this.scene.background=background;this.scene.backgroundNode=backgroundNode;this.scene.fog=fog;this.renderer.shadowMap.enabled=shadow;
    } else if(this.windowMask&&this.districts){
      const backgroundNode=this.scene.backgroundNode;this.scene.backgroundNode=null;const background=this.scene.background,fog=this.scene.fog,shadow=this.renderer.shadowMap.enabled;
      this.scene.background=new Color(0);this.scene.fog=null;this.renderer.shadowMap.enabled=false;this.districts.mask(true);const heroVisible=this.character?.visible;if(this.character)this.character.visible=false;this.renderer.render(this.scene,this.camera);if(this.character)this.character.visible=heroVisible!;this.districts.mask(false);this.scene.background=background;this.scene.backgroundNode=backgroundNode;this.scene.fog=fog;this.renderer.shadowMap.enabled=shadow;
    } else if (this.idPass && (this.lookdev || this.character)) {
      const backgroundNode = this.scene.backgroundNode; this.scene.backgroundNode = null;
      const background = this.scene.background, fog = this.scene.fog, shadow = this.renderer.shadowMap.enabled;
      this.scene.background = new Color(0); this.scene.fog = null; this.renderer.shadowMap.enabled = false;
      this.scene.traverse((child) => {
        if (child instanceof Mesh) { this.savedMaterials.set(child, child.material); let hero = this.lookdev?.playerMeshes.includes(child) ?? false;
          if (this.character) for (let parent = child.parent; parent; parent = parent.parent) if (parent === this.character) { hero = true; break; }
          const source = child.material as PaletteMaterial;
          if (!hero && source.name === 'pal_leaf-card-crown') {
            if (!this.foliageIdMasks.has(source)) this.foliageIdMasks.set(source, new MeshBasicNodeMaterial({ color: '#000000', side: source.side, alphaTest: source.alphaTest, alphaToCoverage: source.alphaToCoverage, opacityNode: source.opacityNode, positionNode: source.positionNode }));
            child.material = this.foliageIdMasks.get(source)!;
          } else child.material = hero ? this.idPlayer : this.idBackground; }
      });
      this.idPlayer.depthTest = !this.occlusion.getState().some((building) => building.blocked);
      this.renderer.render(this.scene, this.camera);
      for (const [mesh, material] of this.savedMaterials) mesh.material = material;
      this.savedMaterials.clear(); this.scene.background = background; this.scene.backgroundNode = backgroundNode; this.scene.fog = fog; this.renderer.shadowMap.enabled = shadow;
    } else if (this.postFx) this.postFx.render(); else this.renderer.render(this.scene, this.camera);
    if (profileStart) this.renderCpuMs = performance.now() - renderStart;
  }
  /** E25 lighting-pass counters for perf(): light-field CPU ms and pools, shadow maps, the promoted hero shadow light. */
  lightingPerf() {
    const field = this.lighting?.field.snapshot();
    return field ? { lightFieldMs: field.ms, lightPools: field.drawn, lightCandidates: field.candidates, shadowMaps: this.renderer.shadowMap.enabled ? 1 : 0, heroShadow: (this.lighting?.fieldShadow.value ?? 0) > .5 ? 1 : 0, preset: this.lighting!.preset } : null;
  }
  /** E25 light field of the loaded scene (E27 transients hook in here). */
  get lightField() { return this.lighting?.field ?? null; }
  /** E25 light field: layout pools plus per-frame vehicle lamps and the survivor aura, one pass before the scene. */
  private updateLights(): void {
    const lighting = this.lighting; if (!lighting) return;
    const field = lighting.field, hero = this.character?.visible && this.world.entities.get(1) ? this.character.position : null;
    if (hero) lighting.hero.value.copy(hero); else lighting.hero.value.set(0, -100, 0);
    if (field.active) {
      const aura = timeOfDayPresets[lighting.preset].aura ?? 0;
      if (hero && aura > 0) field.push(auraLight(hero.x, hero.z, aura));
      this.vehicles?.pushLights(field);
      // Pickups keep a small cool glint pool so loot stays findable in the dark.
      for (const entity of this.world.entities.iterate()) if (entity.pickup && !entity.hidden) field.push(pickupLight(entity.transform.x, entity.transform.z));
    }
    lighting.setHeroLight(hero && field.active ? field.heroAt(hero.x, hero.z) : null, hero ?? this.view.focus, this.world.tick / 60);
    field.update(this.view.focus.x, this.view.focus.z, this.world.tick / 60);
    field.render(this.renderer);
  }
  async ready(): Promise<void> {
    await this.warming;
    // Once a test has begun the mission, snapshots/heap checks settle the same streamed
    // residency on every load. A briefing snapshot waits only for its visible assets.
    if (this.params.get('test') === '1' && this.world.missions?.state.phase !== 'briefing') await this.preparation;
    this.districts?.updateLods(this.view); this.crowd?.update(this.view);
    await Promise.all([this.districts?.ready(), this.crowd?.ready(), this.vehicles?.ready(), this.entityAssets?.ready(), this.interactions?.synchronize()]); }
  reset(): void {
    this.playSeconds = 0; this.generation++; this.pendingPreparation = null; this.preparation = null; this.warming = null;
    if (this.background) { loadGate.setPaced(true); loadGate.background = true; } else loadGate.setPaced(false);
    this.contactShadows?.removeFromParent(); this.contactShadows?.dispose(); this.contactShadows = null;
    if (this.npcs) { this.scene.remove(this.npcs); this.npcs.dispose(); this.npcs = null; }
    if (this.labAccident) { this.scene.remove(this.labAccident.column); this.labAccident.dispose(); this.labAccident = null; }
    if (this.vfx) { this.scene.remove(this.vfx); this.vfx.dispose(); this.vfx = null; }
    if (this.vehicleFeedback) { this.scene.remove(this.vehicleFeedback); this.vehicleFeedback.dispose(); this.vehicleFeedback = null; }
    this.missionUI?.reset(); this.cinematicId = null; if(this.marker){this.scene.remove(this.marker);this.marker.dispose();this.marker=null;}
    if (this.fixtureProps) { this.scene.remove(this.fixtureProps); this.fixtureProps.dispose(); this.fixtureProps = null; }
    if (this.interactions) { this.scene.remove(this.interactions); this.interactions.dispose(); this.interactions = null; }
    if (this.entityAssets) { this.scene.remove(this.entityAssets); this.entityAssets.dispose(); this.entityAssets = null; }
    if (this.vehicles) { this.scene.remove(this.vehicles); this.vehicles.dispose(); this.vehicles = null; }
    if (this.l2Props) { this.scene.remove(this.l2Props); this.l2Props.dispose(); this.l2Props = null; }
    if (this.bicycle) { this.scene.remove(this.bicycle); this.bicycle.dispose(); this.bicycle = null; }
    this.windowMask=false; this.foliageMask=false;
    for (const material of this.foliageMasks.values()) material.dispose(); this.foliageMasks.clear();
    for (const material of this.foliageIdMasks.values()) material.dispose(); this.foliageIdMasks.clear();
    this.postFx?.dispose();this.postFx = null; this.dofEnabled = false;
    for (const district of this.preparedDistrictViews.values()) { this.scene.remove(district); district.dispose(); }
    if (this.districts && !this.preparedDistrictViews.has(this.districts.world)) { this.scene.remove(this.districts); this.districts.dispose(); }
    this.preparedDistrictViews.clear(); this.districts = null;
    this.frozenStarted = -1; this.frozenPose = null;
    if (this.crowd) { this.scene.remove(this.crowd); this.crowd.dispose(); this.crowd = null; }
    if (this.actions) { this.scene.remove(this.actions); this.actions.dispose(); this.actions = null; }
    if (this.character) { this.scene.remove(this.character); this.character.dispose(); this.character = null; }
    if (this.lookdev) { this.scene.remove(this.lookdev); this.lookdev.dispose(); this.lookdev = null; }
    if(this.materials!==this.districtResources?.materials)this.materials?.dispose();this.materials=null;
    if(this.lighting===this.districtResources?.lighting)this.scene.remove(this.lighting.sun,this.lighting.sun.target,this.lighting.hemisphere);else this.lighting?.dispose();this.lighting=null;
    this.districtResources?.registry.dispose(); this.districtResources?.grassMaterial.dispose(); this.districtResources?.materials.dispose(); this.districtResources?.lighting.dispose(); this.districtResources = null;
    this.occlusion.reset(); this.idPass = false; this.scene.fog = null; this.scene.backgroundNode = null; this.scene.background = new Color('#293447'); this.renderer.shadowMap.enabled = false;
    for (const mesh of this.meshes) {
      this.scene.remove(mesh); mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (!(material instanceof PaletteMaterial)) material.dispose();
    }
    this.meshes.length = 0; this.cube = null; this.destination = null;
    if (this.wireframe) { this.scene.remove(this.wireframe.lines); this.wireframe.dispose(); this.wireframe = null; }
    this.renderer.releaseLevelCaches();
  }
  /** Newly spawned E11 objects are loaded before screenshot/shader readiness resolves. */
  async synchronizeInteractions(): Promise<void> { await this.interactions?.synchronize(); }
  dispose(): void { this.reset(); this.missionUI?.dispose(); this.missionUI=null; window.removeEventListener('resize', this.resize); this.idPlayer.dispose(); this.idBackground.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); this.flashOverlay.remove(); }
}
