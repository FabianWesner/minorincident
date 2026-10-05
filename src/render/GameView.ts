import { CombatView } from './CombatView';
import type { SurvivorState } from '../data/survivor';
import { CharacterView } from './characters/CharacterView';
import { BoxGeometry, Color, Mesh, MeshBasicNodeMaterial, PlaneGeometry, Scene, type Material } from 'three/webgpu';
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

/** Presentation composition: E01 fixture or E02 lookdev, with state flowing only from sim to view. */
export class GameView implements Lifecycle {
  readonly scene = new Scene();
  readonly view = new View();
  readonly camera = this.view.camera;
  readonly renderer: Renderer;
  private readonly meshes: Mesh[] = [];
  private combat: CombatView | null = null;
  vfx: Vfx | null = null;
  private vehicles: VehicleFeedback | null = null;
  private readonly vfxSettings: VfxSettings = {};
  private hitStopTick = 0;
  private frozenStarted = -1;
  private frozenPose: SurvivorState | null = null;
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
  private idPass = false;
  private readonly flashOverlay = document.createElement('div');
  private readonly idBackground = new MeshBasicNodeMaterial({ color: '#000000' });
  private readonly idPlayer = new MeshBasicNodeMaterial({ color: '#ff00ff' });
  private readonly savedMaterials = new Map<Mesh, Material | Material[]>();
  constructor(private readonly world: SimWorld, private readonly params: URLSearchParams) {
    this.renderer = new Renderer(params);
    this.idBackground.name = 'keep_idBackground'; this.idPlayer.name = 'keep_idPlayer';
    this.scene.background = new Color('#293447');
  }
  async init(): Promise<void> {
    await this.renderer.init(); this.resize();
    this.renderer.domElement.style.display = 'block';
    document.querySelector('#game')!.appendChild(this.renderer.domElement);
    this.flashOverlay.style.cssText = 'position:fixed;inset:0;background:white;opacity:0;pointer-events:none;z-index:3';
    document.querySelector('#game')!.appendChild(this.flashOverlay);
    window.addEventListener('resize', this.resize);
  }
  private readonly resize = (): void => {
    const dpr = Number(this.params.get('dpr') ?? Math.min(devicePixelRatio, 2));
    this.renderer.setPixelRatio(Number.isFinite(dpr) && dpr > 0 ? dpr : 1);
    this.renderer.setSize(innerWidth, innerHeight);
    this.view.resize(innerWidth, innerHeight); this.update(1);
  };
  async load(): Promise<void> {
    this.reset();
    const player = this.world.entities.get(1);
    this.view.reset(player?.transform ?? { x: 0, z: 0 });
    if (this.world.districts) {
      this.renderer.shadowMap.enabled=true;
      if(!this.districtResources){
        const lighting=new Lighting(this.scene),materials=new Materials(lighting),registry=new DistrictAssets(materials),phase=windPhase();
        this.districtResources={lighting,materials,registry,phase,grassMaterial:Grass.material(materials,phase)};
      }
      const shared=this.districtResources;this.lighting=shared.lighting;this.materials=shared.materials;this.scene.add(this.lighting.sun,this.lighting.sun.target,this.lighting.hemisphere);this.lighting.set(this.world.districts.composition.timeOfDay);
      this.districts=new DistrictView(this.world.districts,this.materials,shared.registry,shared.phase,shared.grassMaterial);await this.districts.load(1);
      this.scene.add(this.districts);this.postFx=new PostFx(this.renderer,this.scene,this.camera);

      this.character=new CharacterView();await this.character.init(this.materials);this.scene.add(this.character);
    } else if (this.world.player) {
      this.renderer.shadowMap.enabled = true;
      this.lighting = new Lighting(this.scene); this.materials = new Materials(this.lighting);
      const ground = new Mesh(new PlaneGeometry(this.world.combat?.definition.ground.width ?? 100, this.world.combat?.definition.ground.depth ?? 100), this.materials.get('sidewalk')); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
      this.meshes.push(ground); this.scene.add(ground);
      if (this.world.combat) {
        this.combat = new CombatView(this.world, this.materials); this.scene.add(this.combat);
      }
      this.character = new CharacterView(); await this.character.init(this.materials, Boolean(this.world.combat)); this.scene.add(this.character);
      if (this.world.combat) {
        this.vehicles = new VehicleFeedback(this.materials); this.scene.add(this.vehicles);
        this.vfx = new Vfx(this.world, {
          flash: (id, strength) => this.combat?.flash(id, strength),
          detach: (id, limb) => this.combat?.detach(id, limb),
          blood: (coverage) => this.character?.setBlood(coverage),
          vehicle: (event, bloodEnabled) => this.vehicles?.update(event, bloodEnabled),
          vehicleBloodEnabled: (enabled) => this.vehicles?.setBloodEnabled(enabled),
          clearGore: () => this.combat?.clearGore(),
          shake: (strength) => this.view.shake(strength),
        }, this.combat!.gibGeometries);
        this.vfx.set({ quality: this.params.get('quality') === 'low' ? 'low' : 'high', ...this.vfxSettings }); this.scene.add(this.vfx);
        this.frozenPose = structuredClone(this.world.entities.get(1)!.survivor!);
      }
    } else if (this.world.scenario === 'lookdev') {
      this.renderer.shadowMap.enabled = true;
      this.lighting = new Lighting(this.scene); this.materials = new Materials(this.lighting);
      this.lookdev = new Lookdev(this.materials, this.occlusion); this.scene.add(this.lookdev);
      this.postFx = new PostFx(this.renderer, this.scene, this.camera);
    } else {
      const ground = new Mesh(new PlaneGeometry(100, 100), new MeshGridMaterial());
      ground.rotation.x = -Math.PI / 2;
      this.cube = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicNodeMaterial({ color: '#ed935c' }));
      this.meshes.push(ground, this.cube); this.scene.add(...this.meshes);
    }
    if (import.meta.env.DEV && this.params.has('debug')) {
      this.wireframe = new PhysicsWireframe(this.world.physics); this.scene.add(this.wireframe.lines);
    }
    await this.renderer.compileAsync(this.scene, this.camera);
    this.idPass = this.params.get('idpass') === '1'; this.update(1);
  }
  /** Real render seconds, deliberately independent of sim ticks/time scale. */
  frame(seconds: number): void { this.vfx?.advance(Math.min(1, seconds)); this.combat?.advance(seconds); }
  advance(seconds: number): void {
    this.districts?.advance(seconds);
    const player = this.world.entities.get(1);
    if (player) {
      this.view.update(player.transform, seconds);
      this.playerPosition.set(player.transform.x, player.transform.y - 0.5, player.transform.z);
      if (this.lookdev) this.occlusion.update(this.camera, this.playerPosition, seconds, this.lookdev.playerMeshes);
    }
  }
  /** Photo spots are only registered by the current scenario. */
  preset(name: string): void {
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
    return { districts: this.districts?.getState() ?? null, backend: this.renderer.selectedBackend, camera: this.view.getState(), lighting: this.lighting?.getState() ?? null,
      character: this.character?.getState() ?? null, vfx: this.vfx?.snapshot() ?? null, vehicles: this.vehicles?.getState() ?? [], infected: this.combat?.getState() ?? [],
      materials: [...materialInventory.values()], occlusion: this.occlusion.getState(),
      probes: this.lookdev ? { lamp: this.project(...this.lookdev.lampHead.position.toArray() as [number, number, number]), shadow: this.project(...this.lookdev.shadowProbe.position.toArray() as [number, number, number]) } : null };
  }
  update(alpha = 1): void {
    const current = this.world.entities.get(1)?.transform, previous = this.world.previousPlayer;
    const survivor = this.world.entities.get(1)?.survivor;
    if (this.character && current && survivor) {
      this.character.position.set(lerp(previous?.x ?? current.x, current.x, alpha), lerp(previous?.y ?? current.y, current.y, alpha) - 0.7, lerp(previous?.z ?? current.z, current.z, alpha));
      const from = previous?.yaw ?? current.yaw;
      this.character.rotation.y = from + Math.atan2(Math.sin(current.yaw - from), Math.cos(current.yaw - from)) * alpha;
      const stopped = this.vfx?.hitStop.active(this.vfx.time) ?? false;
      if (stopped && this.vfx!.hitStop.started !== this.frozenStarted && this.frozenPose) {
        this.frozenStarted = this.vfx!.hitStop.started; this.hitStopTick = this.world.tick;
        const velocity = this.frozenPose.velocity, checkpoint = this.frozenPose.checkpoint;
        Object.assign(this.frozenPose, survivor);
        this.frozenPose.velocity = velocity; Object.assign(velocity, survivor.velocity);
        this.frozenPose.checkpoint = checkpoint; Object.assign(checkpoint, survivor.checkpoint);
      }
      this.character.update(stopped && this.frozenPose ? this.frozenPose : survivor, stopped ? this.hitStopTick : this.world.tick, alpha);
    }
    if (this.cube && current) {
      this.cube.position.set(lerp(previous?.x ?? current.x, current.x, alpha), lerp(previous?.y ?? current.y, current.y, alpha), lerp(previous?.z ?? current.z, current.z, alpha));
      this.cube.rotation.y = current.yaw;
    }
    if (this.lookdev && current) {
      this.lookdev.player.position.set(lerp(previous?.x ?? current.x, current.x, alpha), current.y - 0.5, lerp(previous?.z ?? current.z, current.z, alpha));
      this.lookdev.player.rotation.y = current.yaw;
      this.playerPosition.copy(this.lookdev.player.position);
      this.occlusion.update(this.camera, this.playerPosition, 0, this.lookdev.playerMeshes);
    }
    this.flashOverlay.style.opacity = String(this.vfx?.flash ?? 0);
    this.combat?.update();
    this.lighting?.update(this.view);
    this.wireframe?.update();
    // We own RAF, so reset counters per render rather than relying on setAnimationLoop.
    this.renderer.info.reset();
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
  reset(): void {
    if (this.vfx) { this.scene.remove(this.vfx); this.vfx.dispose(); this.vfx = null; }
    if (this.vehicles) { this.scene.remove(this.vehicles); this.vehicles.dispose(); this.vehicles = null; }
    this.frozenStarted = -1; this.frozenPose = null;
    this.windowMask=false;
    this.postFx?.dispose();this.postFx = null;
    if(this.districts){this.scene.remove(this.districts);this.districts.dispose();this.districts=null;}
    if (this.combat) { this.scene.remove(this.combat); this.combat.dispose(); this.combat = null; }
    if (this.character) { this.scene.remove(this.character); this.character.dispose(); this.character = null; }
    if (this.lookdev) { this.scene.remove(this.lookdev); this.lookdev.dispose(); this.lookdev = null; }
    if(this.materials!==this.districtResources?.materials)this.materials?.dispose();this.materials=null;
    if(this.lighting===this.districtResources?.lighting)this.scene.remove(this.lighting.sun,this.lighting.sun.target,this.lighting.hemisphere);else this.lighting?.dispose();this.lighting=null;
    this.occlusion.reset(); this.idPass = false; this.scene.fog = null; this.scene.background = new Color('#293447'); this.renderer.shadowMap.enabled = false;
    for (const mesh of this.meshes) {
      this.scene.remove(mesh); mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (!(material instanceof PaletteMaterial)) material.dispose();
    }
    this.meshes.length = 0; this.cube = null;
    if (this.wireframe) { this.scene.remove(this.wireframe.lines); this.wireframe.dispose(); this.wireframe = null; }
  }
  dispose(): void { this.reset();this.districtResources?.registry.dispose();this.districtResources?.grassMaterial.dispose();this.districtResources?.materials.dispose();this.districtResources?.lighting.dispose();this.districtResources=null; window.removeEventListener('resize', this.resize); this.idPlayer.dispose(); this.idBackground.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); this.flashOverlay.remove(); }
}
