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
  async init(materials: Materials, bloodFeedback = false, low = false): Promise<void> {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    for (const variant of ['female', 'male'] as const) {
      const id = `char.survivor-${variant}`, def = (manifest as AssetDef[]).find(asset => asset.id === id);
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
  }
  update(pose: SurvivorState, tick: number, alpha: number, ride?: RidePose): void {
    this.variant = pose.variant; this.tier = pose.gearTier;
    for (const [variant, character] of this.characters) {
      character.model.visible = variant === pose.variant;
      for (const gear of character.gear) gear.visible = gear.userData.tier <= pose.gearTier;
      if (character.model.visible) character.animator.update(pose, tick, alpha, this.turn, ride);
    }
  }
  setBlood(coverage: number): void { for (const material of this.bloodMaterials) material.bloodCoverage.value = coverage; }
  /** Presentation heading eases aim changes while the sim keeps its exact hit direction. */
  face(yaw: number, time: number): void {
    if (this.facingTime < 0 || time < this.facingTime) this.rotation.y = yaw;
    const dt = Math.max(0, time - this.facingTime), delta = Math.atan2(Math.sin(yaw - this.rotation.y), Math.cos(yaw - this.rotation.y));
    this.turn = Math.abs(delta) > .12 ? Math.sign(delta) : 0;
    this.facingTarget.setFromAxisAngle(this.facingAxis, yaw);
    const amount = Math.abs(delta) > 0 ? Math.min(1 - Math.exp(-24 * dt), 6 * dt / Math.abs(delta)) : 1;
    this.quaternion.slerp(this.facingTarget, amount); this.facingTime = time;
  }
  /** Held views borrow these nodes; CharacterView retains ownership of the rig. */
  socket(side: 'LEFT' | 'RIGHT') { return this.characters.get(this.variant)!.sockets[side]; }
  getState() {
    const character = this.characters.get(this.variant);
    return { bloodCoverage: this.bloodMaterials[0]?.bloodCoverage.value ?? 0, variant: this.variant, gearTier: this.tier, animation: character?.animator.state, clip: character?.animator.clip, missingClips: character?.animator.missingClips ?? 0,
      evaluations: character?.animator.evaluations ?? 0, sources: [...this.characters].map(([variant, c]) => ({ variant, source: c.source, reason: c.reason })) };
  }
  dispose(): void { for (const character of this.characters.values()) disposeCharacter(character.model); this.characters.clear(); this.bloodMaterials.length = 0; this.clear(); }
}
