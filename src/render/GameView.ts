import { l6Doors, l6Entries } from '../data/l6';
import { MilitaryPerimeter } from './MilitaryPerimeter';
import { l3, l3AttackView } from '../data/l3';
import { epiloguePull } from '../sim/missions/LevelTenEpilogue';
import { CrowdAccessories } from './characters/CrowdAccessories';
import { carTransitionPose } from './characters/carTransition';
import { WeatherView } from './WeatherView';
import { PropFixtureView } from './PropFixtureView';
import { pickBodies } from './characters/PickBodies';
import { ContactShadows } from './ContactShadows';
import { NpcView } from './npc/NpcView';
import { lookViewpoints } from '../data/lookViewpoints';
import { LookUniforms } from './LookUniforms';
import type { LookPatch } from '../data/lookPatch';
import { qualityBudgets, type QualityTier } from '../core/Quality';
import { NoToneMapping, ColorManagement, Raycaster, Vector2 } from 'three/webgpu';
import { HealthBars } from './HealthBars';
import { CrowdView } from './CrowdView';
import { MissionUI } from '../ui/MissionUI';
import { ObjectiveMarker } from './ObjectiveMarker';
import { SurvivorRings } from './SurvivorRings';
import { VehicleView } from './VehicleView';
import { L2Props } from './L2Props';
import { L3Props } from './L3Props';
import { BicycleView } from './BicycleView';
import { combatPhotoSpots } from '../../tests/fixtures/scenarios/combat-arena';
import { ActionView } from './ActionView';
import type { SurvivorState } from '../data/survivor';
import { CharacterView } from './characters/CharacterView';
import { useSkinnedCourier } from './characters/RiderContacts';
import { Box3, BoxGeometry, Color, Group, Mesh, MeshBasicNodeMaterial, PlaneGeometry, RingGeometry, Scene, MeshLambertNodeMaterial, MeshStandardMaterial, type Material } from 'three/webgpu';
import type { Lifecycle } from '../core/Lifecycle';
import { lerp } from '../core/maths';
import type { SimWorld } from '../sim/world/SimWorld';
import { MeshGridMaterial } from './MeshGridMaterial';
import { PhysicsWireframe } from './PhysicsWireframe';
import { View, type CameraPose } from './View';
import { Renderer } from './Renderer';
import { preRender, incrementalPreRender } from './PreRenderer';
import { Lighting } from './Lighting';
import { Materials } from './Materials';
import { Lookdev } from './Lookdev';
import { Occlusion } from './Occlusion';
import { projectReveal, seeThrough } from './SeeThrough';
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
import { MountedGunView } from './MountedGunView';
import { EntityAssets } from './EntityAssets';
import { loadMeasure } from '../assets/loadTiming';
import { loadGate } from '../assets/loadGate';
import { lodPolicy } from './lodPolicy';
import { layoutLights } from './WorldLights';
import { footprint, auraLight, pickupLight } from './LightField';
import { timeOfDay as timeOfDayPresets } from '../data/timeOfDay';
import { Environment } from './lighting/Environment';
import { courierForegroundWanted } from './courierForeground';

/** Presentation composition: E01 fixture or E02 lookdev, with state flowing only from sim to view. */
/** Bat roundhouse body turn (presentation only; the sim sweep strikes each target as this angle passes it):
 * a short coil against the swing in the windup, the full circle linearly over the active window. */
export function roundhouseSpin(attack: { started: number; activeAt: number; recoveryAt: number }, time: number): number {
  const u = time - attack.started, a = attack.activeAt - attack.started, r = attack.recoveryAt - attack.started;
  if (u < a) { const t = Math.max(0, u) / Math.max(1, a); return -.45 * t * t * (3 - 2 * t); }
  return u >= r ? 0 : -.45 + (Math.PI * 2 + .45) * (u - a) / Math.max(1, r - a);
}
export class GameView implements Lifecycle {
  // The scene root stays at identity; moving views update their own matrices.
  readonly scene = Object.assign(new Scene(), { matrixAutoUpdate: false });
  private missionUI: MissionUI | null = null;
  private marker: ObjectiveMarker | null = null;
  private survivorRings: SurvivorRings | null = null;
  private cinematicId: string | null = null;
  private departureShot = false;
  private storyFraming = false;
  private l5StationView = false;
  private l5ClosingPose: CameraPose | null = null;
  private readonly l5ClosingTarget = new Vector3();
  private l3AttackScale = 1;
  private courierForeground = false;
  /** Scene Lab courier-visibility probe: hide the courier and/or every crowd figure (including the Mega) for one screenshot. */
  private readonly revealSubject = new Box3();
  private readonly revealVehicle = new Box3();
  private readonly revealPet = new Box3();
  private companionId = -1;
  private companionSearch = 0;
  private probeVisibilityPending = false;
  private infectedIdPass = false;
  private readonly infectedIdMasks = new Map<Material, MeshBasicNodeMaterial[]>();
  private solidCutProbeOff = false;
  private probeHide = { courier: false, crowd: false, environment: false, bars: false };
  private readonly storyFocus = new Vector3();
  private readonly storyOffset = new Vector3();
  readonly view = new View();
  readonly camera = this.view.camera;
  renderer: Renderer;
  private environment?: Environment;
  contextLost = false;
  private lostRendererDisposal: Promise<void> | null = null;
  renderedFrames = 0;
  updateCpuMs = 0;
  renderCpuMs = 0;
  private readonly meshes: Mesh[] = [];
  private vehicles: VehicleView | null = null;
  private l2Props: L2Props | null = null;
  private l3Props: L3Props | null = null;
  private bicycle: BicycleView | null = null;
  private readonly seat = new Vector3();
  private readonly glance = new Vector3();
  private readonly gripL = new Vector3();
  private readonly gripR = new Vector3();
  private actions: ActionView | null = null;
  private contactShadows: ContactShadows | null = null;
  private crowd: CrowdView | null = null;
  private healthBars: HealthBars | null = null;
  private readonly barScene = new Scene();
  private readonly barOccluded = (target: Vector3) => this.districts?.occludesBar(this.camera, target) ?? false;
  private readonly preparedDistrictViews = new Map<SimWorld['districts'], DistrictView>();
  private pendingPreparation: { shared: NonNullable<GameView['districtResources']>; instanceCapacity?: number } | null = null;
  private preparation: Promise<void> | null = null;
  private epiloguePrepared: object | null = null;
  /** Pending L1 shader warm-up while the briefing is shown (see load()). */
  warming: Promise<void> | null = null;
  private shadowWarmup: ReturnType<typeof incrementalPreRender> | null = null;
  loadProgress?: (completed: number, total: number) => void;
  /** Speculative menu-time level load: keep the mission UI hidden until the player picks the level. */
  missionHidden = false;
  /** Menu-time (speculative) load: pace heavy steps one per frame and yield to player input. */
  background = false;
  private frozenFrame: HTMLCanvasElement | null = null;
  private frozenUpdates = false;
  /** Show a still copy of the current frame (e.g. the title backdrop) over the canvas while a level
   * loads and warms up behind the menus/briefing; drawing is suspended until unfreeze(). */
  freeze(keepUpdates = false): void {
    if (this.frozenFrame) return;
    this.frozenUpdates = keepUpdates;
    const source = this.renderer.domElement, copy = document.createElement('canvas');
    copy.width = source.width; copy.height = source.height;
    copy.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
    try { this.update(1); copy.getContext('2d')?.drawImage(source, 0, 0); } catch { /* best effort */ }
    source.after(copy); this.frozenFrame = copy;
  }
  unfreeze(): void { this.frozenFrame?.remove(); this.frozenFrame = null; this.frozenUpdates = false; if (!this.warming) this.update(1); }
  get frozen(): boolean { return this.frozenFrame !== null; }
  private loadingPresentedAt = -Infinity;
  /** Keep the compositor presenting during handover work. The frozen canvas
   * preserves the last picture while the opaque loading card covers it. A
   * cheap canvas submission avoids Chrome's no-draw RAF pacing (~100 ms). */
  presentLoading(): void {
    if (!this.frozenFrame || this.background) return;
    const now = performance.now();
    if (now - this.loadingPresentedAt < 1000 / 60) return;
    this.loadingPresentedAt = now;
    const target = this.renderer.getRenderTarget();
    try { this.renderer.setRenderTarget(null); this.renderer.clear(); }
    finally { this.renderer.setRenderTarget(target); }
  }
  private generation = 0;
  private npcs: NpcView | null = null;
  /** Scene Lab drives the same authored metro leaf as the L5 mission clock. */
  metroShutter(closed: number): void { this.districts?.updateMetroShutter(closed); }
  get propUploads(): number { return this.fixtureProps?.uploads ?? this.districts?.propUploads ?? 0; }
  private fixtureProps: PropFixtureView | null = null;
  private interactions: InteractionView | null = null;
  private entityAssets: EntityAssets | null = null;
  private mountedGunView: MountedGunView | null = null;
  weather: WeatherView | null = null;
  vfx: Vfx | null = null;
  private labAccident: LabAccidentFx | null = null;
  private labWindows: { prewarmWindows(): () => void } | null = null;
  private vehicleFeedback: VehicleFeedback | null = null;
  private readonly vfxSettings: VfxSettings = {};
  private hitStopTick = 0;
  private frozenStarted = -1;
  private frozenPose: SurvivorState | null = null;
  private destination: Mesh | null = null;
  private militaryPerimeter: MilitaryPerimeter | null = null;
  private readonly bikeOrientation = new Quaternion();
  private cube: Mesh | null = null;
  private character: CharacterView | null = null;
  private wireframe: PhysicsWireframe | null = null;
  readonly look = new LookUniforms();
  private lighting: Lighting | null = null;
  private gloomShown = 1;
  private materials: Materials | null = null;
  private districtResources:{lighting:Lighting;materials:Materials;registry:DistrictAssets;phase:ReturnType<typeof windPhase>;grassMaterial:ReturnType<typeof Grass.material>}|null=null;
  private resourceDistricts = '';
  private districts:DistrictView|null=null;
  private windowMask=false;
  private foliageMask: boolean | 'crowns'=false;
  private readonly foliageMasks = new Map<Material, MeshBasicNodeMaterial>();
  private readonly foliageIdMasks = new Map<Material, MeshBasicNodeMaterial>();
  private lookdev: Lookdev | null = null;
  private postFx: PostFx | null = null;
  private retiredPostFx: ReturnType<PostFx['diagnostics']> | null = null;
  private dofEnabled = false;
  private readonly occlusion = new Occlusion();
  private readonly playerPosition = new Vector3();
  private readonly projection = new Vector3();
  private idPass = false;
  private weatherPowerRevision = 0;
  private weatherProbeAsset: string | null = null;
  weatherMask(asset: string | null): void { this.weatherProbeAsset = asset; }
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
  onMissionChange: () => void = () => this.update(1);
  refreshMissionUI(): void { if (!this.missionHidden) this.missionUI?.update(this.camera, innerWidth, innerHeight); }
  async init(): Promise<void> {
    await this.renderer.init(); this.resize();
    this.renderer.domElement.style.display = 'block';
    document.querySelector('#game')!.appendChild(this.renderer.domElement);
    this.missionUI = new MissionUI(this.world, () => this.onMissionChange());
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
    if (changed) this.epiloguePrepared = null;
    if (changed && this.postFx) { const enabled = this.postFx.bloomEnabled.value; this.postFx.dispose(); this.retiredPostFx = this.postFx.diagnostics(); this.postFx = new PostFx(this.renderer, this.scene, this.camera, tier, this.look); this.postFx.bloomEnabled.value = enabled; this.postFx.setDof(this.dofEnabled); this.postFx.applyLook(); }
    this.lighting?.setQuality(tier); this.districts?.setQuality(tier);
    this.vfx?.set({ quality: tier }); this.crowd?.setQuality(tier); this.npcs?.setQuality(tier);
  }
  /** Three's WebGL fallback reports loss but does not rebuild its backend on restore.
   * Recreate renderer GPU state on the same canvas so touch/pointer listeners survive. */
  retireLostRenderer(): void { this.lostRendererDisposal = this.renderer.dispose(); }
  async restoreContext(): Promise<void> {
    const canvas = this.renderer.domElement;
    this.reset(); this.environment?.dispose(); this.environment = undefined; await this.lostRendererDisposal; this.lostRendererDisposal = null;
    this.renderer = new Renderer(this.params, canvas); await this.renderer.init();
    this.resize(); await this.load(); this.contextLost = false; this.update(1);
  }
  async load(): Promise<void> {
    // The crossing survey views span hundreds of metres, including portrait framing.
    this.camera.far = this.world.districts?.districts.some(d => !!d.layout.terrainChunks?.length) ? 1600 : 600;
    this.camera.updateProjectionMatrix();
    const districtKey = this.world.districts?.composition.districts.map(d => `${d.id}:${d.origin.join(',')}`).sort().join('|');
    this.reset(districtKey); this.resourceDistricts = districtKey ?? '';
    // Keep the handover's loading card responsive while the same assets parse
    // and batches assemble; the full cast and all shader variants still load.
    if (this.world.scenario === 'L8') loadGate.setPaced(true);
    const player = this.world.entities.get(1);
    this.view.reset(player?.transform ?? { x: 0, z: 0 }, true);
    let actors: Promise<unknown> | null = null;
    if (this.world.districts) {
      this.renderer.shadowMap.enabled=true;
      if(!this.districtResources){
        const lighting=new Lighting(this.scene, this.look, this.renderer, this.environment ??= new Environment(this.renderer)),materials=new Materials(lighting),registry=new DistrictAssets(materials,this.renderer),phase=materials.wind;
        this.districtResources={lighting,materials,registry,phase,grassMaterial:Grass.material(materials,phase)};
      }
      const shared=this.districtResources;this.lighting=shared.lighting;this.materials=shared.materials;this.scene.add(this.lighting.sun,this.lighting.sun.target,this.lighting.hemisphere,this.lighting.spot,this.lighting.spot.target,this.lighting.practicalEffects);this.lighting.set(this.world.districts.composition.timeOfDay); this.lighting.lamps.state = this.world.lightPower; this.lighting.lamps.update();
      // L1 and L2 share D-GROVE (E20), L3 plays the same outbreak town style on D-CORRIDOR (E21): the same instancing
      // path, spawn focus and close-view warm-up.
      const grove = this.world.scenario === 'L1' || this.world.scenario === 'L2' || this.world.scenario === 'L3' || this.world.scenario === 'L4' || this.world.scenario === 'L5' || this.world.scenario === 'L6' || this.world.scenario === 'L7';
      const instanceCapacity = grove ? this.renderer.attributeInstanceCapacity() : undefined;
      const t=performance.now();
      this.districts=new DistrictView(this.world.districts,this.materials,shared.registry,shared.phase,shared.grassMaterial,this.quality === 'low', instanceCapacity);
      this.character=new CharacterView();
      // L1 objective transitions swap to prepared decay variants without a hitch (M1-22): they load
      // with the level (sharing its prototypes) and are warmed below; their LOD0 streams later.
      const variants = this.world.scenario === 'L1' ? [...this.world.preparedDistricts.values()].filter(prepared => prepared !== this.world.districts).map(prepared => new DistrictView(prepared, this.materials!, shared.registry, shared.phase, shared.grassMaterial, this.quality === 'low', instanceCapacity)) : [];
      // E19: Level 1 is played as the courier (white cap, orange tee, teal bag); same rig/animations.
      const character = this.character.init(this.materials, Boolean(this.world.combat), this.quality === 'low', ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'].includes(this.world.districts.composition.id) || this.world.districts.composition.scene?.courier ? 'courier' : 'survivor', useSkinnedCourier(this.params), this.world.missions?.state?.id === 'L10', this.world.scenario === 'L1' ? this.missionHidden ? null : player?.survivor?.variant : undefined, this.world.scenario === 'L6');
      // Actor models download and bake while the district loads (they do not depend on it).
      actors = this.startActors(character); actors.catch(() => {}); // a district failure must not leave it unhandled
      const initialFocus = grove || this.world.districts.districts.some(d => !!d.layout.terrainChunks?.length) ? this.view.cameraTarget : undefined;
      const heroAtSpawn = this.quality === 'high' && this.renderer.selectedBackend === 'webgl';
      await Promise.all([this.districts.load(1, initialFocus, heroAtSpawn), character, ...variants.map(variant => variant.load(1, initialFocus, heroAtSpawn))]);
      if (this.districts.terrainState()) { this.districts.warmHero = batch => this.warmHidden(batch); this.districts.swapSlot = () => this.swapSlot(); }
      loadMeasure('view:districts+character',t);
      if (grove) {
        this.preparedDistrictViews.set(this.world.districts, this.districts);
        for (const variant of variants) { variant.visible = false; this.preparedDistrictViews.set(variant.world, variant); this.scene.add(variant); }
        // WebGL warms the spawn's close-view LOD0 before play (ANGLE specializes first draws).
        // The rest of the route and its unused LOD1 tier stream after the mission begins.
        if (this.world.scenario === 'L6' || this.quality === 'low') {
          // Phone node builds exceed the frame budget even when compiled asynchronously.
          // Keep its smaller LODs resident and warm them while loading, like the L6 route.
          const route = performance.now();
          await Promise.all([this.districts, ...variants].map(view => view.prepare(this.view.cameraTarget, () => false, this.world.scenario === 'L7' ? 16 : Infinity)));
          loadMeasure('view:route-lods', route);
        } else {
          if (this.quality === 'high' && this.renderer.selectedBackend === 'webgl') { const p = performance.now(); await Promise.all([this.districts, ...variants].map(view => view.prepare(this.view.cameraTarget, () => false, lodPolicy.lod1From))); loadMeasure('view:hero-lod0', p); }
          this.pendingPreparation = { shared, instanceCapacity };
        }
      }
      this.scene.add(this.districts);this.lighting.field.setStatic(layoutLights(this.world.districts));this.lighting.practicalEffects.install(this.world.districts);this.postFx=new PostFx(this.renderer,this.scene,this.camera,this.quality,this.look);
      this.dofEnabled = this.world.districts.composition.id === 'L1'; this.postFx.setDof(this.dofEnabled);
      this.scene.add(this.character);
    } else if (this.world.player) {
      this.renderer.shadowMap.enabled = true;
      this.lighting = new Lighting(this.scene, this.look, this.renderer, this.environment ??= new Environment(this.renderer)); this.materials = new Materials(this.lighting);
      const ground = new Mesh(new PlaneGeometry(this.world.combat?.definition.ground.width ?? 100, this.world.combat?.definition.ground.depth ?? 100), this.materials.get('sidewalk')); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
      this.meshes.push(ground); this.scene.add(ground);
      if (this.world.scenario === 'horde-readability') {
        this.lookdev = new Lookdev(this.materials, this.occlusion, false); this.scene.add(this.lookdev);
      }
      // Isolated survivor labs use the production composite too: courier scene
      // alpha carries grade protection and must be consumed before presentation.
      this.postFx = new PostFx(this.renderer, this.scene, this.camera, this.quality, this.look);
      this.character = new CharacterView(); await this.character.init(this.materials, Boolean(this.world.combat), this.quality === 'low', 'survivor', false, false, this.world.scenario === 'survivor' ? player?.survivor?.variant : undefined); this.scene.add(this.character);
    } else if (this.world.scenario === 'lookdev') {
      this.renderer.shadowMap.enabled = true;
      this.lighting = new Lighting(this.scene, this.look, this.renderer, this.environment ??= new Environment(this.renderer)); this.materials = new Materials(this.lighting);
      this.lookdev = new Lookdev(this.materials, this.occlusion); this.scene.add(this.lookdev);
      this.postFx = new PostFx(this.renderer, this.scene, this.camera, this.quality, this.look);
    } else {
      const ground = new Mesh(new PlaneGeometry(100, 100), new MeshGridMaterial());
      ground.rotation.x = -Math.PI / 2;
      this.cube = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicNodeMaterial({ color: '#ed935c' }));
      this.meshes.push(ground, this.cube); this.scene.add(...this.meshes);
    }
    if (this.character) { this.contactShadows = new ContactShadows(this.world); this.scene.add(this.contactShadows); }
    if (this.world.missions?.state.l4) { this.militaryPerimeter = new MilitaryPerimeter(this.world); this.scene.add(this.militaryPerimeter); }
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
    if (this.world.missions) { this.marker = new ObjectiveMarker(this.world); this.scene.add(this.marker); if (this.world.scenario === 'L5') { this.survivorRings = new SurvivorRings(this.world); this.scene.add(this.survivorRings); } }
    if (this.crowd) this.scene.add(this.crowd);
    if (this.vehicles) this.scene.add(this.vehicles);
    if (this.bicycle) this.scene.add(this.bicycle);
    if (this.world.scenario === 'L2' && this.materials) { this.l2Props = new L2Props(this.world, this.materials); this.scene.add(this.l2Props); }
    if (this.world.scenario === 'L3' && this.materials) { this.l3Props = new L3Props(this.world, this.materials); this.scene.add(this.l3Props); }
    t = loadMeasure('view:actors', t);
    if (this.world.combat && this.materials) {
      this.vehicleFeedback = new VehicleFeedback(this.materials); this.scene.add(this.vehicleFeedback);
      this.vfx = new Vfx(this.world, {
        muzzle: (id, direction) => {
          const e = this.world.entities.get(id);
          if (id === 1 && this.world.mountedGun?.mounted) return this.mountedGunView?.muzzle(direction) ?? this.world.mountedGun.muzzle();
          if (id === 1 && e?.survivor && this.character && this.actions) {
            // Events precede the survivor action state; evaluate gait at this tick, then aim.
            this.character.position.set(e.transform.x, e.transform.y - .7, e.transform.z);
            this.character.update(e.survivor, this.world.tick, 1);
            this.actions.aimGun(direction); this.actions.update();
            return this.actions.muzzle(new Vector3());
          }
          if (e?.civilian && this.npcs) {
            if (e.civilian.ally?.weapon === 'hmg') {
              const mounted = this.districts?.aimMachineGun(e.transform, direction);
              if (mounted) { this.npcs.aimGun(id, direction); return mounted; }
            }
            return this.npcs.shotMuzzle(id, direction);
          }
          return null; // Vehicle weapons carry their own authored event origin.
        },
        spout: id => this.npcs?.spout(id) ?? null,
        flash: (id, strength) => { this.crowd?.flash(id, strength); },
        detach: (id, limb) => this.crowd?.detach(id, limb),
        blood: coverage => { this.character?.setBlood(coverage); this.actions?.setBlood(coverage); },
        vehicle: (event, enabled) => { if (this.world.vehicles?.cars.has(event.id)) this.vehicles?.feedback(event, enabled); else this.vehicleFeedback?.update(event, enabled); },
        vehicleBloodEnabled: enabled => { this.vehicles?.setBloodEnabled(enabled); this.vehicleFeedback?.setBloodEnabled(enabled); },
        clearGore: () => { this.crowd?.clearGore(); },
        shake: strength => this.view.shake(strength),
        camera: () => this.camera, roll: strength => this.view.roll(strength), focus: () => this.view.focus,
        light: (x, z, hex, intensity, radius, ttl, flicker) => this.lightField?.addTransient({ x, z }, hex, intensity, radius, ttl, flicker) ?? null,
        field: this.lightField ?? undefined,
        ambient: this.lighting?.intensity,
        sunDirection: () => this.lighting!.direction.value,
      });
      this.vfx.set({ ...this.vfxSettings, quality: this.quality }); this.scene.add(this.vfx);
      if (this.world.scenario === 'L1') { const targets = labAccidentTargets(this.scene, s => this.view.shake(s), (x, z, w) => this.view.pull(x, z, w)); this.labWindows = targets; this.labAccident = new LabAccidentFx(this.world, this.vfx, targets, anchorLookup(this.world)); this.labAccident.flashReduction = !!this.vfxSettings.flashReduction; this.labAccident.facing = this.camera.quaternion; this.labAccident.column.camera = this.camera; this.scene.add(this.labAccident.column); }
      this.crowd?.setGoreEnabled(this.vfx.snapshot().enabled && this.vfx.snapshot().gore === 'Full');
      const survivor = this.world.entities.get(1)?.survivor;
      this.frozenPose = survivor ? structuredClone(survivor) : null;
    }
    if (this.world.scenario === 'drive-course') this.postFx = new PostFx(this.renderer, this.scene, this.camera, this.quality, this.look);
    if (this.params.get('debug') === 'physics') {
      this.wireframe = new PhysicsWireframe(this.world.physics); this.scene.add(this.wireframe.lines);
    }
    this.lighting?.applyLook(); this.materials?.applyLook(); this.postFx?.applyLook(); this.districts?.applyLook();
    this.lighting?.setQuality(this.quality); this.districts?.setQuality(this.quality); this.crowd?.setQuality(this.quality);
    // Warm the level's actual surface graph, including haze/ash/rain, rather
    // than clear weather. A daylight fire adds the field bit to that graph;
    // compiling field-only here left L3's haze + field shaders cold at fallback.
    if (!this.weather && this.lighting && this.world.weather) {
      this.weather = new WeatherView(this.world, this.lighting); this.scene.add(this.weather);
      this.weather.update(this.view, this.quality, this.vfxSettings.flashReduction ?? false);
    }
    // Native soft-particle depth samplers must compile with the actual MSAA target
    // bound. The first update below warms those programs in their render context.
    this.districts?.updateLods(this.view); this.crowd?.update(this.view); await Promise.all([this.crowd?.ready(), this.npcs?.ready(), this.districts?.ready()]);
    // The resident mounted gun used to load only in update()/screenshotReady(),
    // after the full warm-up. Its white vertex-colour mesh then linked on first
    // camera entry (especially low WebGL). Include it in the same loading pass.
    await this.syncMountedGun(); this.mountedGunView?.update();
    const restoreOccupants = await this.vehicles?.prewarmOccupants();
    const restoreCrash = await this.vehicles?.prewarmCrash();
    // Put the rigid prototype in front of the loading camera, clear of the
    // boarding vehicle/ground that would otherwise hide its first fragments.
    const corgiFocus = this.camera.getWorldDirection(new Vector3()).multiplyScalar(12).add(this.camera.position);
    const restoreCorgi = this.npcs?.prewarmCorgi(corgiFocus);
    // Issued and racked weapons the courier is not holding yet: their held (courier-fill) materials.
    const restoreHeld = this.actions?.prewarmHeld(this.camera.getWorldDirection(new Vector3()).multiplyScalar(10).add(this.camera.position));
    const restoreMedkits = this.world.scenario === 'L5' ? await this.interactions?.prewarmMedkits(corgiFocus) : undefined;
    const restoreGates = this.world.scenario === 'L6' ? await this.interactions?.prewarmServiceGates() : undefined;
    if (this.world.scenario === 'L6') this.districts?.metroPower(true, false);
    t = loadMeasure('view:lod-ready', t);
    const warm = async (): Promise<void> => {
      await loadGate.foreground(); // node builds cannot be sliced: never during the menus
      this.lighting?.update(this.view);
      // Compile against the gameplay light list. In particular W6 low disables
      // its city-wide moon pass here; warming with that sun still visible left
      // hidden blast pools cold until the first rocket.
      this.updateLights();
      // PO 10-20 #62: the worn headlamp (and its emissive lens) first draws at the shelter pickup. Compile it here.
      if (this.world.scenario === 'L6') this.character?.showHeadlamp(true);
      // Include hidden infected/LOD/VFX/decay variants, and warm their actual HDR/MSAA pass.
      const focus = this.camera.getWorldDirection(new Vector3()).multiplyScalar(20).add(this.camera.position);
      const unwarm = this.labWindows?.prewarmWindows();
      const restore = this.vfx?.prewarm(focus.x, focus.z); this.labAccident?.prewarm();
      const prepareVariant = () => preRender(this.renderer, this.scene, this.camera, () => this.postFx ? this.postFx.render() : this.renderer.render(this.scene, this.camera), partitions => this.postFx ? this.postFx.compile(partitions) : Promise.all(partitions.map(apply => { apply(); return this.renderer.compileAsync(this.scene, this.camera); })), this.background ? () => loadGate.wait() : () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))), this.loadProgress, this.background, this.world.scenario === 'L3' || this.world.scenario === 'L6' || this.world.scenario === 'L8', this.world.scenario === 'L8');
      const prepare = async (): Promise<void> => {
        // L4's moving set pieces reveal the courier during combat. Warm both
        // graphs against every loading light/weather variant, before LOD swaps.
        if (this.world.scenario === 'L4' && this.entityAssets) {
          for (const enabled of [false, true]) {
            const restoreReveal = this.entityAssets.prewarmReveal(focus, enabled);
            try { await prepareVariant(); } finally { restoreReveal(); }
          }
        } else await prepareVariant();
      };
      try {
        // Execute the shared shader's fire branch and its HDR field pass while
        // loading. The final full-size draw also executes the daylight branch.
        if (this.lighting && this.lighting.field.strength.value === 0) {
          const field = this.lighting.field, pulse = field.addTransient({ x: focus.x, z: focus.z }, 'light_fire', 0, 1, Infinity);
          try {
            this.lighting.applyLook(); field.update(focus.x, focus.z, this.world.tick / 60); field.render(this.renderer);
            await prepare();
          } finally { pulse.remove(); this.lighting.applyLook(); }
        } else await prepare();
        if (this.lighting?.preset === 'L10-night') {
          const lighting = this.lighting, spot = !lighting.spot.visible;
          this.shadowWarmup = incrementalPreRender(this.renderer, this.scene, this.camera,
            () => this.postFx ? this.postFx.render() : this.renderer.render(this.scene, this.camera),
            root => this.postFx ? this.postFx.compile(undefined, root) : this.renderer.compileAsync(root, this.camera, this.scene),
            run => lighting.withShadowSource(spot, run));
        }
        // The temporary fire pulse above has now been removed. Execute the
        // daylight graph too, while the rigid prototype still covers pixels;
        // removing it first leaves a hiding corgi cold until its arrival.
        if (restoreCorgi) {
          if (this.postFx) this.postFx.render(); else this.renderer.render(this.scene, this.camera);
          await this.renderer.finishWarmUp();
        }
      }
      finally { restore?.(); unwarm?.(); restoreGates?.(); restoreOccupants?.(); restoreCrash?.(); restoreCorgi?.(); restoreHeld?.(); restoreMedkits?.(); if (this.world.scenario === 'L6') this.character?.showHeadlamp(!!this.world.missions?.state.l6?.flashlight); }
      if (this.healthBars) await preRender(this.renderer, this.barScene, this.camera, () => this.renderBars());
    };
    const finish = (): void => {
      loadMeasure('view:warm-up', t);
      this.idPass = this.params.get('idpass') === '1'; this.update(1);
      this.missionUI?.prepare();
      this.startPreparation();
    };
    // Combat scenes can reveal pooled blast materials long after loading (including
    // delayed secondary blasts). Warm their HDR/MSAA draws before accepting input.
    // E20/E21: L2 and L3 run the same crowd and outbreak look, so they use the same full shader warm-up.
    // L10 also reveals hidden movement/mission meshes on approach. Compile their
    // graphs behind the loading card, rather than linking cold WebGL programs in play.
    const fullWarmUp = !!this.vfx || this.world.scenario === 'L1' || this.world.scenario === 'L2' || this.world.scenario === 'L3' || this.world.scenario === 'L4' || this.world.scenario === 'L5' || this.world.scenario === 'L6' || this.world.scenario === 'L7' || this.world.scenario === 'L10' || !!this.world.missions?.l9;
    if (fullWarmUp && this.background) {
      const generation = this.generation;
      this.warming = warm().then(() => {
        if (generation === this.generation) { this.warming = null; finish(); }
      });
      void this.warming.catch(error => console.error(error));
      return;
    }
    // Any scene with VFX takes the full warm-up on both backends (hidden blast/fireball/debris/puff/flame pools,
    // and the PostFx heat-haze graph compile behind the loading card, WebGL programs and WebGPU pipelines alike).
    if (fullWarmUp) await warm();
    else await (this.postFx ? this.postFx.compile() : this.renderer.compileAsync(this.scene, this.camera));
    // The horizon's rocks enter the view well after departure. Warm every coarse
    // material in the gameplay HDR context before control, rather than linking
    // a cold WebGL sidewalk shader synchronously at the first crossing seam.
    const horizon = this.districts?.horizonForWarmup();
    if (horizon) await this.warmHidden(horizon);
    restoreOccupants?.(); restoreCrash?.(); restoreCorgi?.(); restoreHeld?.(); finish();
  }
  /** Actor views are independent of each other and of the districts: create them and start their
   * loads concurrently (one network wave, not six); load() adds them in the established scene order. */
  private accessories: CrowdAccessories | null = null;
  /** The manned minigun is drawn by its own animated view (created when a level installs the gun); returns its load. */
  private syncMountedGun(): Promise<void> | undefined {
    const gun = this.world.mountedGun;
    // The finale gun follows the existing predictive chunk ring; R1 does not fetch an R7 weapon mesh.
    if (!gun || (this.world.chunks && !this.world.chunks.resident(gun.placement.x, gun.placement.z))) { if (this.mountedGunView) { this.mountedGunView.dispose(); this.mountedGunView = null; } return undefined; }
    if (!this.mountedGunView && this.materials) { this.mountedGunView = new MountedGunView(this.world, this.quality === 'low', this.materials, this.renderer, model => this.warmHidden(model)); this.scene.add(this.mountedGunView); }
    this.mountedGunView?.update();
    return this.mountedGunView?.ready();
  }
  private startActors(character: Promise<unknown>): Promise<unknown> {
    this.accessories = new CrowdAccessories(this.materials!); this.scene.add(this.accessories);
    if (this.world.npcs && this.materials) { this.npcs = new NpcView(this.world, this.materials, this.accessories, batch => this.warmHidden(batch)); this.npcs.setQuality(this.quality); }
    if (this.character) this.entityAssets = new EntityAssets(this.world, this.quality === 'low', this.materials!);
    if (this.world.combat && this.character) { this.actions = new ActionView(this.world, this.character, this.materials!, this.renderer); this.actions.ground = this.drawnGround; this.actions.showCone = this.params.has('debug') || this.params.get('aimcone') === '1'; }
    if (this.character && this.world.combat) { this.crowd = new CrowdView(this.world, this.quality === 'low', this.materials!, this.accessories); this.healthBars = new HealthBars(this.world); this.barScene.add(this.healthBars); }
    if (this.world.props && !this.world.districts && this.materials) { this.fixtureProps = new PropFixtureView(this.world, this.materials); this.scene.add(this.fixtureProps); }
    if (this.world.interactables && this.materials) { this.interactions = new InteractionView(this.world, this.materials, this.view, this.quality === 'low'); this.scene.add(this.interactions); }
    if (this.world.vehicles?.cars.size && this.materials) { this.vehicles = new VehicleView(this.world, this.materials, this.view, this.quality === 'low'); this.vehicles.ground = this.drawnGround; }
    if (this.world.vehicles?.bicycle.entity && this.materials) { this.bicycle = new BicycleView(this.world, this.materials); this.bicycle.ground = this.drawnGround; }
    const actions = this.actions;
    return Promise.all([this.accessories.init(), this.npcs?.init(this.camera), this.entityAssets?.init(this.view), actions ? character.then(() => actions.init()) : undefined, this.crowd?.init(), this.interactions?.synchronize(), this.vehicles?.load(), this.bicycle?.load()]);
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
      // the first five seconds of gameplay have settled; test mode keeps readiness with a paused sim.
      while (this.world.missions?.state.phase === 'briefing' || this.playSeconds < 5 && this.params.get('test') !== '1') { await frame(); if (stale()) return; }
      loadGate.setPaced(true);
      for (const view of this.preparedDistrictViews.values()) { view.warmHero = batch => this.warmHidden(batch); view.swapSlot = () => this.swapSlot(); }
      const start = performance.now();
      // The decay variants follow: their swap at an objective transition then finds LOD0 batches ready.
      for (const view of [current, ...[...this.preparedDistrictViews.values()].filter(view => view !== current)]) { await view.prepare(this.view.cameraTarget, stale, this.world.scenario === 'L7' ? lodPolicy.lod2From : Infinity); if (stale()) break; }
      if (!stale()) loadMeasure('view:background-preparation', start);
    })().catch(error => { if (generation === this.generation) console.error(error); });
  }
  /** Build a detached batch's render objects (programs, pipelines, vertex buffers) without drawing it:
   * three collects the render list synchronously, then compiles and uploads asynchronously, yielding
   * between objects. The batch joins the scene afterwards. */
  private async warmHidden(batch: import('three/webgpu').Object3D): Promise<void> {
    const previousParent = batch.parent, parent = this.districts ?? this.scene, saved: [import('three/webgpu').Object3D, boolean][] = [];
    batch.traverse(object => { saved.push([object, object.frustumCulled]); object.frustumCulled = false; });
    parent.add(batch); batch.updateMatrixWorld(true);
    let compiling: Promise<void>;
    try { compiling = this.postFx ? this.postFx.compile(undefined, batch) : this.renderer.compileAsync(batch, this.camera, this.scene); }
    finally { parent.remove(batch); previousParent?.add(batch); for (const [object, culled] of saved) object.frustumCulled = culled; }
    await compiling;
  }
  /** A prepared decay swap retains characters, crowd pools, GPU programs, camera and audio. */
  switchPreparedDistrict(): boolean {
    const next = this.preparedDistrictViews.get(this.world.districts);
    if (!next) return false;
    if (this.districts) this.districts.visible = false;
    this.districts = next; next.visible = true; next.setQuality(this.quality);
    next.updateLods(this.view); this.lighting?.set(next.world.composition.timeOfDay); this.lighting?.field.setStatic(layoutLights(next.world)); this.lighting?.practicalEffects.install(next.world);
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
        // The courier waits 1.2 m behind the leaf: like a vehicle in front of her, it keeps a dithered silhouette inside her
        // see-through disc (only fragments nearer the camera than she is), so she reads as inside the bay, behind the door (PO #26).
        const shutter = new Mesh(new BoxGeometry(3.6, 3.2, .12), this.materials.fromColor('story:shutter', new Color('#b44a3e')).seeThrough());
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
  get backgroundReady(): boolean { return this.world.missions?.state.phase !== 'briefing' && (this.params.get('test') === '1' || !this.warming && !this.background && this.playSeconds > .25); }
  /** L10's required tiers must swap within its two-second walking prefetch horizon.
   * Other levels retain their startup admission; all swaps use the load gate. */
  private async swapSlot(): Promise<void> {
    while (this.world.scenario !== 'L10' && this.playSeconds < 4 && this.params.get('test') !== '1') await new Promise(resolve => setTimeout(resolve, 250));
    await loadGate.wait();
  }
  /** Living, shown people (courier, pedestrians, story actors, infected) for the automatic street doors. */
  private *doorBodies(): Generator<{ x: number; z: number }> {
    for (const e of this.world.entities.iterate()) if (!e.hidden && e.health.current > 0 && (e.id === 1 || e.civilian || e.infected)) yield e.transform;
  }
  advance(seconds: number): void {
    this.districts?.advance(seconds);
    this.entityAssets?.advance();
    const player = this.world.entities.get(1);
    if (player) {
      const loadout = player.weapons && this.world.combat?.runner.loadout;
      this.view.setEquippedWeapon(this.world.mountedGun?.mounted ? undefined : loadout?.current(loadout.state.selectedSide).id);
      // E20: riding the fire truck as a passenger uses the same 15 % zoom-out as driving.
      this.view.driving = this.world.vehicles?.active != null || !!this.world.missions?.state.l2?.seated || !!this.world.missions?.state.l4?.seated;
      // E19 story beats: ease the game camera onto the beat (between courier and the other actor, a little closer),
      // then back to the follow camera; no cut, same isometric angle.
      // L7-E2: the departure shot takes the camera (it follows the bus), then hands it back.
      const shot = this.world.missions?.l9?.cameraPose() ?? this.world.l7Departure?.cameraPose();
      if (shot) { this.view.cinematic(shot); this.departureShot = true; } else if (this.departureShot) { this.departureShot = false; this.view.follow(); }
      const beat = this.world.missions?.state.l1?.beat;
      if (beat && this.world.storyLock && !this.view.spot) {
        this.storyFocus.set(beat.fx, .8, beat.fz); this.storyOffset.setFromSphericalCoords(13, this.view.polar, this.view.azimuth);
        this.view.cinematic({ position: this.storyFocus.clone().add(this.storyOffset).toArray() as [number, number, number], target: this.storyFocus.toArray() as [number, number, number] });
        this.storyFraming = true;
      } else if (this.storyFraming) { this.storyFraming = false; this.view.follow(); }
      // Show the gathered residents while the last followers cross, then return to the closing shutter.
      const metro = this.world.scenario === 'L5' ? this.world.missions?.state.l5 : null;
      const showStation = !!metro?.metroAt && !metro.shutterAt;
      if (showStation && !this.l5StationView) {
        const pose = this.districts?.spots.get('D-FAIR/W5/l5-metro-shelter');
        if (pose) this.view.preset('l5-station-arrival', pose);
      } else if (!showStation && this.l5StationView) {
        const pose = metro?.shutterAt && this.districts?.spots.get('D-FAIR/W5/l5-metro-doors');
        if (pose) { this.view.preset('l5-metro-closing', pose); this.l5ClosingPose = pose; this.l5ClosingTarget.fromArray(pose.target); }
        else this.view.follow();
      }
      this.l5StationView = showStation;
      // PO #49: the closing shot frames the shutter, but the courier keeps walking down the stairs and left the frame (or sat
      // behind the roof). Keep the same angle and distance, and slide the target onto her (80 %), so the doors stay in view behind her.
      if (this.view.spot === 'l5-metro-closing' && this.l5ClosingPose) {
        const base = this.l5ClosingPose, p = player.transform, k = 1 - Math.exp(-3 * seconds);
        const follow = .8, feet = Math.max(0, p.y - .7);
        this.l5ClosingTarget.x += (base.target[0] + (p.x - base.target[0]) * follow - this.l5ClosingTarget.x) * k;
        this.l5ClosingTarget.y += (base.target[1] + (feet - base.target[1]) * follow - this.l5ClosingTarget.y) * k;
        this.l5ClosingTarget.z += (base.target[2] + (p.z - base.target[2]) * follow - this.l5ClosingTarget.z) * k;
        const t = this.l5ClosingTarget, dx = t.x - base.target[0], dy = t.y - base.target[1], dz = t.z - base.target[2];
        this.view.cinematic({ position: [base.position[0] + dx, base.position[1] + dy, base.position[2] + dz], target: [t.x, t.y, t.z] });
      } else this.l5ClosingPose = null;
      const rescue = this.world.scenario === 'L3' && !!this.world.missions?.state.l3?.finaleAt && !this.world.missions.state.l3.barrierClosedAt && player.transform.x >= 195;
      // Brief l3-polish: the station attack pulls back (eased) so the streams at the gates are on screen while the courier holds the yard.
      this.l3AttackScale += ((rescue ? 3.3 : l3AttackView(this.world) ? l3.attack.viewScale : 1) - this.l3AttackScale) * (1 - Math.exp(-4 * seconds));
      this.view.encounterScale = this.world.scenario === 'L3' ? this.l3AttackScale : 1;
      const ending = this.world.missions?.state.epilogue;
      const pull = ending ? epiloguePull(this.world.missions!.state.counters['epilogue-ticks']) : 0;
      this.view.epilogueScale = 1 + 6 * pull;
      if (this.world.missions?.l10) {
        const target = this.world.missions.def.anchors['epilogue-camera-target'] ?? player.transform;
        this.view.pull(target.x, target.z, .4 * pull);
        if (ending && this.epiloguePrepared !== ending && this.districts) {
          this.epiloguePrepared = ending;
          const district = this.districts, generation = this.generation, quality = this.quality;
          // Warm only the authored finale camera neighborhood before its later widening reveals close tiers.
          this.preparation = district.prepare(target, () => generation !== this.generation || quality !== this.quality, 32);
          this.preparation.catch(error => { if (generation === this.generation) console.error(error); });
        }
      }
      // Brief l3-polish (the phone finale cropped the group at the right edge): a portrait screen pulls less toward the line, so
      // the courier and her group stay in frame next to the surge.
      if (this.world.scenario === 'L3') this.view.pull(202, 0, rescue ? (this.view.camera.aspect < 1 ? .45 : .8) : 0, rescue ? 1.6 : undefined);
      this.updateEnding();
      this.view.update(player.transform, seconds);
      this.playerPosition.set(player.transform.x, player.transform.y - 0.5, player.transform.z);
      if (this.lookdev) this.occlusion.update(this.camera, this.playerPosition, seconds, this.lookdev.playerMeshes);
    }
  }
  /** Photo spots are only registered by the current scenario. */
  preset(name: string): void {
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
    // E27 labs: the game camera geometry (radius 19, default player zoom) centred on the blast origin.
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
  settings(patch: { cameraShake?: boolean; bloom?: boolean; cheapDof?: boolean; timeOfDay?: TimeOfDay; occludersVisible?: boolean; idPass?: boolean; windowMask?: boolean; foliageMask?: boolean | 'crowns'; foliageReveal?: boolean; interiorCullOff?: boolean; seeThroughReference?: boolean; seeThroughOff?: boolean; foliageVisible?: boolean } & VfxSettings): void {
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
    if(patch.interiorCullOff!==undefined&&this.districts)this.districts.interiorCullOff=patch.interiorCullOff;
    if(patch.seeThroughReference!==undefined&&this.districts)this.districts.seeThroughReference=patch.seeThroughReference;
    if(patch.seeThroughOff!==undefined&&this.districts)this.districts.seeThroughOff=patch.seeThroughOff;
    if(patch.foliageVisible!==undefined)this.districts?.setFoliageVisible(patch.foliageVisible);
    if (patch.idPass !== undefined) this.idPass = patch.idPass;
    this.update(1);
  }
  /** Keep the courier's full silhouette visible in L7's tightly packed following group/horde. */
  private nearL7Crowd(at: { x: number; z: number }): boolean {
    if (this.world.scenario !== 'L7') return false;
    for (const e of this.world.entities.iterate()) {
      if (e.id === 1 || e.hidden || e.health.current <= 0 || e.infected?.hidden || !(e.civilian || e.infected || e.escort)) continue;
      const dx = e.transform.x - at.x, dz = e.transform.z - at.z;
      if (dx * dx + dz * dz < 9) return true;
    }
    return false;
  }
  /** Distance (m) to the nearest living Mega Alpha, Infinity when none. */
  private megaDistance(at: { x: number; z: number }): number {
    let best = Infinity;
    for (const e of this.world.entities.iterate()) if (e.infected?.pursuit && !e.hidden && !e.infected.hidden && e.health.current > 0) best = Math.min(best, Math.hypot(e.transform.x - at.x, e.transform.z - at.z));
    return best;
  }
  /** Scene Lab reference: disable only solid discard, retaining placement eligibility and interior visibility. */
  probeSolidCut(off: boolean): void { this.solidCutProbeOff = off; this.update(1); }
  /** Scene Lab: hide the courier / the crowd (Mega included) and redraw, for the courier-visible-share probe. */
  probeVisibility(hide: { courier: boolean; crowd: boolean; environment?: boolean; bars?: boolean }): number {
    this.probeHide = { ...hide, environment: hide.environment ?? false, bars: hide.bars ?? false }; this.probeVisibilityPending = true; this.update(1);
    const player = this.world.entities.get(1); return player ? this.megaDistance(player.transform) : Infinity;
  }
  /** Scene Lab: depth-tested infected silhouette, preserving the submitted instance/pose and accessory masks. */
  probeInfectedMask(enabled: boolean): void { this.infectedIdPass = enabled; this.update(1); }
  /** Project a world point to viewport-normalized coordinates, for masks and input integration. */
  project(x: number, y: number, z: number): number[] { return this.projection.set(x, y, z).project(this.camera).toArray(); }
  crowdFigures() { return [...(this.crowd?.getState().figures ?? []), ...(this.npcs?.snapshot().civilians.figures ?? [])]; }
  /** Scene Lab probes (src/debug/scenelab): the presentation objects it measures. Test/debug use only. */
  /** Drawn ground of the current district view (roads 5 cm above the sim plane, paving, road paint) for tyre contacts. */
  private readonly drawnGround = (x: number, z: number) => this.districts?.groundAt(x, z) ?? null;
  labProbes() { return { gunMeshes: [...(this.actions?.gunMeshes() ?? []), ...(this.npcs?.gunMeshes() ?? [])], heldProps: this.npcs?.heldProps() ?? [], districts: this.districts, character: this.character, npcs: this.npcs, bicycle: this.bicycle, vehicles: this.vehicles, drawnCorpses: () => [...(this.crowd?.drawnCorpses() ?? []), ...(this.npcs?.drawnCorpses() ?? [])], drawnPickups: () => this.interactions?.drawnPickups() ?? [] }; }
  private readonly heatPoint = new Vector3(); private readonly heatEdge = new Vector3(); private readonly heatRight = new Vector3();
  /** High-tier heat haze: project the Blasts heat sources (fires, fresh blasts) to UV discs for the PostFx shimmer. */
  private updateHeatHaze(postFx: PostFx): void {
    if (!postFx.haze) return;
    const sources = this.vfx?.visible ? this.vfx.blasts.heatSources() : [];
    postFx.heatTime.value = this.vfx?.time ?? 0; postFx.heatAspect.value = this.camera.aspect;
    this.heatRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
    let n = 0;
    for (const s of sources) {
      if (n >= postFx.heat.length) break;
      this.heatPoint.set(s.x, s.y, s.z).project(this.camera);
      if (this.heatPoint.z > 1 || Math.abs(this.heatPoint.x) > 1.4 || Math.abs(this.heatPoint.y) > 1.4) continue;
      this.heatEdge.set(s.x, s.y, s.z).addScaledVector(this.heatRight, s.radius).project(this.camera);
      // UV height units: half the NDC distance, scaled by aspect because NDC x spans the width.
      const radius = Math.abs(this.heatEdge.x - this.heatPoint.x) * .5 * this.camera.aspect;
      // Three's post quad UV has a top-left origin on both backends (GLSL flips render-target reads to match).
      postFx.heat[n++].set(this.heatPoint.x * .5 + .5, .5 - this.heatPoint.y * .5, radius, s.strength);
    }
    for (let i = n; i < postFx.heat.length; i++) postFx.heat[i].w = 0;
  }
  renderDiagnostics() { return { renderer: this.renderer.diagnostics(), postFx: this.postFx?.diagnostics() ?? null, retiredPostFx: this.retiredPostFx, generation: this.generation }; }
  renderProbe() {
    const c = this.camera, finite = (m: { elements: number[] }) => m.elements.every(Number.isFinite);
    return { camera: { position: c.position.toArray(), quaternion: c.quaternion.toArray(), near: c.near, far: c.far, zoom: c.zoom,
      matrixWorldFinite: finite(c.matrixWorld), projectionFinite: finite(c.projectionMatrix), inverseFinite: finite(c.matrixWorldInverse) },
      children: this.scene.children.map(o => ({ name: o.name || o.type, visible: o.visible })), hits: this.screenHits(), ...this.renderDiagnostics() };
  }
  /** First visible mesh under five screen points (centre and the four quarter points). */
  private screenHits() {
    const raycaster = new Raycaster();
    return [[0, 0], [-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]].map(([x, y]) => {
      raycaster.setFromCamera(new Vector2(x, y), this.camera);
      const hit = raycaster.intersectObject(this.scene, true).find(h => h.object.visible && (h.object as Mesh).isMesh);
      if (!hit) return null;
      const m = (hit.object as Mesh).material, material = Array.isArray(m) ? m[0] : m;
      let path = hit.object.name; for (let p = hit.object.parent; p && path.length < 160; p = p.parent) path = `${p.name || p.type}/${path}`;
      return { at: [x, y], distance: +hit.distance.toFixed(2), path, instance: hit.instanceId, material: material.name, point: hit.point.toArray().map(v => +v.toFixed(2)), normal: hit.face?.normal.toArray().map(v => +v.toFixed(2)) };
    });
  }
  getState() {
    const materialInventory = new Map<string, { name: string; palette: boolean; plainLit: boolean; emissive: number }>();
    this.scene.traverse((child) => { if (child instanceof Mesh) for (const material of Array.isArray(child.material) ? child.material : [child.material]) materialInventory.set(material.uuid, { name: material.name, palette: material instanceof PaletteMaterial, plainLit: (material instanceof MeshLambertNodeMaterial || material instanceof MeshStandardMaterial) && !(material instanceof PaletteMaterial), emissive: material.userData.emissiveStrength ?? 0 }); });
    return { placeholderDraws: this.districts?.placeholderDraws() ?? [], machineGuns: this.districts?.machineGunState() ?? [], weather: this.weather?.snapshot() ?? null, bicycle: this.bicycle?.snapshot() ?? null, quality: this.quality, pixelRatio: this.renderer.getPixelRatio(), postFx: this.postFx?.snapshot() ?? null, moveMarker: this.destination ? { visible: this.destination.visible, position: this.destination.position.toArray() } : null, missionMarker:this.marker ? {visible:this.marker.visible,position:this.marker.position.toArray()} : null, districts:this.districts?.getState()??null, backend: this.renderer.selectedBackend, camera: this.view.getState(), lighting: this.lighting?.getState() ?? null,
      npcs: this.npcs?.snapshot() ?? null, accessories: this.accessories?.snapshot() ?? [],
      vehicles: [...(this.vehicles?.snapshot() ?? []), ...(this.vehicleFeedback?.getState() ?? []).map(v => ({ ...v, wheels: [], brake: 0, sirens: [], placeholder: true }))], entityAssets: this.entityAssets?.getState() ?? null, character: this.character?.getState() ?? null, contactShadows: this.contactShadows?.getState() ?? null, crowd: this.crowd?.getState() ?? null, healthBars: this.healthBars?.snapshot() ?? null, actions: this.actions?.getState() ?? null,
      vfx: this.vfx?.snapshot() ?? null, infected: this.crowd?.getGoreState() ?? [],
      materials: [...materialInventory.values()], occlusion: this.occlusion.getState(), courierForeground: this.courierForeground, courierOccluder: this.districts?.occluderId ?? '',
      probes: this.lookdev ? { lamp: this.project(...this.lookdev.lampHead.position.toArray() as [number, number, number]), shadow: this.project(...this.lookdev.shadowProbe.position.toArray() as [number, number, number]) } : null };
  }
  private syncMission(): void {
    const mission = this.world.missions, cinematic = mission?.state.cinematic;
    if (cinematic && this.cinematicId !== cinematic.id) { this.cinematicId = cinematic.id; this.view.cinematic(mission!.def.cinematics[cinematic.id]); }
    else if (!cinematic && this.cinematicId) { this.cinematicId = null; this.view.follow(); }
    if (mission?.state.timeOfDay && this.lighting?.preset !== mission.state.timeOfDay) this.lighting?.set(mission.state.timeOfDay);
    // E23: the sunset fades with the story (the sim owns the target; the picture eases toward it).
    const target = this.lighting?.preset === 'L5' ? mission?.state.l5?.gloom ?? 1 : 1;
    this.gloomShown += (target - this.gloomShown) * (Math.abs(target - this.gloomShown) < .002 ? 1 : .04);
    this.lighting?.setGloom(this.gloomShown);
  }
  /** Presentation glance target for the courier: the locked attack target within 8 m, else the nearest live infected within 6 m (head height). */
  private threat(player: { x: number; z: number }): Vector3 | null {
    const locked = this.world.controls.snapshot()?.attack, lockedEntity = locked ? this.world.entities.get(locked.id) : undefined;
    let best = lockedEntity && lockedEntity.health.current > 0 && Math.hypot(lockedEntity.transform.x - player.x, lockedEntity.transform.z - player.z) < 8 ? lockedEntity : undefined, distance = 36;
    if (!best) for (const e of this.world.entities.iterate()) {
      if (e.id === 1 || e.faction !== 'infected' || e.hidden || e.infected?.hidden || e.corpse || e.health.current <= 0 || e.archetype === 'infected.crow') continue;
      const d = (e.transform.x - player.x) ** 2 + (e.transform.z - player.z) ** 2;
      if (d < distance) { distance = d; best = e; }
    }
    return best ? this.glance.set(best.transform.x, best.transform.y + .4, best.transform.z) : null;
  }
  update(alpha = 1): void {
    this.vfx?.updateSpecialState();
    if (this.missionHidden && this.missionUI) this.missionUI.root.hidden = true;
    if (this.warming || this.frozenFrame && !this.frozenUpdates) { if (!this.missionHidden) this.missionUI?.update(this.camera, innerWidth, innerHeight); return; }
    if (this.contextLost) return;
    this.militaryPerimeter?.update();
    if (this.destination) {
      const blocked = this.world.controls.blockedMove, active = blocked && blocked.until > this.world.tick;
      const target = active ? blocked.point : this.world.controls.moveTarget; this.destination.visible = target != null;
      (this.destination.material as MeshBasicNodeMaterial).color.set(active ? '#ff704f' : '#64ffce');
      this.destination.scale.setScalar(active ? 1.4 : 1);
      // The cursor ray meets the ground at the courier's height (Game.ts setGroundHeight); the ring sits on that same ground, not at y 0 (PO 10-20 #68).
      if (target) this.destination.position.set(target.x, (this.world.districts?.groundHeight(target.x, target.z) ?? 0) + .12, target.z);
    }
    const profileStart = this.renderer.profile ? performance.now() : 0;
    // The rig steps with the sim; render it between the last two tick poses like every other transform.
    this.view.present(alpha);
    this.syncMission();
    if (this.view.inspectionPose) this.view.present(alpha);
    const current = this.world.entities.get(1)?.transform, previous = this.world.previousPlayer;
    const survivor = this.world.entities.get(1)?.survivor;
    const carPose = carTransitionPose(this.world, alpha);
    if (!this.bicycle && this.world.vehicles?.bicycle.entity && this.materials) { this.bicycle = new BicycleView(this.world, this.materials); this.bicycle.ground = this.drawnGround; this.scene.add(this.bicycle); }
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
      this.character.face(carPose ? carPose.yaw : mountedFrame ? current.yaw : from + Math.atan2(Math.sin(current.yaw - from), Math.cos(current.yaw - from)) * alpha, (this.world.tick + alpha) / 60, striking, mountedFrame ? this.bikeOrientation : undefined,
        striking && survivor.attack!.style === 'roundhouse' ? roundhouseSpin(survivor.attack!, (stopped ? this.hitStopTick : this.world.tick) + (stopped ? 1 : alpha) - 1) : 0);
      // E19 courier: the bicycle sim (lane F) marks the rider; the bike's crank/steer drive the pose.
      const bike = riding === undefined ? undefined : (this.world.entities.get(riding) as { bicycle?: { pedal: number; steer: number } } | undefined)?.bicycle;
      this.character.update(carPose?.pose ?? (stopped && this.frozenPose ? this.frozenPose : survivor), stopped ? this.hitStopTick : this.world.tick, stopped ? 1 : alpha,
        riding === undefined ? undefined : { pedal: this.bicycle?.presentedRide?.pedal ?? bike?.pedal ?? this.world.tick * .12, steer: this.bicycle?.presentedRide?.steer ?? bike?.steer ?? 0 });
      const cureCollected = this.world.missions?.state?.id === 'L10' && this.world.missions.state.items.includes('cure-canister');
      this.character.showCure(!!cureCollected && !!this.world.missions?.state?.states['cure-carried'] && !this.world.missions?.state?.states['cure-installed']);
      this.districts?.setCureCollected(!!cureCollected);
      if (this.world.missions?.state.id === 'L10') this.districts?.setDispersalActive(!!this.world.missions.state.states['cure-released']);
      if (this.character.skinActive) this.character.glanceAt(this.threat(current));
      // Riding: the pelvis sits on the saddle, measured from the bike's `seat` node every frame (any heading, lean or turn).
      if (this.character.skinActive) this.character.applyRideContacts(riding !== undefined ? this.bicycle?.riderContacts() : undefined);
      else if (riding !== undefined && this.bicycle?.seatWorld(this.seat)) {
        this.character.seatPelvis(this.seat, -.04);
        if (this.bicycle.gripsWorld(this.gripL, this.gripR)) this.character.holdHandlebar(this.gripL, this.gripR);
      }
    }
    if (this.character && carPose) {
      this.character.position.set(carPose.x, carPose.y, carPose.z);
      // A short knee/torso compression reads as boarding and a landing without altering the sim capsule.
      this.character.carStep(carPose.crouch);
      this.character.position.y -= carPose.crouch * .18;
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
    if (this.character) this.character.visible = !this.probeHide.courier && (carPose ? carPose.visible : !this.world.entities.get(1)?.hidden);
    if (this.crowd) this.crowd.visible = !this.probeHide.crowd;
    if (!this.vehicles && this.world.vehicles?.cars.size && this.materials) { this.vehicles = new VehicleView(this.world, this.materials, this.view, this.quality === 'low'); this.vehicles.ground = this.drawnGround; this.scene.add(this.vehicles); }
    this.vehicles?.update(alpha); this.l2Props?.update(); this.l3Props?.update();
    if (this.actions) this.actions.visible = !this.world.entities.get(1)?.hidden;
    this.marker?.update(this.view.storyShot); this.survivorRings?.update(this.view.storyShot); if (!this.missionHidden) this.missionUI?.update(this.camera,innerWidth,innerHeight,this.view.storyShot);
    pickBodies.begin(); this.accessories?.begin(); this.crowd?.update(this.view, alpha); this.contactShadows?.update(alpha); this.actions?.update();
    this.entityAssets?.update(alpha);
    this.syncMountedGun();
    this.interactions?.update(this.camera); this.npcs?.update(this.camera, alpha, this.view.lodCamera); this.accessories?.finish();
    const flashOpacity = String(Math.max(this.weather?.flash ?? 0, this.vfx?.flash ?? 0, this.labAccident?.flash ?? 0));
    if (this.flashOverlay.style.opacity !== flashOpacity) this.flashOverlay.style.opacity = flashOpacity;
    this.fixtureProps?.update();
    if (this.world.props) this.districts?.syncProps(this.world.props.items);
    if ((this.world.weather?.powerRevision ?? 0) !== this.weatherPowerRevision) { this.weatherPowerRevision = this.world.weather!.powerRevision; if (this.world.districts) this.lighting?.field.setStatic(layoutLights(this.world.districts)); const metro = this.world.missions?.state.l6; if (metro) this.districts?.metroPower(metro.mainPower, metro.emergency); else this.districts?.blackout(); }
    this.lighting?.update(this.view); this.updateLights();
    if (!this.weather && this.lighting && this.world.weather) { this.weather = new WeatherView(this.world, this.lighting); this.scene.add(this.weather); }
    this.weather?.update(this.view, this.quality, this.vfxSettings.flashReduction ?? false);
    const drivenCar = this.world.vehicles?.cars.get(this.world.vehicles.active ?? -1);
    this.districts?.updateLods(this.view, drivenCar?.physics.body.linvel() ?? survivor?.velocity);
    this.districts?.cull(this.view, this.quality);
    const locked = this.world.controls.snapshot()?.attack;
    const lockedEntity = locked ? this.world.entities.get(locked.id) : undefined;
    let subject: Box3 | undefined;
    if (current) {
      const feet = current.y - .7;
      this.revealSubject.min.set(current.x - .55, feet, current.z - .55);
      this.revealSubject.max.set(current.x + .55, feet + 1.9, current.z + .55);
      if ((this.world.entities.get(1) as { riding?: number } | undefined)?.riding !== undefined && this.bicycle?.playerBounds(this.revealVehicle)) this.revealSubject.union(this.revealVehicle);
      const inVehicle = !!(this.vehicles?.playerBounds(this.revealVehicle) || this.entityAssets?.playerBounds(this.revealVehicle));
      if (inVehicle) this.revealSubject.union(this.revealVehicle);
      seeThrough.retain.value = inVehicle || this.revealSubject.max.x - this.revealSubject.min.x > 2 || this.revealSubject.max.z - this.revealSubject.min.z > 2 ? .35 : 0;
      // PO #45: the see-through disc must clear the corgi next to her too, else its tail dissolves into occluder dots.
      let pet = this.companionId >= 0 ? this.world.entities.get(this.companionId) : undefined;
      if (!pet?.companion) { pet = undefined; if (this.companionSearch++ % 60 === 0) for (const e of this.world.entities.iterate()) if (e.companion) { pet = e; this.companionId = e.id; break; } }
      if (pet && !pet.hidden && Math.hypot(pet.transform.x - current.x, pet.transform.z - current.z) < 2.6) {
        this.revealPet.min.set(pet.transform.x - .5, feet, pet.transform.z - .5); this.revealPet.max.set(pet.transform.x + .5, feet + .8, pet.transform.z + .5);
        this.revealSubject.union(this.revealPet);
      }
      subject = this.revealSubject;
    }
    this.vehicles?.updateReveal(subject);
    this.entityAssets?.updateReveal(subject);
    this.districts?.updateFoliage(this.view, current, lockedEntity && lockedEntity.health.current > 0 ? lockedEntity.transform : undefined, subject);
    // Scenes without a DistrictView (Scene Lab asphalt scenes with asset occluders) open the same bounded, immediate reveal.
    if (!this.districts) {
      seeThrough.cover.value = 0;
      seeThrough.strength.value = subject ? 1 : 0;
      if (subject) projectReveal(this.camera, subject); else seeThrough.center.value.set(-10, -10);
    }
    if (this.solidCutProbeOff) seeThrough.strength.value = 0;
    // Reuse the foreground silhouette at the boss and in L7's close crowd. Building blockers no longer trigger it: their
    // placement cut already clears the whole subject disc, and the near-camera depth slice drew the courier over every
    // nearer person and prop (PO #9 L2 start: on top of firefighter "2"; #26 L1: in front of the closed bay leaf and the horde).
    this.courierForeground = !!current && courierForegroundWanted(this.nearL7Crowd(current), this.megaDistance(current));
    this.character?.setForeground(this.courierForeground);
    this.healthBars?.update(this.camera, this.view.viewportHeight * this.camera.aspect, this.view.viewportHeight, this.barOccluded, this.lighting?.preset === 'L6');
    if (this.world.missions?.state.l3) {
      const at = this.world.missions.state.l3.barrierClosedAt;
      this.districts?.updateArmyBoom(at ? Math.max(0, 1 - (this.world.tick - at) / 42) : 1);
    }
    if (this.params.get('doors') !== '0') this.districts?.updateDoors(this.doorBodies(), this.world.openDoors.values());
    const marketState = this.world.missions?.state.l2; if (marketState) this.districts?.marketDoors(marketState.doorsOpenAt > 0 && this.world.tick >= marketState.doorsOpenAt);
    const shutterAt = this.world.missions?.state.l5?.shutterAt;
    if (this.world.scenario === 'L5') this.districts?.updateMetroShutter(Math.min(1, Math.max(0, shutterAt ? (this.world.tick - shutterAt) / 120 : 0)));
    this.wireframe?.update();
    // A teleport snap can follow another render in the same browser frame (checkpoint/test teleports render at once).
    // FRAME-updated nodes, such as the PostFx scene pass, would keep that earlier camera's image: draw this pose.
    if (this.view.consumeSnap()) this.renderer.nextNodeFrame();
    // We own RAF, so reset counters per render rather than relying on setAnimationLoop.
    if (this.shadowWarmup) { this.shadowWarmup.step(); if (this.shadowWarmup.done) this.shadowWarmup = null; }
    this.renderer.info.reset(); this.renderedFrames++;
    this.renderer.beginProfile(this.camera);
    const renderStart = profileStart ? performance.now() : 0;
    if (profileStart) this.updateCpuMs = renderStart - profileStart;
    if (this.probeVisibilityPending || this.probeHide.courier || this.probeHide.crowd || this.probeHide.environment) {
      // The reference removes every possible foreground solid, including static kits and parked cars.
      if (this.districts) this.districts.visible = !this.probeHide.environment;
      if (this.npcs) this.npcs.visible = !this.probeHide.environment;
      if (this.interactions) this.interactions.visible = !this.probeHide.environment;
      if (this.fixtureProps) this.fixtureProps.visible = !this.probeHide.environment;
      if (this.bicycle) this.bicycle.visible = !((this.world.entities.get(1) as { riding?: number } | undefined)?.riding !== undefined ? this.probeHide.courier : this.probeHide.environment);
      this.vehicles?.probeVisibility(this.probeHide.courier, !!this.probeHide.environment);
      this.entityAssets?.probeVisibility(this.probeHide.courier, !!this.probeHide.environment);
      this.probeVisibilityPending = false;
    }
    if (this.weatherProbeAsset) {
      const saved = new Map<Mesh, boolean>(), background = this.scene.background, backgroundNode = this.scene.backgroundNode;
      this.scene.background = new Color(0); this.scene.backgroundNode = null;
      this.scene.traverse(child => {
        if (!(child instanceof Mesh)) return;
        saved.set(child, child.visible); let matches = false;
        for (let parent: import('three').Object3D | null = child; parent; parent = parent.parent) if ((parent.name === 'weather' && this.weatherProbeAsset === 'weather') || (parent.name === `inst:${this.weatherProbeAsset}` || parent.name.startsWith(`inst:${this.weatherProbeAsset}:`)) || parent.userData.assetId === this.weatherProbeAsset) matches = true;
        child.visible = child.visible && matches;
      });
      this.renderer.render(this.scene, this.camera);
      for (const [mesh, visible] of saved) mesh.visible = visible;
      this.scene.background = background; this.scene.backgroundNode = backgroundNode;
    } else if(this.foliageMask) {
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
    } else if ((this.idPass || this.infectedIdPass) && (this.lookdev || this.character)) {
      const backgroundNode = this.scene.backgroundNode; this.scene.backgroundNode = null;
      const background = this.scene.background, fog = this.scene.fog, shadow = this.renderer.shadowMap.enabled;
      this.scene.background = new Color(0); this.scene.fog = null; this.renderer.shadowMap.enabled = false;
      this.scene.traverse((child) => {
        if (child instanceof Mesh) { this.savedMaterials.set(child, child.material); let hero = this.lookdev?.playerMeshes.includes(child) ?? false;
          if (this.character) for (let parent = child.parent; parent; parent = parent.parent) if (parent === this.character) { hero = true; break; }
          const source = (Array.isArray(child.material) ? child.material[0] : child.material) as PaletteMaterial;
          if (this.infectedIdPass) {
            let infected = false;
            for (let parent = child.parent; parent; parent = parent.parent) if (parent === this.crowd) { infected = true; break; }
            let masks = this.infectedIdMasks.get(source);
            if (!masks) { masks = []; this.infectedIdMasks.set(source, masks); }
            const index = infected ? 1 : 0;
            masks[index] ??= new MeshBasicNodeMaterial({ color: infected ? '#ff00ff' : '#000000', side: source.side, depthTest: source.depthTest, depthWrite: source.depthWrite, transparent: source.transparent, opacity: source.opacity, alphaTest: source.alphaTest, alphaToCoverage: source.alphaToCoverage, opacityNode: source.opacityNode, positionNode: source.positionNode, maskNode: source.maskNode });
            child.material = masks[index];
          } else if (!hero && source.name === 'pal_leaf-card-crown') {
            if (!this.foliageIdMasks.has(source)) this.foliageIdMasks.set(source, new MeshBasicNodeMaterial({ color: '#000000', side: source.side, alphaTest: source.alphaTest, alphaToCoverage: source.alphaToCoverage, opacityNode: source.opacityNode, positionNode: source.positionNode }));
            child.material = this.foliageIdMasks.get(source)!;
          } else child.material = hero ? this.idPlayer : this.idBackground; }
      });
      this.idPlayer.depthTest = !this.courierForeground && !this.occlusion.getState().some((building) => building.blocked);
      this.renderer.render(this.scene, this.camera);
      for (const [mesh, material] of this.savedMaterials) mesh.material = material;
      this.savedMaterials.clear(); this.scene.background = background; this.scene.backgroundNode = backgroundNode; this.scene.fog = fog; this.renderer.shadowMap.enabled = shadow;
    } else if (this.postFx) { this.updateHeatHaze(this.postFx); this.postFx.render(); } else this.renderer.render(this.scene, this.camera);
    // Health bars keep their CSS size and contrast through DOF, bloom and vignette.
    if (this.healthBars?.count && !this.probeHide.bars && !this.idPass && !this.windowMask && !this.foliageMask) {
      this.renderBars();
    }
    if (profileStart) this.renderCpuMs = performance.now() - renderStart;
  }
  private renderBars(): void {
    this.healthBars?.setCourierMask(this.postFx?.sceneColor);
    const renderer = this.renderer, autoClear = renderer.autoClear, tone = renderer.toneMapping, color = renderer.outputColorSpace;
    try {
      // The material performs its own color conversion, like RenderPipeline's output quad.
      renderer.autoClear = false; renderer.toneMapping = NoToneMapping; renderer.outputColorSpace = ColorManagement.workingColorSpace;
      renderer.renderOverlay(this.barScene, this.camera);
    } finally { renderer.autoClear = autoClear; renderer.toneMapping = tone; renderer.outputColorSpace = color; }
  }
  /** Compact E18 effect counters without actor/pose snapshots. */
  effectPerf() { return this.vfx?.snapshot() ?? null; }
  terrainPerf() { return this.districts?.terrainState() ?? null; }
  /** E25 lighting-pass counters for perf(): light-field CPU ms and pools, shadow maps, the promoted hero shadow light. */
  lightingPerf() {
    const field = this.lighting?.field.snapshot();
    return field ? { lightFieldMs: field.ms, lightPools: field.drawn, lightCandidates: field.candidates, shadowMaps: this.renderer.shadowMap.enabled ? Number(this.lighting!.sun.visible && this.lighting!.sun.castShadow && this.lighting!.sun.shadow.autoUpdate) + Number(this.lighting!.spot.visible && this.lighting!.spot.castShadow && this.lighting!.spot.shadow.autoUpdate) : 0, heroLights: Number(this.lighting!.spot.visible && this.lighting!.spot.shadow.intensity > 0), heroShadow: Number(this.lighting!.spot.visible && this.lighting!.spot.castShadow && this.lighting!.spot.shadow.autoUpdate), preset: this.lighting!.preset } : null;
  }
  /** E25 light field of the loaded scene (E27 transients hook in here). */
  get lightField() { return this.lighting?.field ?? null; }
  /** E25 light field: layout pools plus per-frame vehicle lamps and the survivor aura, one pass before the scene. */
  private updateLights(): void {
    const metro=this.world.missions?.state.l6;if(metro)this.districts?.northgate(metro.gateAt>0);
    const lighting = this.lighting; if (!lighting) return;
    lighting.lamps.state = this.world.lightPower; lighting.lamps.update();
    if (this.world.lightPower) lighting.field.syncPower(id => this.world.lightPower!.isOn(id));
    let flashlight: ReturnType<typeof footprint> | null = null;
    const field = lighting.field, hero = this.character?.visible && this.world.entities.get(1) ? this.character.position : null;
    lighting.subwayDarkness.value = metro || lighting.preset === 'L6-subway' ? 1 : 0;
    this.character?.showHeadlamp(!!metro?.flashlight, !!metro);
    lighting.headlampOn.value = metro?.flashlight ? 1 : 0;
    const headlampYaw = this.world.entities.get(1)?.transform.yaw ?? 0;
    lighting.headlampAim.value.set(Math.cos(headlampYaw), -Math.sin(headlampYaw));
    if (hero) lighting.hero.value.copy(hero); else lighting.hero.value.set(0, -100, 0);
    lighting.setPlayerSmoke(!!hero && (this.world.combat?.effects.inSmoke(hero) ?? false));
    if (field.active) {
      const aura = timeOfDayPresets[lighting.preset].aura ?? 0;
      if (hero && aura > 0) field.push(auraLight(hero.x, hero.z, aura));
      if (hero && this.world.missions?.state.l6?.flashlight) {
        const yaw=this.world.entities.get(1)!.transform.yaw;
        flashlight = footprint({type:'spot',color:'light_led_white',intensity:9,range:18,angle:48,flicker:'none',shadow:'hero',position:[hero.x,hero.y+1,hero.z],direction:[Math.cos(yaw),-.3,-Math.sin(yaw)]});
        field.push(flashlight);
      }
      if (metro && lighting.preset === 'L6-subway') for (const entry of l6Entries) {
        const door = l6Doors[entry.door];
        field.push(footprint({type:'point',color:entry.door%2?'light_neon_blue':'light_siren_red',intensity:2,range:2.3,flicker:'damaged',position:[door.x,2.4,door.z],direction:[0,-1,0]}));
      }
      const sam = this.world.missions?.state.l5?.survivors.find(r => r.key === 'sam');
      const bus = this.world.missions?.def.anchors['l5-ring-sam'];
      if (sam?.status === 'hidden' && bus && this.world.tick % 90 < 45) {
        field.push(footprint({ type: 'point', color: 'light_led_white', intensity: 8, range: 5, flicker: 'none', shadow: 'none', position: [bus.x, 1.2, bus.z], direction: [0, -1, 0] }));
      }
      this.vehicles?.pushLights(field, aura, timeOfDayPresets[lighting.preset].headlightBeams ? (position, direction, length, angle, colour) => lighting.practicalEffects.pushBeam(position, direction, length, angle, colour) : undefined);
      // Pickups keep a small cool glint pool so loot stays findable in the dark.
      for (const entity of this.world.entities.iterate()) if (entity.pickup && !entity.hidden && !('collected' in entity.pickup && entity.pickup.collected)) field.push(pickupLight(entity.transform.x, entity.transform.z));
    }
    lighting.setHeroLight(hero && field.active ? flashlight ?? field.heroAt(hero.x, hero.z) : null, hero ?? this.view.focus, this.world.tick / 60);
    // Low W6 keeps the palette moon shade and contact shadows; a promoted fire
    // still owns its one hero shadow map. Avoid a second city-wide moon pass.
    if (this.world.scenario === 'L7' && this.quality === 'low') lighting.sun.visible = false;
    this.districts?.accents?.update(this.world.tick / 60);
    field.update(this.view.focus.x, this.view.focus.z, this.world.tick / 60);
    field.render(this.renderer);
  }
  async prepareCharacterVariant(): Promise<void> {
    if (this.world.scenario === 'L1' && this.missionHidden) return;
    const variant = this.world.entities.get(1)?.survivor?.variant;
    if (variant && this.character && await this.character.readyVariant(variant)) await this.warmHidden(this.character);
  }
  async ready(): Promise<void> {
    await this.warming;
    while (this.shadowWarmup) { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); this.update(1); }
    await this.prepareCharacterVariant();
    // Once a test has begun the mission, snapshots/heap checks settle the same streamed
    // residency on every load. A briefing snapshot waits only for its visible assets.
    if (this.params.get('test') === '1' && this.world.missions?.state.phase !== 'briefing') await this.preparation;
    this.accessories?.begin(); this.districts?.updateLods(this.view); this.crowd?.update(this.view); this.npcs?.update(this.camera, 1, this.view.lodCamera); this.accessories?.finish();
    await Promise.all([this.districts?.ready(), this.crowd?.ready(), this.npcs?.ready(), this.vehicles?.ready(), this.entityAssets?.ready(), this.interactions?.synchronize(), this.syncMountedGun()]);
    // Tier loads chain (LOD1 stand-in, then LOD0) and each step is requested by the next partition: settle them, so a snapshot
    // never shows a building drawn from a stand-in mesh (lod-pop: the first Scene Lab frame showed crude LOD2 shapes).
    for (let i = 0; i < 6 && this.districts?.placeholderDraws().length; i++) { this.districts.updateLods(this.view); await this.districts.ready(); }
  }
  /** Same-district transitions reuse decoded prototypes; leaving the district retires the cache. */
  reset(nextDistricts?: string): void {
    this.solidCutProbeOff = false;
    const retain = !!nextDistricts && nextDistricts === this.resourceDistricts;
    this.weatherProbeAsset = null; this.weatherPowerRevision = 0;
    if (this.weather) { this.scene.remove(this.weather); this.weather.dispose(); this.weather = null; }
    this.shadowWarmup?.cancel(); this.shadowWarmup = null;
    this.playSeconds = 0; this.generation++; this.pendingPreparation = null; this.preparation = null; this.epiloguePrepared = null; this.warming = null;
    if (this.background) { loadGate.setPaced(true); loadGate.background = true; } else loadGate.setPaced(false);
    this.contactShadows?.removeFromParent(); this.contactShadows?.dispose(); this.contactShadows = null;
    if (this.npcs) { this.scene.remove(this.npcs); this.npcs.dispose(); this.npcs = null; }
    if (this.labAccident) { this.scene.remove(this.labAccident.column); this.labAccident.dispose(); this.labAccident = null; }
    if (this.vfx) { this.scene.remove(this.vfx); this.vfx.dispose(); this.vfx = null; }
    if (this.vehicleFeedback) { this.scene.remove(this.vehicleFeedback); this.vehicleFeedback.dispose(); this.vehicleFeedback = null; }
    this.missionUI?.reset(); this.cinematicId = null; if(this.marker){this.scene.remove(this.marker);this.marker.dispose();this.marker=null;} if (this.survivorRings) { this.scene.remove(this.survivorRings); this.survivorRings.dispose(); this.survivorRings = null; }
    if (this.fixtureProps) { this.scene.remove(this.fixtureProps); this.fixtureProps.dispose(); this.fixtureProps = null; }
    if (this.interactions) { this.scene.remove(this.interactions); this.interactions.dispose(); this.interactions = null; }
    if (this.mountedGunView) { this.scene.remove(this.mountedGunView); this.mountedGunView.dispose(); this.mountedGunView = null; }
    if (this.militaryPerimeter) { this.militaryPerimeter.removeFromParent(); this.militaryPerimeter.dispose(); this.militaryPerimeter = null; }
    if (this.entityAssets) { this.scene.remove(this.entityAssets); this.entityAssets.dispose(); this.entityAssets = null; }
    if (this.vehicles) { this.scene.remove(this.vehicles); this.vehicles.dispose(); this.vehicles = null; }
    if (this.l2Props) { this.scene.remove(this.l2Props); this.l2Props.dispose(); this.l2Props = null; }
    if (this.l3Props) { this.scene.remove(this.l3Props); this.l3Props.dispose(); this.l3Props = null; }
    if (this.bicycle) { this.scene.remove(this.bicycle); this.bicycle.dispose(); this.bicycle = null; }
    this.windowMask=false; this.foliageMask=false;
    for (const material of this.foliageMasks.values()) material.dispose(); this.foliageMasks.clear();
    for (const material of this.foliageIdMasks.values()) material.dispose(); this.foliageIdMasks.clear();
    for (const masks of this.infectedIdMasks.values()) for (const material of masks) material?.dispose(); this.infectedIdMasks.clear(); this.infectedIdPass = false;
    if (this.postFx) { this.postFx.dispose(); this.retiredPostFx = this.postFx.diagnostics(); } this.postFx = null; this.dofEnabled = false;
    for (const district of this.preparedDistrictViews.values()) { this.scene.remove(district); district.dispose(); }
    if (this.districts && !this.preparedDistrictViews.has(this.districts.world)) { this.scene.remove(this.districts); this.districts.dispose(); }
    this.preparedDistrictViews.clear(); this.districts = null;
    this.frozenStarted = -1; this.frozenPose = null;
    pickBodies.reset();
    if (this.healthBars) { this.healthBars.removeFromParent(); this.healthBars.dispose(); this.healthBars = null; }
    if (this.accessories) { this.scene.remove(this.accessories); this.accessories.dispose(); this.accessories = null; }
    if (this.crowd) { this.scene.remove(this.crowd); this.crowd.dispose(); this.crowd = null; }
    if (this.actions) { this.scene.remove(this.actions); this.actions.dispose(); this.actions = null; }
    if (this.character) { this.scene.remove(this.character); this.character.dispose(); this.character = null; }
    if (this.lookdev) { this.scene.remove(this.lookdev); this.lookdev.dispose(); this.lookdev = null; }
    if(this.materials!==this.districtResources?.materials)this.materials?.dispose();this.materials=null;
    if(this.lighting===this.districtResources?.lighting)this.scene.remove(this.lighting.sun,this.lighting.sun.target,this.lighting.hemisphere,this.lighting.spot,this.lighting.spot.target,this.lighting.practicalEffects);else this.lighting?.dispose();this.lighting=null;
    if (retain && this.districtResources) {
      this.districtResources.lighting.field.reset(); this.districtResources.lighting.setGloom(1);
    } else {
      this.districtResources?.registry.dispose(); this.districtResources?.grassMaterial.dispose(); this.districtResources?.materials.dispose(); this.districtResources?.lighting.dispose(); this.districtResources = null; this.resourceDistricts = '';
    }
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
  dispose(): void { this.reset(); this.environment?.dispose(); this.environment = undefined; this.missionUI?.dispose(); this.missionUI=null; window.removeEventListener('resize', this.resize); this.idPlayer.dispose(); this.idBackground.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); this.flashOverlay.remove(); }
}
