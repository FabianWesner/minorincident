import { BoxGeometry, Group, Mesh, type Material } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from '../../assets/manifest.json';
import { atLeast, type AssetDef } from '../../assets/types';
import { type PaletteToken } from '../../data/palette';
import type { GearTier, SurvivorState, SurvivorVariant } from '../../data/survivor';
import type { Materials } from '../Materials';
import type { PaletteMaterial } from '../PaletteMaterial';
import { ProceduralAnimator } from './ProceduralAnimator';
import { disposeCharacter, loadCharacter } from './rig';

type LoadedCharacter = Awaited<ReturnType<typeof loadCharacter>> & { animator: ProceduralAnimator; gear: Group[] };
/** Hero hierarchy presentation. Cosmetic variants share identical sim state and attachment rules. */
export class CharacterView extends Group {
  private readonly characters = new Map<SurvivorVariant, LoadedCharacter>();
  private variant: SurvivorVariant = 'female';
  private tier: GearTier = 0;
  private readonly bloodMaterials: PaletteMaterial[] = [];
  private readonly weaponMaterials: PaletteMaterial[] = [];
  async init(materials: Materials, weaponFeedback = false): Promise<void> {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    for (const variant of ['female', 'male'] as const) {
      const id = `char.survivor-${variant}`, def = (manifest as AssetDef[]).find(asset => asset.id === id);
      const character = await loadCharacter(variant, async () => {
        if (!def || !atLeast(def.status, 'integrated')) {
          const reason = def ? `status ${def.status}` : 'missing manifest entry';
          throw new Error(reason);
        }
        return (await loader.loadAsync('/' + def.glb.replace(/^public\//, ''))).scene;
      });
      if (character.source === 'placeholder') console.info(JSON.stringify({ type: 'asset.placeholder', id, reason: character.reason }));
      const oldMaterials = new Set<Material>(), replacements = new Map<Material, Material>();
      character.model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const remap = (source: Material): Material => {
          let replacement = replacements.get(source);
          if (replacement) return replacement;
          const token = source.name.replace(/^pal_/, '') as PaletteToken;
          if (['survivorRed', 'backpackTeal', 'picketWhite'].includes(token)) replacement = weaponFeedback ? materials.unique(token) : materials.get(token);
          else replacement = materials.fromColor(`${variant}:${source.name}`, (source as import('three').MeshStandardMaterial).color);
          replacement.userData.sharedPalette = true;
          if (weaponFeedback) this.bloodMaterials.push(replacement as PaletteMaterial);
          oldMaterials.add(source); replacements.set(source, replacement); return replacement;
        };
        object.material = Array.isArray(object.material) ? object.material.map(remap) : remap(object.material);
        object.castShadow = object.receiveShadow = true;
      });
      for (const material of oldMaterials) material.dispose();
      if (weaponFeedback) {
        const material = materials.unique('picketWhite'), weapon = new Mesh(new BoxGeometry(0.1, 0.65, 0.12), material);
        material.userData.sharedPalette = true; weapon.name = 'weapon-feedback-placeholder'; weapon.position.y = 0.2;
        character.rig.weaponSocketR.add(weapon); this.weaponMaterials.push(material);
      }
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
      this.characters.set(variant, { ...character, animator: new ProceduralAnimator(character.rig), gear }); this.add(character.model);
    }
  }
  update(pose: SurvivorState, tick: number, alpha: number): void {
    this.variant = pose.variant; this.tier = pose.gearTier;
    for (const [variant, character] of this.characters) {
      character.model.visible = variant === pose.variant;
      for (const gear of character.gear) gear.visible = gear.userData.tier <= pose.gearTier;
      if (character.model.visible) character.animator.update(pose, tick, alpha);
    }
  }
  setBlood(coverage: number): void { for (const material of this.bloodMaterials) material.bloodCoverage.value = coverage; for (const material of this.weaponMaterials) material.bloodCoverage.value = coverage; }
  getState() {
    const character = this.characters.get(this.variant);
    return { bloodCoverage: this.bloodMaterials[0]?.bloodCoverage.value ?? 0, weaponBloodCoverage: this.weaponMaterials[0]?.bloodCoverage.value ?? 0, variant: this.variant, gearTier: this.tier, animation: character?.animator.state, missingClips: character?.animator.missingClips ?? 0,
      evaluations: character?.animator.evaluations ?? 0, sources: [...this.characters].map(([variant, c]) => ({ variant, source: c.source, reason: c.reason })) };
  }
  dispose(): void { for (const character of this.characters.values()) disposeCharacter(character.model); this.characters.clear(); this.bloodMaterials.length = this.weaponMaterials.length = 0; this.clear(); }
}
