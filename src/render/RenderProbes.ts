import { Color, Mesh, MeshBasicNodeMaterial, Raycaster, Vector2, type Material, type PerspectiveCamera, type Scene } from 'three/webgpu';
import { attribute, color, Discard, Fn, vec4 } from 'three/tsl';
import type { Object3D } from 'three';
import { PaletteMaterial } from './PaletteMaterial';
import { useCourierDepth } from './characters/courierDepth';
import { seeThroughKeep, seeThroughKeepBoss } from './SeeThrough';
import type { Renderer } from './Renderer';
import type { DistrictView } from './DistrictView';
import type { CharacterView } from './characters/CharacterView';
import type { CrowdView } from './CrowdView';
import type { Lookdev } from './Lookdev';
import type { NpcView } from './npc/NpcView';
import type { InteractionView } from './InteractionView';
import type { PropFixtureView } from './PropFixtureView';
import type { BicycleView } from './BicycleView';
import type { VehicleView } from './VehicleView';
import type { EntityAssets } from './EntityAssets';
import type { Occlusion } from './Occlusion';

/** Live presentation objects of the GameView that the probes read (getters: they change per level). */
export interface ProbeTargets {
  readonly scene: Scene; readonly renderer: Renderer; readonly camera: PerspectiveCamera; readonly occlusion: Occlusion;
  readonly districts: DistrictView | null; readonly character: CharacterView | null; readonly crowd: CrowdView | null; readonly labView: Lookdev | null;
  readonly npcs: NpcView | null; readonly interactions: InteractionView | null; readonly fixtureProps: PropFixtureView | null;
  readonly bicycle: BicycleView | null; readonly vehicles: VehicleView | null; readonly entityAssets: EntityAssets | null;
  /** The courier rides the bicycle. */
  readonly riding: boolean;
  readonly courierForeground: boolean;
}

/** QA-only render probes (Scene Lab, e2e masks): id/mask/weather passes, visibility hides, the solid-cut reference and
 * the screen-hit readback. GameView creates this only in QA builds (__QA_HOOKS__); production frames never see it. */
export class RenderProbes {
  idPass: boolean | 'skyline' = false;
  windowMask = false;
  foliageMask: boolean | 'crowns' = false;
  /** Depth-tested CrowdView silhouette (including retained bodies). */
  infectedIdPass = false;
  /** Disable only solid discard, retaining placement eligibility and interior visibility. */
  solidCutOff = false;
  weatherAsset: string | null = null;
  hide = { courier: false, crowd: false, environment: false, bars: false };
  private visibilityPending = false;
  private readonly infectedIdMasks = new Map<Material, MeshBasicNodeMaterial[]>();
  private readonly foliageMasks = new Map<Material, MeshBasicNodeMaterial>();
  private readonly occluderIdMasks = new Map<Material, MeshBasicNodeMaterial>();
  private readonly skylineIdMasks = new Map<Material, MeshBasicNodeMaterial>();
  private readonly idBackground = new MeshBasicNodeMaterial({ color: '#000000' });
  private readonly idPlayer = new MeshBasicNodeMaterial({ color: '#ff00ff' });
  private readonly savedMaterials = new Map<Mesh, Material | Material[]>();
  constructor(private readonly targets: ProbeTargets) {
    this.idBackground.name = 'keep_idBackground'; this.idPlayer.name = 'keep_idPlayer';
    // The courier id mask shares the production depth contract (near-camera slice while the foreground is on).
    useCourierDepth(this.idPlayer);
  }
  /** Hide the courier / the crowd (Mega included) / the environment / the bars for the next draws. */
  setHidden(hide: { courier: boolean; crowd: boolean; environment?: boolean; bars?: boolean }): void {
    this.hide = { ...hide, environment: hide.environment ?? false, bars: hide.bars ?? false }; this.visibilityPending = true;
  }
  /** Health bars stay out of the id/mask passes and the bars-hidden probe. */
  get suppressBars(): boolean { return this.hide.bars || !!this.idPass || this.windowMask || !!this.foliageMask; }
  applyVisibility(): void {
    if (!(this.visibilityPending || this.hide.courier || this.hide.crowd || this.hide.environment)) return;
    const t = this.targets, hide = this.hide;
    // The reference removes every possible foreground solid, including static kits and parked cars.
    if (t.districts) t.districts.visible = !hide.environment;
    if (t.npcs) t.npcs.visible = !hide.environment;
    if (t.interactions) t.interactions.visible = !hide.environment;
    if (t.fixtureProps) t.fixtureProps.visible = !hide.environment;
    if (t.bicycle) t.bicycle.visible = !(t.riding ? hide.courier : hide.environment);
    t.vehicles?.probeVisibility(hide.courier, !!hide.environment);
    t.entityAssets?.probeVisibility(hide.courier, !!hide.environment);
    this.visibilityPending = false;
  }
  /** Draw the active probe pass instead of the production frame; false when no pass is active. */
  render(): boolean {
    const t = this.targets, scene = t.scene, renderer = t.renderer, camera = t.camera;
    if (this.weatherAsset) {
      const saved = new Map<Mesh, boolean>(), background = scene.background, backgroundNode = scene.backgroundNode;
      scene.background = new Color(0); scene.backgroundNode = null;
      try {
        scene.traverse(child => {
          if (!(child instanceof Mesh)) return;
          saved.set(child, child.visible); let matches = false;
          for (let parent: Object3D | null = child; parent; parent = parent.parent) if ((parent.name === 'weather' && this.weatherAsset === 'weather') || (parent.name === `inst:${this.weatherAsset}` || parent.name.startsWith(`inst:${this.weatherAsset}:`)) || parent.userData.assetId === this.weatherAsset) matches = true;
          child.visible = child.visible && matches;
        });
        renderer.render(scene, camera);
      } finally {
        for (const [mesh, visible] of saved) mesh.visible = visible;
        scene.background = background; scene.backgroundNode = backgroundNode;
      }
    } else if (this.foliageMask) {
      const backgroundNode = scene.backgroundNode; scene.backgroundNode = null;
      const background = scene.background, fog = scene.fog, shadow = renderer.shadowMap.enabled;
      scene.background = new Color(0); scene.fog = null; renderer.shadowMap.enabled = false;
      try {
        scene.traverse(child => {
          if (!(child instanceof Mesh)) return;
          this.savedMaterials.set(child, child.material);
          const source = child.material as PaletteMaterial;
          if ((child.name === 'grass-gpu-wind' && this.foliageMask !== 'crowns') || source.name === 'pal_leaf-card-crown') {
            if (!this.foliageMasks.has(source)) this.foliageMasks.set(source, new MeshBasicNodeMaterial({ color: '#ffffff', side: source.side, alphaTest: source.alphaTest, alphaToCoverage: source.alphaToCoverage, opacityNode: source.opacityNode, positionNode: source.positionNode }));
            child.material = this.foliageMasks.get(source)!;
          } else child.material = this.idBackground;
        });
        renderer.render(scene, camera);
      } finally {
        this.restoreMaterials(); scene.background = background; scene.backgroundNode = backgroundNode; scene.fog = fog; renderer.shadowMap.enabled = shadow;
      }
    } else if (this.windowMask && t.districts) {
      const backgroundNode = scene.backgroundNode; scene.backgroundNode = null; const background = scene.background, fog = scene.fog, shadow = renderer.shadowMap.enabled;
      scene.background = new Color(0); scene.fog = null; renderer.shadowMap.enabled = false; t.districts.mask(true);
      const heroVisible = t.character?.visible; if (t.character) t.character.visible = false;
      try { renderer.render(scene, camera); } finally {
        if (t.character) t.character.visible = heroVisible!;
        t.districts.mask(false); scene.background = background; scene.backgroundNode = backgroundNode; scene.fog = fog; renderer.shadowMap.enabled = shadow;
      }
    } else if ((this.idPass || this.infectedIdPass) && (t.labView || t.character)) this.renderIdPass();
    else return false;
    return true;
  }
  private renderIdPass(): void {
    const t = this.targets, scene = t.scene, renderer = t.renderer;
    const backgroundNode = scene.backgroundNode; scene.backgroundNode = null;
    const background = scene.background, fog = scene.fog, shadow = renderer.shadowMap.enabled;
    scene.background = new Color(0); scene.fog = null; renderer.shadowMap.enabled = false;
    try {
      scene.traverse((child) => {
        if (child instanceof Mesh) { this.savedMaterials.set(child, child.material); let hero = t.labView?.playerMeshes.includes(child) ?? false;
          if (t.character) for (let parent = child.parent; parent; parent = parent.parent) if (parent === t.character) { hero = true; break; }
          if (this.infectedIdPass) {
            const source = (Array.isArray(child.material) ? child.material[0] : child.material) as PaletteMaterial;
            let infected = false;
            for (let parent = child.parent; parent; parent = parent.parent) if (parent === t.crowd) { infected = true; break; }
            let masks = this.infectedIdMasks.get(source);
            if (!masks) { masks = []; this.infectedIdMasks.set(source, masks); }
            const index = infected ? 1 : 0;
            masks[index] ??= new MeshBasicNodeMaterial({ color: infected ? '#ff00ff' : '#000000', side: source.side, depthTest: source.depthTest, depthWrite: source.depthWrite, transparent: source.transparent, opacity: source.opacity, alphaTest: source.alphaTest, alphaToCoverage: source.alphaToCoverage, opacityNode: source.opacityNode, positionNode: source.positionNode, maskNode: source.maskNode });
            if (source instanceof PaletteMaterial && !masks[index].outputNode) masks[index].outputNode = source.probeMaskOutput(color(infected ? '#ff00ff' : '#000000').rgb);
            child.material = masks[index];
          } else {
            const skyline = this.idPass === 'skyline';
            if (skyline) {
              // Count the visible city buildings, excluding ground, vegetation,
              // vehicles and the bus. Keep production depth/placement below.
              hero = false;
              for (let node: Object3D | null = child; node; node = node.parent) {
                if (node.name.startsWith('inst:bld.') || String(node.userData.assetId ?? '').startsWith('bld.')) { hero = true; break; }
              }
            }
            const maskMaterial = (material: Material) => {
              const source = material as PaletteMaterial;
              const selected = skyline && hero, masks = selected ? this.skylineIdMasks : this.occluderIdMasks;
              if (!(source.positionNode || source.opacityNode || source.userData.seeThrough || source.name === 'pal_leaf-card-crown')) return selected ? this.idPlayer : this.idBackground;
              if (!masks.has(source)) {
                const mask = new MeshBasicNodeMaterial({ color: selected ? '#ff00ff' : '#000000', side: source.side, alphaTest: source.alphaTest, alphaToCoverage: source.alphaToCoverage, opacityNode: source.opacityNode, positionNode: source.positionNode });
                // ID probes must retain the visible scene's placement transforms
                // and holes: an opaque replacement truck otherwise hides a courier
                // who is plainly visible through its production see-through disc.
                const reveal = source.userData.seeThrough;
                if (reveal) mask.outputNode = Fn(() => {
                  Discard((reveal === 'boss' ? seeThroughKeepBoss() : seeThroughKeep(reveal === 'placement' ? attribute('_occluder', 'float') : undefined)).not());
                  return selected ? vec4(1, 0, 1, 1) : vec4(0, 0, 0, 1);
                })();
                masks.set(source, mask);
              }
              return masks.get(source)!;
            };
            child.material = hero && !skyline ? this.idPlayer : Array.isArray(child.material) ? child.material.map(maskMaterial) : maskMaterial(child.material);
          }
        }
      });
      // Match production depth, including its shared near-camera slice. Building
      // reveal holes already clear the subject; disabling depth here would make
      // an opaque, uncut wall falsely report a fully visible courier.
      this.idPlayer.depthTest = true;
      renderer.render(scene, t.camera);
    } finally {
      this.restoreMaterials(); scene.background = background; scene.backgroundNode = backgroundNode; scene.fog = fog; renderer.shadowMap.enabled = shadow;
    }
  }
  private restoreMaterials(): void {
    for (const [mesh, material] of this.savedMaterials) mesh.material = material;
    this.savedMaterials.clear();
  }
  /** Camera sanity, top-level scene children and the first visible mesh under five screen points. */
  renderProbe<T extends object>(diagnostics: T) {
    const c = this.targets.camera, finite = (m: { elements: number[] }) => m.elements.every(Number.isFinite);
    return { camera: { position: c.position.toArray(), quaternion: c.quaternion.toArray(), near: c.near, far: c.far, zoom: c.zoom,
      matrixWorldFinite: finite(c.matrixWorld), projectionFinite: finite(c.projectionMatrix), inverseFinite: finite(c.matrixWorldInverse) },
      children: this.targets.scene.children.map(o => ({ name: o.name || o.type, visible: o.visible })), hits: this.screenHits(), ...diagnostics };
  }
  /** First visible mesh under five screen points (centre and the four quarter points). */
  private screenHits() {
    const raycaster = new Raycaster(), camera = this.targets.camera, scene = this.targets.scene;
    return [[0, 0], [-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]].map(([x, y]) => {
      raycaster.setFromCamera(new Vector2(x, y), camera);
      const hit = raycaster.intersectObject(scene, true).find(h => h.object.visible && (h.object as Mesh).isMesh);
      if (!hit) return null;
      const m = (hit.object as Mesh).material, material = Array.isArray(m) ? m[0] : m;
      let path = hit.object.name; for (let p = hit.object.parent; p && path.length < 160; p = p.parent) path = `${p.name || p.type}/${path}`;
      return { at: [x, y], distance: +hit.distance.toFixed(2), path, instance: hit.instanceId, material: material.name, point: hit.point.toArray().map(v => +v.toFixed(2)), normal: hit.face?.normal.toArray().map(v => +v.toFixed(2)) };
    });
  }
  /** Level change: every pass off, its cached mask materials released (the hide state is kept, as before). */
  reset(): void {
    this.solidCutOff = false; this.weatherAsset = null;
    this.windowMask = false; this.foliageMask = false;
    for (const material of this.foliageMasks.values()) material.dispose(); this.foliageMasks.clear();
    for (const masks of this.infectedIdMasks.values()) for (const material of masks) material?.dispose(); this.infectedIdMasks.clear(); this.infectedIdPass = false;
    for (const material of this.occluderIdMasks.values()) material.dispose(); this.occluderIdMasks.clear();
    for (const material of this.skylineIdMasks.values()) material.dispose(); this.skylineIdMasks.clear();
    this.idPass = false;
  }
  /** Releases every cached mask through the same path as a level change, then the two shared id materials. */
  dispose(): void { this.restoreMaterials(); this.reset(); this.idPlayer.dispose(); this.idBackground.dispose(); }
}
