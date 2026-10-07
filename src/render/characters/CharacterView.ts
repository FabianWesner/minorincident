import { BoxGeometry, Color, Group, Mesh, Quaternion, Vector3, type Material } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from '../../assets/manifest.json';
import { atLeast, type AssetDef } from '../../assets/types';
import { palette, type PaletteToken } from '../../data/palette';
import { characterNodes } from '../../data/survivor';
import { batchRigidParts } from './batchRigidParts';
import type { GearTier, SurvivorState, SurvivorVariant } from '../../data/survivor';
import type { Materials } from '../Materials';
import type { PaletteMaterial } from '../PaletteMaterial';
import { KeyframeAnimator, type RidePose } from './KeyframeAnimator';
import { disposeCharacter, loadCharacter } from './rig';

type LoadedCharacter = Awaited<ReturnType<typeof loadCharacter>> & { animator: KeyframeAnimator; gear: Group[]; sockets: Record<'LEFT' | 'RIGHT', { socket: import('three').Object3D; hand: import('three').Object3D }> };
/** Hero hierarchy presentation. Cosmetic variants share identical sim state and attachment rules. */
export class CharacterView extends Group {
  private readonly characters = new Map<SurvivorVariant, LoadedCharacter>();
  private variant: SurvivorVariant = 'female';
  private tier: GearTier = 0;
  private readonly facingTarget = new Quaternion();
  private readonly facingAxis = new Vector3(0, 1, 0);
  private facingTime = -1;
  private turn = 0;
  private readonly bloodMaterials: PaletteMaterial[] = [];
  /** `outfit` picks the hero model set: L1 v2 plays the courier (E19), later levels the survivor. Same rig and clips. */
  async init(materials: Materials, bloodFeedback = false, low = false, outfit: 'survivor' | 'courier' = 'survivor'): Promise<void> {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    for (const variant of ['female', 'male'] as const) {
      const id = `char.${outfit}-${variant}`, def = (manifest as AssetDef[]).find(asset => asset.id === id);
      const character = await loadCharacter(variant, async () => {
        if (!def || !atLeast(def.status, 'integrated')) {
          const reason = def ? `status ${def.status}` : 'missing manifest entry';
          throw new Error(reason);
        }
        return (await loader.loadAsync('/' + (low ? def.lods?.lod1 ?? def.glb : def.glb).replace(/^public\//, ''))).scene;
      }, def?.dimensions.y);
      if (character.source === 'placeholder') console.info(JSON.stringify({ type: 'asset.placeholder', id, reason: character.reason }));
      const vertexMaterial = materials.fromVertexColors(`character:${variant}`);
      vertexMaterial.bloodCoverage.value = 0; vertexMaterial.userData.sharedPalette = true;
      if (bloodFeedback) this.bloodMaterials.push(vertexMaterial);
      const boundaries = [...new Set([...characterNodes, ...(def?.requiredNodes ?? []), ...(def?.animatedNodes ?? []), ...(def?.sockets ?? [])])];
      batchRigidParts(character.model, boundaries, vertexMaterial, source => {
        const token = source.name.replace(/^pal_/, '') as PaletteToken;
        return ['survivorRed', 'backpackTeal', 'picketWhite'].includes(token) ? new Color(palette[token]) : (source as import('three').MeshStandardMaterial).color;
      });
      const oldMaterials = new Set<Material>(), replacements = new Map<Material, Material>();
      character.model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const remap = (source: Material): Material => {
          if (source === vertexMaterial) return source;
          let replacement = replacements.get(source);
          if (replacement) return replacement;
          const token = source.name.replace(/^pal_/, '') as PaletteToken;
          if (['survivorRed', 'backpackTeal', 'picketWhite'].includes(token)) replacement = bloodFeedback ? materials.unique(token) : materials.get(token);
          else replacement = materials.fromColor(`${variant}:${source.name}`, (source as import('three').MeshStandardMaterial).color);
          replacement.userData.sharedPalette = true;
          if (bloodFeedback) this.bloodMaterials.push(replacement as PaletteMaterial);
          oldMaterials.add(source); replacements.set(source, replacement); return replacement;
        };
        object.material = Array.isArray(object.material) ? object.material.map(remap) : remap(object.material);
        object.castShadow = object.receiveShadow = true;
      });
      for (const material of oldMaterials) material.dispose();
      const gear: Group[] = [];
      const attachment = (tier: number, parent: import('three').Object3D, size: [number, number, number], position: [number, number, number], token: PaletteToken): void => {
        const group = new Group(); group.name = `gear-tier-${tier}`; const mesh = new Mesh(new BoxGeometry(...size), materials.get(token));
        mesh.material.userData.sharedPalette = true; mesh.castShadow = true; mesh.position.set(...position); group.add(mesh); parent.add(group); gear.push(group); group.userData.tier = tier;
      };
      // Cumulative gear: bag straps/pouch; pads/holster; vest/cap; heavier armor and mask.
      attachment(1, character.rig.backpackSocket, [0.12, 0.15, 0.3], [-0.13, -0.1, 0], 'backpackTeal');
      for (const side of ['L', 'R'] as const) {
        attachment(2, character.rig[`shin${side}`], [0.14, 0.12, 0.14], [0.07, -0.03, 0], 'uiDark');
        attachment(2, character.rig[`arm${side}`], [0.14, 0.1, 0.17], [0, -0.05, 0], 'uiDark');
      }
      attachment(2, character.rig.hip, [0.09, 0.18, 0.08], [0.02, -0.07, 0.22], 'woodWarm');
      attachment(3, character.rig.torso, [0.12, 0.19, 0.27], [0.12, 0.1, 0], 'uiDark');
      attachment(3, character.rig.head, [0.23, 0.055, 0.4], [0, 0.14, 0], 'survivorRed');
      attachment(4, character.rig.torso, [0.14, 0.25, 0.37], [0.16, 0.08, 0], 'policeBlue');
      attachment(4, character.rig.head, [0.08, 0.11, 0.16], [0.18, 0.005, 0], 'uiDark');
      this.characters.set(variant, { ...character, animator: new KeyframeAnimator(character.rig), gear, sockets: { LEFT: { socket: character.rig.weaponSocketL, hand: character.rig.handL }, RIGHT: { socket: character.rig.weaponSocketR, hand: character.rig.handR } } }); this.add(character.model);
    }
    this.makeParcel(materials);
  }
  update(pose: SurvivorState, tick: number, alpha: number, ride?: RidePose): void {
    this.variant = pose.variant; this.tier = pose.gearTier;
    for (const [variant, character] of this.characters) {
      character.model.visible = variant === pose.variant;
      for (const gear of character.gear) gear.visible = gear.userData.tier <= pose.gearTier;
      if (character.model.visible) character.animator.update(pose, tick, alpha, this.turn, ride);
    }
    // E19 story: the courier parcel sits between her hands while she carries it.
    const character = this.characters.get(this.variant);
    if (this.parcel) this.parcel.visible = !!pose.carrying && !!character && !ride; // riding: the parcel rides in the cargo box (BicycleView)
    if (this.parcel?.visible && character) {
      this.updateMatrixWorld(true);
      const l = character.rig.handL.getWorldPosition(this.scratchA), r = character.rig.handR.getWorldPosition(this.scratchB);
      this.parcel.position.copy(this.worldToLocal(l.add(r).multiplyScalar(.5))); this.parcel.position.y += .04;
    }
  }
  /** Riding: moves the whole figure so its pelvis lands on `target` (world, the saddle) after this frame's pose update. */
  seatPelvis(target: Vector3, lift = 0): void {
    const character = this.characters.get(this.variant); if (!character) return;
    this.updateMatrixWorld(true); character.rig.hip.getWorldPosition(this.scratchA);
    this.position.x += target.x - this.scratchA.x; this.position.z += target.z - this.scratchA.z; this.position.y += target.y + lift - this.scratchA.y;
    this.updateMatrixWorld(true);
  }
  private parcel: Group | null = null;
  private readonly scratchA = new Vector3();
  private readonly scratchB = new Vector3();
  /** Cardboard parcel with the teal depot tape (matches the clerk's hand prop). */
  private makeParcel(materials: Materials): void {
    const group = new Group(); group.name = 'carried-parcel'; group.visible = false;
    const box = new Mesh(new BoxGeometry(.3, .24, .26), materials.fromColor('parcel:card', new Color('#b98a55')));
    const tape = new Mesh(new BoxGeometry(.31, .045, .08), materials.fromColor('parcel:tape', new Color('#2aa198'))); tape.position.y = .12;
    for (const mesh of [box, tape]) { mesh.castShadow = true; group.add(mesh); }
    this.parcel = group; this.add(group);
  }
  setBlood(coverage: number): void { for (const material of this.bloodMaterials) material.bloodCoverage.value = coverage; }
  /** Presentation heading eases aim changes while the sim keeps its exact hit direction. */
  /** `striking` snaps the body onto the attack direction (QA1-06: strikes read side-on when the
   * 6 rad/s locomotion turn lags a 0.27 s jab); locomotion keeps the bounded turn. */
  face(yaw: number, time: number, striking = false): void {
    // Facing is tracked as a scalar heading. Reading it back from `rotation.y` (an XYZ Euler decomposed from the
    // slerped quaternion) wraps beyond +-90 deg, which made the turn rate flip sign and the courier wobble while walking
    // diagonally (PO: walk micro-vibration).
    if (this.facingTime < 0 || time < this.facingTime) this.facing = yaw;
    const dt = Math.max(0, time - this.facingTime), delta = Math.atan2(Math.sin(yaw - this.facing), Math.cos(yaw - this.facing));
    this.turn = Math.abs(delta) > .12 ? Math.sign(delta) : 0;
    const amount = Math.abs(delta) > 0 ? Math.min(1 - Math.exp(-(striking ? 60 : 24) * dt), (striking ? 40 : 6) * dt / Math.abs(delta)) : 1;
    this.facing += delta * amount; this.quaternion.setFromAxisAngle(this.facingAxis, this.facing); this.facingTime = time;
  }
  private facing = 0;
  /** Held views borrow these nodes; CharacterView retains ownership of the rig. */
  /** Rig node of the visible variant (kick trails follow the foot). */
  node(name: 'footR' | 'shinR') { return this.characters.get(this.variant)?.rig[name]; }
  socket(side: 'LEFT' | 'RIGHT') { return this.characters.get(this.variant)!.sockets[side]; }
  getState() {
    const character = this.characters.get(this.variant);
    return { bloodCoverage: this.bloodMaterials[0]?.bloodCoverage.value ?? 0, variant: this.variant, gearTier: this.tier, animation: character?.animator.state, clip: character?.animator.clip, missingClips: character?.animator.missingClips ?? 0,
      evaluations: character?.animator.evaluations ?? 0, sources: [...this.characters].map(([variant, c]) => ({ variant, source: c.source, reason: c.reason })) };
  }
  dispose(): void { for (const character of this.characters.values()) disposeCharacter(character.model); this.parcel?.traverse(node => { if (node instanceof Mesh) node.geometry.dispose(); }); this.parcel = null; this.characters.clear(); this.bloodMaterials.length = 0; this.clear(); }
}
