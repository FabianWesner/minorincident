import { NpcView } from './npc/NpcView';
import { qualityBudgets, type QualityTier } from '../core/Quality';
import { CrowdView } from './CrowdView';
import { MissionUI } from '../ui/MissionUI';
import { ObjectiveMarker } from './ObjectiveMarker';
import { VehicleView } from './VehicleView';
import { combatPhotoSpots } from '../../tests/fixtures/scenarios/combat-arena';
import { ActionView } from './ActionView';
import type { SurvivorState } from '../data/survivor';
import { CharacterView } from './characters/CharacterView';
import { BoxGeometry, Color, Mesh, MeshBasicNodeMaterial, PlaneGeometry, RingGeometry, Scene, type Material } from 'three/webgpu';
import type { Lifecycle } from '../core/Lifecycle';
import { lerp } from '../core/maths';
import type { SimWorld } from '../sim/world/SimWorld';
import { MeshGridMaterial } from './MeshGridMaterial';
import { PhysicsWireframe } from './PhysicsWireframe';
import { View } from './View';
import { Renderer } from './Renderer';
import { Lighting } from './Lighting';
import { Materials } from './Materials';
import { Lookdev } from './Lookdev';
import { Occlusion } from './Occlusion';
import { PostFx } from './PostFx';
import { photoSpots } from '../../tests/fixtures/scenarios/lookdev';
import type { TimeOfDay } from '../data/timeOfDay';
import { Vector3 } from 'three';
import { VehicleFeedback } from './vfx/VehicleFeedback';
import { Vfx, type VfxSettings } from './vfx/Vfx';
import { DistrictAssets } from '../assets/DistrictAssets';
import { Grass, windPhase } from './Grass';
import { DistrictView } from './DistrictView';
import { PaletteMaterial } from './PaletteMaterial';
import { InteractionView } from './InteractionView';
import { EntityAssets } from './EntityAssets';

/** Presentation composition: E01 fixture or E02 lookdev, with state flowing only from sim to view. */
export class GameView implements Lifecycle {
  readonly scene = new Scene();
  private missionUI: MissionUI | null = null;
  private marker: ObjectiveMarker | null = null;
  private cinematicId: string | null = null;
  readonly view = new View();
  readonly camera = this.view.camera;
  renderer: Renderer;
  contextLost = false;
  private lostRendererDisposal: Promise<void> | null = null;
  renderedFrames = 0;
  private readonly meshes: Mesh[] = [];
  private vehicles: VehicleView | null = null;
  private actions: ActionView | null = null;
  private crowd: CrowdView | null = null;
  private npcs: NpcView | null = null;
  private interactions: InteractionView | null = null;
  private entityAssets: EntityAssets | null = null;
  vfx: Vfx | null = null;
  private vehicleFeedback: VehicleFeedback | null = null;
  private readonly vfxSettings: VfxSettings = {};
  private hitStopTick = 0;
  private frozenStarted = -1;
  private frozenPose: SurvivorState | null = null;
  private destination: Mesh | null = null;
  private cube: Mesh | null = null;
  private character: CharacterView | null = null;
  private wireframe: PhysicsWireframe | null = null;
  private lighting: Lighting | null = null;
  private materials: Materials | null = null;
  private districtResources:{lighting:Lighting;materials:Materials;registry:DistrictAssets;phase:ReturnType<typeof windPhase>;grassMaterial:ReturnType<typeof Grass.material>}|null=null;
  private districts:DistrictView|null=null;
  private windowMask=false;
  private lookdev: Lookdev | null = null;
  private postFx: PostFx | null = null;
  private readonly occlusion = new Occlusion();
  private readonly playerPosition = new Vector3();
  private readonly projection = new Vector3();
  private readonly cullFocus = new Vector3();
  private idPass = false;
  private readonly flashOverlay = document.createElement('div');
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
    if (changed && this.postFx) { const enabled = this.postFx.bloomEnabled.value; this.postFx.dispose(); this.postFx = new PostFx(this.renderer, this.scene, this.camera, tier); this.postFx.bloomEnabled.value = enabled; }
    this.lighting?.setQuality(tier); this.districts?.setQuality(tier);
    this.vfx?.set({ quality: tier }); this.crowd?.setQuality(tier);
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
    if (this.world.districts) {
      this.renderer.shadowMap.enabled=true;
      if(!this.districtResources){
        const lighting=new Lighting(this.scene),materials=new Materials(lighting),registry=new DistrictAssets(materials,this.renderer),phase=windPhase();
        this.districtResources={lighting,materials,registry,phase,grassMaterial:Grass.material(materials,phase)};
      }
      const shared=this.districtResources;this.lighting=shared.lighting;this.materials=shared.materials;this.scene.add(this.lighting.sun,this.lighting.sun.target,this.lighting.hemisphere);this.lighting.set(this.world.districts.composition.timeOfDay);
      this.districts=new DistrictView(this.world.districts,this.materials,shared.registry,shared.phase,shared.grassMaterial,this.quality === 'low');await this.districts.load(1);
      this.scene.add(this.districts);this.postFx=new PostFx(this.renderer,this.scene,this.camera,this.quality);

      this.character=new CharacterView();await this.character.init(this.materials, Boolean(this.world.combat), this.quality === 'low');this.scene.add(this.character);
    } else if (this.world.player) {
      this.renderer.shadowMap.enabled = true;
      this.lighting = new Lighting(this.scene); this.materials = new Materials(this.lighting);
      const ground = new Mesh(new PlaneGeometry(this.world.combat?.definition.ground.width ?? 100, this.world.combat?.definition.ground.depth ?? 100), this.materials.get('sidewalk')); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
      this.meshes.push(ground); this.scene.add(ground);
      if (this.world.scenario === 'horde-readability') {
        this.lookdev = new Lookdev(this.materials, this.occlusion, false); this.scene.add(this.lookdev);
        this.postFx = new PostFx(this.renderer, this.scene, this.camera, this.quality);
      }
      this.character = new CharacterView(); await this.character.init(this.materials, Boolean(this.world.combat), this.quality === 'low'); this.scene.add(this.character);
    } else if (this.world.scenario === 'lookdev') {
      this.renderer.shadowMap.enabled = true;
      this.lighting = new Lighting(this.scene); this.materials = new Materials(this.lighting);
      this.lookdev = new Lookdev(this.materials, this.occlusion); this.scene.add(this.lookdev);
      this.postFx = new PostFx(this.renderer, this.scene, this.camera, this.quality);
    } else {
      const ground = new Mesh(new PlaneGeometry(100, 100), new MeshGridMaterial());
      ground.rotation.x = -Math.PI / 2;
      this.cube = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicNodeMaterial({ color: '#ed935c' }));
      this.meshes.push(ground, this.cube); this.scene.add(...this.meshes);
    }
    if (player) {
      const material = new MeshBasicNodeMaterial({ color: '#64ffce', depthWrite: false, depthTest: false }); material.name = 'keep_moveMarker';
      this.destination = new Mesh(new RingGeometry(.22, .32, 32), material);
      this.destination.renderOrder = 10; this.destination.rotation.x = -Math.PI / 2; this.destination.visible = false;
      this.meshes.push(this.destination); this.scene.add(this.destination);
    }
    if (this.world.npcs && this.materials) { this.npcs = new NpcView(this.world, this.materials); await this.npcs.init(); this.scene.add(this.npcs); }
    if (this.character) { this.entityAssets = new EntityAssets(this.world, this.quality === 'low'); await this.entityAssets.init(this.view); this.scene.add(this.entityAssets); }
    if (this.world.combat && this.character) { this.actions = new ActionView(this.world, this.character, this.materials!, this.renderer); await this.actions.init(); this.actions.update(); this.scene.add(this.actions); }
    if (this.world.missions) { this.marker = new ObjectiveMarker(this.world); this.scene.add(this.marker); }
    if (this.character && this.world.combat) { this.crowd = new CrowdView(this.world, this.quality === 'low'); await this.crowd.init(); this.scene.add(this.crowd); }
    if (this.world.interactables && this.materials) {
      this.interactions = new InteractionView(this.world, this.materials, this.view, this.quality === 'low'); this.scene.add(this.interactions); await this.interactions.synchronize();
    }
    if (this.world.vehicles?.cars.size && this.materials) { this.vehicles = new VehicleView(this.world, this.materials, this.view, this.quality === 'low'); await this.vehicles.load(); this.scene.add(this.vehicles); }
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
      });
      this.vfx.set({ ...this.vfxSettings, quality: this.quality }); this.scene.add(this.vfx);
      this.crowd?.setGoreEnabled(this.vfx.snapshot().enabled && this.vfx.snapshot().gore === 'Full');
      const survivor = this.world.entities.get(1)?.survivor;
      this.frozenPose = survivor ? structuredClone(survivor) : null;
    }
    if (this.world.scenario === 'drive-course') this.postFx = new PostFx(this.renderer, this.scene, this.camera, this.quality);
    if (import.meta.env.DEV && this.params.has('debug')) {
      this.wireframe = new PhysicsWireframe(this.world.physics); this.scene.add(this.wireframe.lines);
    }
    this.lighting?.setQuality(this.quality); this.districts?.setQuality(this.quality); this.crowd?.setQuality(this.quality);
    // Native soft-particle depth samplers must compile with the actual MSAA target
    // bound. The first update below warms those programs in their render context.
    this.districts?.updateLods(this.view); this.crowd?.update(this.view); await Promise.all([this.crowd?.ready(), this.districts?.ready()]);
    if (!this.vfx || this.renderer.selectedBackend === 'webgl') await this.renderer.compileAsync(this.scene, this.camera);
    this.idPass = this.params.get('idpass') === '1'; this.update(1);
  }
  /** Real render seconds, deliberately independent of sim ticks/time scale. */
  frame(seconds: number): void { this.vfx?.advance(Math.min(1, seconds)); }
  advance(seconds: number): void {
    this.districts?.advance(seconds);
    const player = this.world.entities.get(1);
    if (player) {
      this.view.driving = this.world.vehicles?.active != null;
      this.view.update(player.transform, seconds);
      this.playerPosition.set(player.transform.x, player.transform.y - 0.5, player.transform.z);
      if (this.lookdev) this.occlusion.update(this.camera, this.playerPosition, seconds, this.lookdev.playerMeshes);
    }
  }
  /** Photo spots are only registered by the current scenario. */
  preset(name: string): void {
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
  /** Render settings only; persistence and gameplay accessibility remain owned by E14. */
  settings(patch: { cameraShake?: boolean; bloom?: boolean; cheapDof?: boolean; timeOfDay?: TimeOfDay; occludersVisible?: boolean; idPass?: boolean; windowMask?: boolean } & VfxSettings): void {
    this.vfx?.set(patch);
    if (patch.gore !== undefined || patch.vfx !== undefined) this.crowd?.setGoreEnabled(this.vfx?.snapshot().enabled === true && this.vfx.snapshot().gore === 'Full');
    if (patch.colorblind !== undefined) this.vfxSettings.colorblind = patch.colorblind;
    if (patch.vfx !== undefined) this.vfxSettings.vfx = patch.vfx;
    if (patch.gore !== undefined) this.vfxSettings.gore = patch.gore;
    if (patch.flashReduction !== undefined) this.vfxSettings.flashReduction = patch.flashReduction;
    if (patch.quality !== undefined) this.vfxSettings.quality = patch.quality;
    if (patch.cameraShake !== undefined) { this.view.cameraShake = patch.cameraShake; this.advance(0); }
    if (patch.bloom !== undefined && this.postFx) this.postFx.bloomEnabled.value = Number(patch.bloom);
    if (patch.cheapDof !== undefined && this.postFx) this.postFx.setDof(patch.cheapDof);
    if (patch.timeOfDay !== undefined) this.lighting?.set(patch.timeOfDay);
    if (patch.occludersVisible !== undefined) this.occlusion.visible = patch.occludersVisible;
    if(patch.windowMask!==undefined)this.windowMask=patch.windowMask;
    if (patch.idPass !== undefined) this.idPass = patch.idPass;
    this.update(1);
  }
  /** Project a world point to viewport-normalized coordinates, for masks and input integration. */
  project(x: number, y: number, z: number): number[] { return this.projection.set(x, y, z).project(this.camera).toArray(); }
  getState() {
    const materialInventory = new Map<string, { name: string; palette: boolean }>();
    this.scene.traverse((child) => { if (child instanceof Mesh) for (const material of Array.isArray(child.material) ? child.material : [child.material]) materialInventory.set(material.uuid, { name: material.name, palette: material instanceof PaletteMaterial }); });
    return { quality: this.quality, pixelRatio: this.renderer.getPixelRatio(), postFx: this.postFx?.snapshot() ?? null, moveMarker: this.destination ? { visible: this.destination.visible, position: this.destination.position.toArray() } : null, missionMarker:this.marker ? {visible:this.marker.visible,position:this.marker.position.toArray()} : null, districts:this.districts?.getState()??null, backend: this.renderer.selectedBackend, camera: this.view.getState(), lighting: this.lighting?.getState() ?? null,
      npcs: this.npcs?.snapshot() ?? null,
      vehicles: [...(this.vehicles?.snapshot() ?? []), ...(this.vehicleFeedback?.getState() ?? []).map(v => ({ ...v, wheels: [], brake: 0, sirens: [], placeholder: true }))], entityAssets: this.entityAssets?.getState() ?? null, character: this.character?.getState() ?? null, crowd: this.crowd?.getState() ?? null, actions: this.actions?.getState() ?? null,
      vfx: this.vfx?.snapshot() ?? null, infected: this.crowd?.getGoreState() ?? [],
      materials: [...materialInventory.values()], occlusion: this.occlusion.getState(),
      probes: this.lookdev ? { lamp: this.project(...this.lookdev.lampHead.position.toArray() as [number, number, number]), shadow: this.project(...this.lookdev.shadowProbe.position.toArray() as [number, number, number]) } : null };
  }
  private syncMission(): void {
    const mission = this.world.missions, cinematic = mission?.state.cinematic;
    if (cinematic && this.cinematicId !== cinematic.id) { this.cinematicId = cinematic.id; this.view.cinematic(mission!.def.cinematics[cinematic.id]); }
    else if (!cinematic && this.cinematicId) { this.cinematicId = null; this.view.follow(); }
    if (mission?.state.timeOfDay && this.lighting?.preset !== mission.state.timeOfDay) this.lighting?.set(mission.state.timeOfDay);
  }
  update(alpha = 1): void {
    if (this.contextLost) return;
    if (this.destination) {
      const target = this.world.controls.moveTarget; this.destination.visible = target != null;
      if (target) this.destination.position.set(target.x, .12, target.z);
    }
    this.syncMission();
    const current = this.world.entities.get(1)?.transform, previous = this.world.previousPlayer;
    const survivor = this.world.entities.get(1)?.survivor;
    if (this.character && current && survivor) {
      // Portrait hero readability supplements the seven-metre camera floor; collision stays in metres.
      this.character.scale.setScalar(this.camera.aspect < 1 ? 1.25 : 1);
      this.character.position.set(lerp(previous?.x ?? current.x, current.x, alpha), lerp(previous?.y ?? current.y, current.y, alpha) - 0.7, lerp(previous?.z ?? current.z, current.z, alpha));
      const from = previous?.yaw ?? current.yaw;
      this.character.face(from + Math.atan2(Math.sin(current.yaw - from), Math.cos(current.yaw - from)) * alpha, (this.world.tick + alpha) / 60);
      const stopped = this.vfx?.hitStop.active(this.vfx.time) ?? false;
      if (stopped && this.vfx!.hitStop.started !== this.frozenStarted && this.frozenPose) {
        this.frozenStarted = this.vfx!.hitStop.started; this.hitStopTick = this.world.tick;
        const velocity = this.frozenPose.velocity, checkpoint = this.frozenPose.checkpoint;
        Object.assign(this.frozenPose, survivor);
        this.frozenPose.velocity = velocity; Object.assign(velocity, survivor.velocity);
        this.frozenPose.checkpoint = checkpoint; Object.assign(checkpoint, survivor.checkpoint);
      }
      this.character.update(stopped && this.frozenPose ? this.frozenPose : survivor, stopped ? this.hitStopTick : this.world.tick, stopped ? 1 : alpha);
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
    this.vehicles?.update(alpha);
    if (this.actions) this.actions.visible = !this.world.entities.get(1)?.hidden;
    this.marker?.update(); this.missionUI?.update(this.camera,innerWidth,innerHeight);
    this.crowd?.update(this.view); this.actions?.update();
    this.entityAssets?.update();
    this.interactions?.update(this.camera); this.npcs?.update(this.camera);
    this.flashOverlay.style.opacity = String(this.vfx?.flash ?? 0);
    this.lighting?.update(this.view); this.districts?.updateLods(this.view);
    if (this.districts) {
      this.camera.getWorldDirection(this.cullFocus);
      if (Math.abs(this.cullFocus.y) > .0001) this.cullFocus.multiplyScalar(-this.camera.position.y / this.cullFocus.y).add(this.camera.position);
      else this.cullFocus.copy(this.view.focus);
      this.districts.cull(this.cullFocus, this.quality);
    }
    this.wireframe?.update();
    // We own RAF, so reset counters per render rather than relying on setAnimationLoop.
    this.renderer.info.reset(); this.renderedFrames++;
    if(this.windowMask&&this.districts){
      const background=this.scene.background,fog=this.scene.fog,shadow=this.renderer.shadowMap.enabled;
      this.scene.background=new Color(0);this.scene.fog=null;this.renderer.shadowMap.enabled=false;this.districts.mask(true);const heroVisible=this.character?.visible;if(this.character)this.character.visible=false;this.renderer.render(this.scene,this.camera);if(this.character)this.character.visible=heroVisible!;this.districts.mask(false);this.scene.background=background;this.scene.fog=fog;this.renderer.shadowMap.enabled=shadow;
    } else if (this.idPass && (this.lookdev || this.character)) {
      const background = this.scene.background, fog = this.scene.fog, shadow = this.renderer.shadowMap.enabled;
      this.scene.background = new Color(0); this.scene.fog = null; this.renderer.shadowMap.enabled = false;
      this.scene.traverse((child) => {
        if (child instanceof Mesh) { this.savedMaterials.set(child, child.material); let hero = this.lookdev?.playerMeshes.includes(child) ?? false;
          if (this.character) for (let parent = child.parent; parent; parent = parent.parent) if (parent === this.character) { hero = true; break; }
          child.material = hero ? this.idPlayer : this.idBackground; }
      });
      this.idPlayer.depthTest = !this.occlusion.getState().some((building) => building.blocked);
      this.renderer.render(this.scene, this.camera);
      for (const [mesh, material] of this.savedMaterials) mesh.material = material;
      this.savedMaterials.clear(); this.scene.background = background; this.scene.fog = fog; this.renderer.shadowMap.enabled = shadow;
    } else if (this.postFx) this.postFx.render(); else this.renderer.render(this.scene, this.camera);
  }
  async ready(): Promise<void> {
    this.districts?.updateLods(this.view); this.crowd?.update(this.view);
    await Promise.all([this.districts?.ready(), this.crowd?.ready(), this.vehicles?.ready(), this.entityAssets?.ready(), this.interactions?.synchronize()]); }
  reset(): void {
    if (this.npcs) { this.scene.remove(this.npcs); this.npcs.dispose(); this.npcs = null; }
    if (this.vfx) { this.scene.remove(this.vfx); this.vfx.dispose(); this.vfx = null; }
    if (this.vehicleFeedback) { this.scene.remove(this.vehicleFeedback); this.vehicleFeedback.dispose(); this.vehicleFeedback = null; }
    this.missionUI?.reset(); this.cinematicId = null; if(this.marker){this.scene.remove(this.marker);this.marker.dispose();this.marker=null;}
    if (this.interactions) { this.scene.remove(this.interactions); this.interactions.dispose(); this.interactions = null; }
    if (this.entityAssets) { this.scene.remove(this.entityAssets); this.entityAssets.dispose(); this.entityAssets = null; }
    if (this.vehicles) { this.scene.remove(this.vehicles); this.vehicles.dispose(); this.vehicles = null; }
    this.windowMask=false;
    this.postFx?.dispose();this.postFx = null;
    if(this.districts){this.scene.remove(this.districts);this.districts.dispose();this.districts=null;}
    this.frozenStarted = -1; this.frozenPose = null;
    if (this.crowd) { this.scene.remove(this.crowd); this.crowd.dispose(); this.crowd = null; }
    if (this.actions) { this.scene.remove(this.actions); this.actions.dispose(); this.actions = null; }
    if (this.character) { this.scene.remove(this.character); this.character.dispose(); this.character = null; }
    if (this.lookdev) { this.scene.remove(this.lookdev); this.lookdev.dispose(); this.lookdev = null; }
    if(this.materials!==this.districtResources?.materials)this.materials?.dispose();this.materials=null;
    if(this.lighting===this.districtResources?.lighting)this.scene.remove(this.lighting.sun,this.lighting.sun.target,this.lighting.hemisphere);else this.lighting?.dispose();this.lighting=null;
    this.districtResources?.registry.dispose(); this.districtResources?.grassMaterial.dispose(); this.districtResources?.materials.dispose(); this.districtResources?.lighting.dispose(); this.districtResources = null;
    this.occlusion.reset(); this.idPass = false; this.scene.fog = null; this.scene.background = new Color('#293447'); this.renderer.shadowMap.enabled = false;
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
